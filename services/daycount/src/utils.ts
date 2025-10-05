/**
 * Utility functions for day-count calculations
 *
 * @module utils
 */

import type { DateComponents } from './types';

/**
 * Parses an ISO 8601 date string (YYYY-MM-DD) into date components.
 *
 * @param dateString - ISO date string
 * @returns Parsed date components
 * @throws {Error} If date string is invalid
 *
 * @internal
 */
export function parseDate(dateString: string): DateComponents {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const year = parseInt(match[1]!, 10);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const month = parseInt(match[2]!, 10);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const day = parseInt(match[3]!, 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be 1-12`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}. Must be 1-31`);
  }

  return { year, month, day };
}

/**
 * Checks if a year is a leap year.
 *
 * @param year - Calendar year
 * @returns True if leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Calculates the number of actual days between two dates.
 *
 * Uses JavaScript Date for accurate day counting including leap years.
 *
 * @param start - Start date components
 * @param end - End date components
 * @returns Number of days from start to end (inclusive of start, exclusive of end)
 */
export function actualDaysBetween(start: DateComponents, end: DateComponents): number {
  const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));

  const millisecondsDiff = endDate.getTime() - startDate.getTime();
  const days = millisecondsDiff / (1000 * 60 * 60 * 24);

  return Math.round(days);
}

/**
 * Returns the number of days in a given month.
 *
 * @param year - Calendar year
 * @param month - Month (1-12)
 * @returns Number of days in the month
 */
export function daysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month === 2 && isLeapYear(year)) {
    return 29;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return daysPerMonth[month - 1]!;
}

/**
 * Checks if a date is the last day of the month.
 *
 * @param date - Date components
 * @returns True if date is the last day of its month
 */
export function isEndOfMonth(date: DateComponents): boolean {
  return date.day === daysInMonth(date.year, date.month);
}

/**
 * Validates that start date is before or equal to end date.
 *
 * @param start - Start date components
 * @param end - End date components
 * @throws {Error} If start > end
 */
export function validateDateOrder(start: DateComponents, end: DateComponents): void {
  const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));

  if (startDate > endDate) {
    throw new Error(`Start date must be before or equal to end date`);
  }
}
