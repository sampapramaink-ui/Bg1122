import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  label = 'items'
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const safeTotalPages = Math.max(1, totalPages);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= safeTotalPages && page !== currentPage) {
      soundFx.playClick();
      onPageChange(page);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-mono">
      {/* Items Range & Count */}
      <div className="flex items-center gap-3 text-slate-400">
        <span>
          Showing <strong className="text-amber-400">{startItem}</strong> - <strong className="text-amber-400">{endItem}</strong> of <strong className="text-white">{totalItems}</strong> {label}
        </span>

        {/* Page Size Selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <span className="text-[10px] uppercase font-bold text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                soundFx.playClick();
                onPageSizeChange(Number(e.target.value));
              }}
              className="bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs rounded-lg px-1.5 py-0.5 outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          disabled={currentPage <= 1}
          onClick={() => handlePageClick(1)}
          title="First Page"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Page */}
        <button
          disabled={currentPage <= 1}
          onClick={() => handlePageClick(currentPage - 1)}
          title="Previous Page"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page X of Y Display */}
        <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-200 font-bold rounded-lg text-xs">
          Page <span className="text-amber-400">{currentPage}</span> of {safeTotalPages}
        </span>

        {/* Next Page */}
        <button
          disabled={currentPage >= safeTotalPages}
          onClick={() => handlePageClick(currentPage + 1)}
          title="Next Page"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          disabled={currentPage >= safeTotalPages}
          onClick={() => handlePageClick(safeTotalPages)}
          title="Last Page"
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition-all cursor-pointer"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
