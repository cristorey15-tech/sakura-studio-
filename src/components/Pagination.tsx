"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageLoading: boolean;
  itemLabel: string;
  limit: number;
  onPageChange: (page: number) => void;
  showArrows?: boolean;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageLoading,
  itemLabel,
  limit,
  onPageChange,
  showArrows = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pluralLabel =
    itemLabel.endsWith("s") ? itemLabel : `${itemLabel}s`;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => {
      if (p === 1 || p === totalPages) return true;
      if (Math.abs(p - page) <= 1) return true;
      return false;
    }
  );

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted">
        {total === 0
          ? `0 ${pluralLabel}`
          : `${(page - 1) * limit + 1}–${Math.min(
              page * limit,
              total
            )} de ${total} ${pluralLabel}`}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="flex items-center justify-center w-7 h-7 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
          title="Primera página"
        >
          «
        </button>

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
        >
          {showArrows ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          ) : (
            "← "
          )}
          Anterior
        </button>

        <div className="flex items-center gap-0.5 px-1">
          {pages.map((p, idx) => {
            const showEllipsis = idx > 0 && p - pages[idx - 1] > 1;
            return (
              <span key={p} className="flex items-center">
                {showEllipsis && (
                  <span className="px-1.5 text-xs text-muted">···</span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 flex items-center justify-center text-xs font-medium rounded-lg transition-all duration-200 ${
                    p === page
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-surface hover:text-dark"
                  }`}
                >
                  {p}
                </button>
              </span>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
        >
          Siguiente
          {showArrows ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          ) : (
            " →"
          )}
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-7 h-7 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
          title="Última página"
        >
          »
        </button>

        {pageLoading && (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}
