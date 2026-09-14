"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  itemLabel?: string;
}

export function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  disabled = false,
  itemLabel = "kết quả",
}: TablePaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total.toLocaleString("vi-VN")} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Trang trước"
          aria-label="Trang trước"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-24 text-center tabular-nums text-foreground">
          Trang {page} / {safeTotalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Trang sau"
          aria-label="Trang sau"
          disabled={disabled || totalPages === 0 || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
