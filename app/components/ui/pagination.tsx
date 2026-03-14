import { Link, useSearchParams, useLocation } from "react-router";
import { Button } from "./button";
import { cn } from "~/lib/cn";

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
        className={cn(
          currentPage === 1 && "pointer-events-none opacity-40"
        )}
        aria-label="Previous page"
        aria-disabled={currentPage === 1}
        tabIndex={currentPage === 1 ? -1 : 0}
      >
        <Button variant="default">← Previous</Button>
      </Link>

      <div className="flex items-center gap-2">
        {currentPage > 1 && (
          <Link to={createPageUrl(1)}>
            <Button variant="ghost" size="icon">1</Button>
          </Link>
        )}

        {currentPage > 2 && <span className="px-2 text-text-tertiary">...</span>}

        <Link to={createPageUrl(currentPage)} aria-current="page">
          <Button variant="pressed" size="icon">{currentPage}</Button>
        </Link>

        {currentPage < totalPages - 1 && <span className="px-2 text-text-tertiary">...</span>}

        {currentPage < totalPages && (
          <Link to={createPageUrl(totalPages)}>
            <Button variant="ghost" size="icon">{totalPages}</Button>
          </Link>
        )}
      </div>

      <Link
        to={createPageUrl(currentPage + 1)}
        className={cn(
          currentPage === totalPages && "pointer-events-none opacity-40"
        )}
        aria-label="Next page"
        aria-disabled={currentPage === totalPages}
        tabIndex={currentPage === totalPages ? -1 : 0}
      >
        <Button variant="default">Next →</Button>
      </Link>
    </nav>
  );
}
