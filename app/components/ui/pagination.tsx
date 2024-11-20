import { Link, useSearchParams, useLocation } from "@remix-run/react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
};

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();

  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    return `${pathname}?${newParams.toString()}`;
  };

  return (
    <nav
      className="mt-8 flex justify-center items-center gap-2"
      aria-label="Pagination"
    >
      <Link
        to={createPageUrl(currentPage - 1)}
        className={`px-3 py-1 rounded ${
          currentPage === 1
            ? "pointer-events-none opacity-50 bg-green-100"
            : "bg-green-100 hover:bg-green-200"
        }`}
        aria-label="Previous page"
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : 0}
      >
        ←
      </Link>

      {currentPage > 1 && (
        <Link
          to={createPageUrl(1)}
          className="px-3 py-1 rounded bg-green-100 hover:bg-green-200"
        >
          1
        </Link>
      )}

      {currentPage > 2 && <span className="px-2">...</span>}

      <Link
        to={createPageUrl(currentPage)}
        className="px-3 py-1 rounded bg-green-200"
        aria-current="page"
      >
        {currentPage}
      </Link>

      {currentPage < totalPages - 1 && <span className="px-2">...</span>}

      {currentPage < totalPages && (
        <Link
          to={createPageUrl(totalPages)}
          className="px-3 py-1 rounded bg-green-100 hover:bg-green-200"
        >
          {totalPages}
        </Link>
      )}

      <Link
        to={createPageUrl(currentPage + 1)}
        className={`px-3 py-1 rounded ${
          currentPage === totalPages
            ? "pointer-events-none opacity-50 bg-green-100"
            : "bg-green-100 hover:bg-green-200"
        }`}
        aria-label="Next page"
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : 0}
      >
        →
      </Link>
    </nav>
  );
}
