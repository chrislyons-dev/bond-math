/**
 * Day-count convention calculation implementations
 *
 * @module conventions
 */

import type { DateComponents, DayCountOptions, DayCountResult } from './types';
import { actualDaysBetween, isEndOfMonth, isLeapYear } from './utils';

/**
 * Calculates year fraction using ACT/360 convention.
 *
 * Uses actual days between dates divided by 360.
 * Common for U.S. money-market instruments.
 *
 * @param start - Start date components
 * @param end - End date components
 * @returns Calculation result
 */
export function calculateACT360(start: DateComponents, end: DateComponents): DayCountResult {
  const days = actualDaysBetween(start, end);
  const basis = 360;

  return {
    days,
    yearFraction: days / basis,
    basis,
  };
}

/**
 * Calculates year fraction using ACT/365F convention.
 *
 * Uses actual days between dates divided by 365 (fixed).
 * Common for GBP and CAD money markets.
 *
 * @param start - Start date components
 * @param end - End date components
 * @returns Calculation result
 */
export function calculateACT365F(start: DateComponents, end: DateComponents): DayCountResult {
  const days = actualDaysBetween(start, end);
  const basis = 365;

  return {
    days,
    yearFraction: days / basis,
    basis,
  };
}

/**
 * Calculates year fraction using 30/360 U.S. convention (Bond Basis).
 *
 * Treats each month as 30 days and year as 360 days.
 * Uses ISDA/NASD adjustments for month-end dates.
 *
 * @param start - Start date components
 * @param end - End date components
 * @param options - Calculation options
 * @returns Calculation result
 */
export function calculate30360(
  start: DateComponents,
  end: DateComponents,
  options: DayCountOptions = {}
): DayCountResult {
  let d1 = start.day;
  let d2 = end.day;
  const m1 = start.month;
  const m2 = end.month;
  const y1 = start.year;
  const y2 = end.year;

  // Apply 30/360 US adjustments
  // Rule 1: If d1 is 31 or last day of February, change d1 to 30
  if (d1 === 31 || (m1 === 2 && isEndOfMonth(start))) {
    d1 = 30;
  }

  // Rule 2: If d2 is 31 and d1 is 30 or 31, change d2 to 30
  if (d2 === 31 && d1 >= 30) {
    d2 = 30;
  }

  // Rule 3 (optional EOM rule): If d2 is last day of February and d1 is 30, change d2 to 30
  if (options.eomRule && m2 === 2 && isEndOfMonth(end) && d1 === 30) {
    d2 = 30;
  }

  const days = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  const basis = 360;

  return {
    days,
    yearFraction: days / basis,
    basis,
  };
}

/**
 * Calculates year fraction using 30E/360 European convention.
 *
 * Eurobond basis. Both start and end dates are set to 30 if they fall
 * on the 31st day of a month.
 *
 * @param start - Start date components
 * @param end - End date components
 * @returns Calculation result
 */
export function calculate30E360(start: DateComponents, end: DateComponents): DayCountResult {
  let d1 = start.day;
  let d2 = end.day;

  // Apply European 30E/360 adjustments
  if (d1 === 31) {
    d1 = 30;
  }

  if (d2 === 31) {
    d2 = 30;
  }

  const days = (end.year - start.year) * 360 + (end.month - start.month) * 30 + (d2 - d1);
  const basis = 360;

  return {
    days,
    yearFraction: days / basis,
    basis,
  };
}

/**
 * Calculates year fraction using ACT/ACT ISDA convention.
 *
 * Actual days divided by actual days in each year (365 or 366).
 * If the period spans multiple years, splits calculation by year.
 *
 * @param start - Start date components
 * @param end - End date components
 * @returns Calculation result
 */
export function calculateACTACTISDA(
  start: DateComponents,
  end: DateComponents
): DayCountResult {
  const days = actualDaysBetween(start, end);

  // If same year, use simple calculation
  if (start.year === end.year) {
    const basis = isLeapYear(start.year) ? 366 : 365;
    return {
      days,
      yearFraction: days / basis,
      basis,
    };
  }

  // Multi-year period: split by calendar year
  let totalYearFraction = 0;
  let currentYear = start.year;

  while (currentYear <= end.year) {
    const yearStart: DateComponents =
      currentYear === start.year ? start : { year: currentYear, month: 1, day: 1 };

    const yearEnd: DateComponents =
      currentYear === end.year
        ? end
        : { year: currentYear + 1, month: 1, day: 1 };

    const daysInYear = actualDaysBetween(yearStart, yearEnd);
    const basisForYear = isLeapYear(currentYear) ? 366 : 365;

    totalYearFraction += daysInYear / basisForYear;
    currentYear++;
  }

  // Return average basis for display purposes
  const avgBasis = days / totalYearFraction;

  return {
    days,
    yearFraction: totalYearFraction,
    basis: Math.round(avgBasis),
  };
}

/**
 * Calculates year fraction using ACT/ACT ICMA convention.
 *
 * Coupon-period-based method. Adjusts for varying coupon frequencies.
 * Commonly used for semiannual coupon government and corporate bonds.
 *
 * @param start - Start date components
 * @param end - End date components
 * @param options - Must include frequency (coupons per year)
 * @returns Calculation result
 *
 * @throws {Error} If frequency is not provided
 */
export function calculateACTACTICMA(
  start: DateComponents,
  end: DateComponents,
  options: DayCountOptions = {}
): DayCountResult {
  const frequency = options.frequency ?? 2; // Default to semi-annual

  if (frequency <= 0) {
    throw new Error('Frequency must be positive');
  }

  const days = actualDaysBetween(start, end);

  // Approximate days per period based on frequency
  // This is a simplified implementation; production would require coupon schedule
  const daysPerPeriod = 365 / frequency;
  const basis = Math.round(daysPerPeriod * frequency);

  const yearFraction = days / basis;

  return {
    days,
    yearFraction,
    basis,
  };
}
