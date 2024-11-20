type SortConfig<T extends string> = {
  field: T;
  order: "asc" | "desc";
};

export function getRequestParams<TSortField extends string>(
  request: Request,
  defaultSort: SortConfig<TSortField>,
) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const sortField = (url.searchParams.get("sort") ||
    defaultSort.field) as TSortField;
  const sortOrder = (url.searchParams.get("order") || defaultSort.order) as
    | "asc"
    | "desc";

  return {
    searchQuery,
    page,
    sort: {
      field: sortField,
      order: sortOrder,
    },
    hasSearch: searchQuery.length >= 2,
  };
}
