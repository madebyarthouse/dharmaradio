import { useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import debounce from "just-debounce-it";

export type Sort = {
  sort: string;
  order: "asc" | "desc";
};

export function useSort<T extends string>(defaultSort: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = (searchParams.get("sort") || defaultSort) as T;
  const order = (searchParams.get("order") || "asc") as "asc" | "desc";

  const updateSort = useCallback(
    (newSort: T) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        const currentSort = newParams.get("sort");
        const currentOrder = newParams.get("order");

        newParams.set("sort", newSort);
        if (currentSort === newSort) {
          newParams.set("order", currentOrder === "asc" ? "desc" : "asc");
        } else {
          newParams.set("order", "asc");
        }
        return newParams;
      });
    },
    [setSearchParams],
  );

  return { sort, order, updateSort };
}

export function useSearchWithDebounce(minChars = 2, delay = 300) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        const oldQuery = newParams.get("q");

        if (value.length >= minChars) {
          newParams.set("q", value);
          // Only reset page if search query changed
          if (oldQuery !== value) {
            newParams.set("page", "1");
          }
        } else {
          const hadQuery = newParams.has("q");
          newParams.delete("q");
          // Only reset page if there was a query to clear
          if (hadQuery) {
            newParams.set("page", "1");
          }
        }
        return newParams;
      });
    }, delay),
    [setSearchParams, minChars],
  );

  useEffect(() => {
    debouncedSetSearch(searchTerm);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchTerm, debouncedSetSearch]);

  return {
    searchTerm,
    setSearchTerm,
    setSearchParams,
  };
}
