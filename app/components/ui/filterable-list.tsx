import { SearchInput } from "./search-input";
import { SortButton } from "./sort-button";
import { Pagination } from "./pagination";
import { Suspense } from "react";
import { useSearchWithDebounce, useSort } from "~/utils/search-params";

type SortOption = {
  label: string;
  value: string;
};

type FilterableListProps = {
  title: string;
  totalItems: number;
  itemName: string;
  itemNamePlural?: string;
  searchPlaceholder?: string;
  sortOptions?: SortOption[];
  defaultSort?: string;
  currentPage: number;
  totalPages: number;
  children: React.ReactNode;
};

export function FilterableList({
  title,
  totalItems,
  itemName,
  itemNamePlural,
  searchPlaceholder,
  sortOptions,
  defaultSort,
  currentPage,
  totalPages,
  children,
}: FilterableListProps) {
  const pluralName = itemNamePlural || `${itemName}s`;
  const { searchTerm, setSearchTerm } = useSearchWithDebounce();
  const { sort, order, updateSort } = useSort(
    defaultSort || (sortOptions?.[0]?.value ?? ""),
  );

  return (
    <div className="">
      <div className="flex flex-col justify-between gap-4 mb-8">
        <h1 className="text-3xl font-serif">
          {title} ({totalItems})
        </h1>
        <div className="text-sm text-green-800"></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="w-full md:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={searchPlaceholder || `Search ${pluralName}...`}
          />
        </div>

        {sortOptions && sortOptions.length > 0 && (
          <div className="flex gap-2">
            {sortOptions.map((option) => (
              <SortButton
                key={option.value}
                label={option.label}
                active={sort === option.value}
                ascending={order === "asc"}
                onClick={() => updateSort(option.value)}
              />
            ))}
          </div>
        )}
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <div className="animate-pulse">Loading...</div>
          </div>
        }
      >
        {children}
      </Suspense>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      )}
    </div>
  );
}
