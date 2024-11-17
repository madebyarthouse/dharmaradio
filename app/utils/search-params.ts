import { useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import debounce from "just-debounce-it";

export type SortConfig = {
  field: string;
  order: "asc" | "desc";
};

export function useSearchWithDebounce(minChars = 2, delay = 300) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");

  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      if (value.length >= minChars) {
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.set("q", value);
          newParams.set("page", "1"); // Reset to first page on search
          return newParams;
        });
      } else if (value.length === 0) {
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.delete("q");
          newParams.set("page", "1");
          return newParams;
        });
      }
    }, delay),
    [setSearchParams]
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
    searchParams,
    setSearchParams,
  };
}

export function useSort<T extends string>(defaultField: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = (searchParams.get("sort") as T) || defaultField;
  const order = (searchParams.get("order") || "asc") as "asc" | "desc";

  const updateSort = useCallback(
    (field: T) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (sort === field) {
          newParams.set("order", order === "asc" ? "desc" : "asc");
        } else {
          newParams.set("sort", field);
          newParams.set("order", "asc");
        }
        return newParams;
      });
    },
    [sort, order, setSearchParams]
  );

  return { sort, order, updateSort };
}
