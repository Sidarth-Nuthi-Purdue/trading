/**
 * Format utilities for displaying numerical values
 */

/**
 * Format a price value with appropriate precision based on its magnitude
 * @param price The price value to format
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  if (isNaN(price)) return 'N/A';
  
  if (price >= 1000) {
    return price.toFixed(2);
  } else if (price >= 100) {
    return price.toFixed(2);
  } else if (price >= 10) {
    return price.toFixed(3);
  } else if (price >= 1) {
    return price.toFixed(4);
  } else {
    return price.toFixed(6);
  }
}

/**
 * Format a percentage value with appropriate precision
 * @param percent The percentage value to format
 * @returns Formatted percentage string
 */
export function formatPercent(percent: number): string {
  if (isNaN(percent)) return 'N/A';
  
  return percent.toFixed(2) + '%';
}

/**
 * Format a large number with comma separators
 * @param value The number to format
 * @returns Formatted number string with commas
 */
export function formatNumber(value: number): string {
  if (isNaN(value)) return 'N/A';
  
  return value.toLocaleString();
}

/**
 * Format a date object or timestamp to a readable string
 * @param date The date to format (Date object or timestamp)
 * @returns Formatted date string
 */
export function formatDate(date: Date | number): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  return dateObj.toLocaleString();
} 