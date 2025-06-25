'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showSizeChanger?: boolean;
  className?: string;
}

export function DataPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showSizeChanger = true,
  className = ''
}: DataPaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalItems === 0) {
    return null;
  }

  const renderPageNumbers = () => {
    const items = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              onClick={() => onPageChange(i)}
              isActive={currentPage === i}
              className={`cursor-pointer ${
                currentPage === i 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show truncated pagination
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            onClick={() => onPageChange(1)}
            isActive={currentPage === 1}
            className={`cursor-pointer ${
              currentPage === 1 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
            }`}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis className="text-gray-400" />
          </PaginationItem>
        );
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          items.push(
            <PaginationItem key={i}>
              <PaginationLink
                onClick={() => onPageChange(i)}
                isActive={currentPage === i}
                className={`cursor-pointer ${
                  currentPage === i 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {i}
              </PaginationLink>
            </PaginationItem>
          );
        }
      }

      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis className="text-gray-400" />
          </PaginationItem>
        );
      }

      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              onClick={() => onPageChange(totalPages)}
              isActive={currentPage === totalPages}
              className={`cursor-pointer ${
                currentPage === totalPages 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  return (
    <div className={`flex items-center justify-between px-2 ${className}`}>
      {/* Items info and size changer */}
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-400">
          Showing {startItem} to {endItem} of {totalItems} results
        </div>
        
        {showSizeChanger && onItemsPerPageChange && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Show:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
              <SelectTrigger className="w-20 bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="10" className="text-white">10</SelectItem>
                <SelectItem value="25" className="text-white">25</SelectItem>
                <SelectItem value="50" className="text-white">50</SelectItem>
                <SelectItem value="100" className="text-white">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                className={`cursor-pointer bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 ${
                  currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </PaginationItem>
            
            {renderPageNumbers()}
            
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                className={`cursor-pointer bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 ${
                  currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}