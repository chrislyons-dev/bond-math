import { describe, test, expect } from 'vitest';
import {
  parseDate,
  isLeapYear,
  actualDaysBetween,
  daysInMonth,
  isEndOfMonth,
  validateDateOrder,
} from '../src/utils';

describe('parseDate', () => {
  test('should parse valid ISO date string', () => {
    const result = parseDate('2025-01-15');
    expect(result).toEqual({ year: 2025, month: 1, day: 15 });
  });

  test('should parse leap day correctly', () => {
    const result = parseDate('2024-02-29');
    expect(result).toEqual({ year: 2024, month: 2, day: 29 });
  });

  test('should throw error for invalid format', () => {
    expect(() => parseDate('2025/01/15')).toThrow('Invalid date format');
    expect(() => parseDate('01-15-2025')).toThrow('Invalid date format');
    expect(() => parseDate('2025-1-15')).toThrow('Invalid date format');
  });

  test('should throw error for invalid month', () => {
    expect(() => parseDate('2025-00-15')).toThrow('Invalid month');
    expect(() => parseDate('2025-13-15')).toThrow('Invalid month');
  });

  test('should throw error for invalid day', () => {
    expect(() => parseDate('2025-01-00')).toThrow('Invalid day');
    expect(() => parseDate('2025-01-32')).toThrow('Invalid day');
  });
});

describe('isLeapYear', () => {
  test('should return true for leap years divisible by 4', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2020)).toBe(true);
  });

  test('should return false for years divisible by 100 but not 400', () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
  });

  test('should return true for years divisible by 400', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2400)).toBe(true);
  });

  test('should return false for non-leap years', () => {
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2025)).toBe(false);
  });
});

describe('actualDaysBetween', () => {
  test('should calculate days for same month', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 1, day: 31 };
    expect(actualDaysBetween(start, end)).toBe(30);
  });

  test('should calculate days across months', () => {
    const start = { year: 2025, month: 1, day: 15 };
    const end = { year: 2025, month: 3, day: 15 };
    expect(actualDaysBetween(start, end)).toBe(59);
  });

  test('should calculate days across year boundary', () => {
    const start = { year: 2024, month: 12, day: 31 };
    const end = { year: 2025, month: 1, day: 1 };
    expect(actualDaysBetween(start, end)).toBe(1);
  });

  test('should handle leap year correctly', () => {
    const start = { year: 2024, month: 2, day: 28 };
    const end = { year: 2024, month: 3, day: 1 };
    expect(actualDaysBetween(start, end)).toBe(2); // Feb 29 exists in 2024
  });

  test('should handle non-leap year correctly', () => {
    const start = { year: 2025, month: 2, day: 28 };
    const end = { year: 2025, month: 3, day: 1 };
    expect(actualDaysBetween(start, end)).toBe(1); // Feb 29 does not exist in 2025
  });

  test('should return 0 for same date', () => {
    const start = { year: 2025, month: 1, day: 15 };
    const end = { year: 2025, month: 1, day: 15 };
    expect(actualDaysBetween(start, end)).toBe(0);
  });

  test('should calculate exactly 365 days for non-leap year', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 };
    expect(actualDaysBetween(start, end)).toBe(365);
  });

  test('should calculate exactly 366 days for leap year', () => {
    const start = { year: 2024, month: 1, day: 1 };
    const end = { year: 2025, month: 1, day: 1 };
    expect(actualDaysBetween(start, end)).toBe(366);
  });
});

describe('daysInMonth', () => {
  test('should return correct days for 31-day months', () => {
    expect(daysInMonth(2025, 1)).toBe(31); // January
    expect(daysInMonth(2025, 3)).toBe(31); // March
    expect(daysInMonth(2025, 5)).toBe(31); // May
    expect(daysInMonth(2025, 7)).toBe(31); // July
    expect(daysInMonth(2025, 8)).toBe(31); // August
    expect(daysInMonth(2025, 10)).toBe(31); // October
    expect(daysInMonth(2025, 12)).toBe(31); // December
  });

  test('should return correct days for 30-day months', () => {
    expect(daysInMonth(2025, 4)).toBe(30); // April
    expect(daysInMonth(2025, 6)).toBe(30); // June
    expect(daysInMonth(2025, 9)).toBe(30); // September
    expect(daysInMonth(2025, 11)).toBe(30); // November
  });

  test('should return 28 for February in non-leap year', () => {
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  test('should return 29 for February in leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2020, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
});

describe('isEndOfMonth', () => {
  test('should return true for last day of month', () => {
    expect(isEndOfMonth({ year: 2025, month: 1, day: 31 })).toBe(true);
    expect(isEndOfMonth({ year: 2025, month: 4, day: 30 })).toBe(true);
    expect(isEndOfMonth({ year: 2025, month: 2, day: 28 })).toBe(true);
    expect(isEndOfMonth({ year: 2024, month: 2, day: 29 })).toBe(true);
  });

  test('should return false for non-last day of month', () => {
    expect(isEndOfMonth({ year: 2025, month: 1, day: 30 })).toBe(false);
    expect(isEndOfMonth({ year: 2025, month: 4, day: 29 })).toBe(false);
    expect(isEndOfMonth({ year: 2025, month: 2, day: 27 })).toBe(false);
  });
});

describe('validateDateOrder', () => {
  test('should not throw for start before end', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 12, day: 31 };
    expect(() => validateDateOrder(start, end)).not.toThrow();
  });

  test('should not throw for same date', () => {
    const date = { year: 2025, month: 1, day: 15 };
    expect(() => validateDateOrder(date, date)).not.toThrow();
  });

  test('should throw for start after end', () => {
    const start = { year: 2025, month: 12, day: 31 };
    const end = { year: 2025, month: 1, day: 1 };
    expect(() => validateDateOrder(start, end)).toThrow('Start date must be before or equal to end date');
  });
});
