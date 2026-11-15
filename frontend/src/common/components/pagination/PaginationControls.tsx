import { Button } from "../../../components/ui/button";
import { getVisiblePages } from "../../utils/pagination";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, totalPages, onPageChange }: Props) {
  const pages = getVisiblePages(page, totalPages);

  return (
    <div className="flex items-center gap-1">
      {/* Previous */}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        ←
      </Button>

      {/* Page numbers */}
      {pages.map((p, i) => {
        const showEllipsis = i > 0 && p - pages[i - 1] > 1;

        return (
          <div key={p} className="flex items-center gap-1">
            {showEllipsis && (
              <span className="px-2 text-muted-foreground">...</span>
            )}

            <Button
              type="button"
              aria-current={p === page ? "page" : undefined}
              variant={p === page ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          </div>
        );
      })}

      {/* Next */}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        aria-label="Next page"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        →
      </Button>
    </div>
  );
}
