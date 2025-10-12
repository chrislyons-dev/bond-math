/**
 * Form validation utilities for UI components
 *
 * @module validation-utils
 * @layer client
 * @description Client-side validation functions for date inputs and form fields
 * @owner platform-team
 * @dependencies none
 * @purity pure (no side effects)
 *
 * Provides type-safe, pure validation functions for:
 * - ISO 8601 date format validation
 * - Date range validation (start < end)
 * - Date formatting and manipulation
 */

/**
 * Validates ISO 8601 date string (YYYY-MM-DD).
 *
 * Checks:
 * 1. Non-empty string
 * 2. Matches YYYY-MM-DD regex pattern
 * 3. Represents valid calendar date
 *
 * @pure
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid ISO 8601 date, false otherwise
 *
 * @example
 * ```typescript
 * isValidDate('2024-01-15') // true
 * isValidDate('2024-02-30') // false (invalid date)
 * isValidDate('01-15-2024') // false (wrong format)
 * ```
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
 * Validates that start date is strictly before end date.
 *
 * Both dates must be valid ISO 8601 format and start must be < end.
 *
 * @pure
 * @param {string} start - Start date (ISO 8601)
 * @param {string} end - End date (ISO 8601)
 * @returns {boolean} True if start < end and both valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidDateRange('2024-01-01', '2024-12-31') // true
 * isValidDateRange('2024-12-31', '2024-01-01') // false (inverted)
 * isValidDateRange('2024-01-01', '2024-01-01') // false (equal)
 * ```
 */
export function isValidDateRange(start: string, end: string): boolean {
  if (!isValidDate(start) || !isValidDate(end)) return false;

  const startDate = new Date(start);
  const endDate = new Date(end);

  return startDate < endDate;
}

/**
 * Formats JavaScript Date object to ISO 8601 string (YYYY-MM-DD).
 *
 * @pure
 * @param {Date} date - JavaScript Date object
 * @returns {string} ISO 8601 formatted date string
 *
 * @example
 * ```typescript
 * formatDate(new Date(2024, 0, 15)) // '2024-01-15'
 * ```
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date as ISO 8601 string.
 *
 * @impure (depends on system clock)
 * @returns {string} Today's date in ISO 8601 format
 *
 * @example
 * ```typescript
 * getToday() // '2024-01-15' (if today is Jan 15, 2024)
 * ```
 */
export function getToday(): string {
  return formatDate(new Date());
}

/**
 * Gets date N days from today as ISO 8601 string.
 *
 * @impure (depends on system clock)
 * @param {number} days - Number of days to add (positive) or subtract (negative)
 * @returns {string} Date N days from today in ISO 8601 format
 *
 * @example
 * ```typescript
 * getDaysFromToday(7)   // '2024-01-22' (if today is Jan 15, 2024)
 * getDaysFromToday(-7)  // '2024-01-08' (if today is Jan 15, 2024)
 * getDaysFromToday(180) // '2024-07-13' (roughly 6 months from Jan 15, 2024)
 * ```
 */
export function getDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
