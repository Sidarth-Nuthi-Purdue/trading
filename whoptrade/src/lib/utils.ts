import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind classes and handles conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as a price with $ symbol and 2 decimal places
 */
export function formatPrice(price: number | string | undefined): string {
  if (price === undefined || price === null) return 'N/A';
  
  const numericValue = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numericValue)) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericValue);
}

/**
 * Format a number as a volume with K or M suffix
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`;
  }
  return volume.toString();
} 