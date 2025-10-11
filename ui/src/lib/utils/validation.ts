/**
 * Form validation utilities
 */

/**
 * Validates ISO 8601 date string (YYYY-MM-DD)
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;

  // Check format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  // Check if it's a valid date
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates that start date is before end date
 */
export function isValidDateRange(start: string, end: string): boolean {
  if (!isValidDate(start) || !isValidDate(end)) return false;

  const startDate = new Date(start);
  const endDate = new Date(end);

  return startDate < endDate;
}

/**
 * Formats date to ISO 8601 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date as ISO 8601 string
 */
export function getToday(): string {
  return formatDate(new Date());
}

/**
 * Gets date N days from today
 */
export function getDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
