import { describe, test, expect } from 'vitest';
import {
  calculateACT360,
  calculateACT365F,
  calculate30360,
  calculate30E360,
  calculateACTACTISDA,
  calculateACTACTICMA,
} from '../src/conventions';

describe('calculateACT360', () => {
  test('should calculate exactly 180 days as 0.5 year fraction', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 1 }; // 181 days
    const result = calculateACT360(start, end);

    expect(result.days).toBe(181);
    expect(result.basis).toBe(360);
    expect(result.yearFraction).toBeCloseTo(181 / 360, 6);
  });

  test('should calculate full year correctly', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 }; // 365 days
    const result = calculateACT360(start, end);

    expect(result.days).toBe(365);
    expect(result.yearFraction).toBeCloseTo(365 / 360, 6);
  });

  test('should handle single day', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 1, day: 2 };
    const result = calculateACT360(start, end);

    expect(result.days).toBe(1);
    expect(result.yearFraction).toBeCloseTo(1 / 360, 6);
  });
});

describe('calculateACT365F', () => {
  test('should calculate exactly 365 days as 1.0 year fraction', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 }; // 365 days (non-leap)
    const result = calculateACT365F(start, end);

    expect(result.days).toBe(365);
    expect(result.basis).toBe(365);
    expect(result.yearFraction).toBe(1.0);
  });

  test('should calculate leap year as > 1.0 year fraction', () => {
    const start = { year: 2024, month: 1, day: 1 };
    const end = { year: 2025, month: 1, day: 1 }; // 366 days (leap)
    const result = calculateACT365F(start, end);

    expect(result.days).toBe(366);
    expect(result.yearFraction).toBeCloseTo(366 / 365, 6);
  });

  test('should handle half year', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 2 }; // 182 days
    const result = calculateACT365F(start, end);

    expect(result.days).toBe(182);
    expect(result.yearFraction).toBeCloseTo(182 / 365, 6);
  });
});

describe('calculate30360', () => {
  test('should treat each month as 30 days', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 2, day: 1 };
    const result = calculate30360(start, end);

    expect(result.days).toBe(30);
    expect(result.basis).toBe(360);
    expect(result.yearFraction).toBeCloseTo(30 / 360, 6);
  });

  test('should treat full year as 360 days', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 };
    const result = calculate30360(start, end);

    expect(result.days).toBe(360);
    expect(result.yearFraction).toBe(1.0);
  });

  test('should adjust day 31 to day 30', () => {
    const start = { year: 2025, month: 1, day: 31 };
    const end = { year: 2025, month: 3, day: 31 };
    const result = calculate30360(start, end);

    // Jan 31 -> 30, Mar 31 -> 30 (because d1 >= 30)
    // (3-1)*30 + (30-30) = 60
    expect(result.days).toBe(60);
  });

  test('should NOT apply EOM rule to end date without eomRule option', () => {
    const start = { year: 2025, month: 1, day: 31 };
    const end = { year: 2025, month: 2, day: 28 }; // End of Feb (non-leap)
    const result = calculate30360(start, end);

    // Without EOM rule: Jan 31 -> 30, Feb 28 stays 28
    // (2-1)*30 + (28-30) = 30 - 2 = 28
    expect(result.days).toBe(28);
  });

  test('should calculate 6 months correctly', () => {
    const start = { year: 2025, month: 1, day: 15 };
    const end = { year: 2025, month: 7, day: 15 };
    const result = calculate30360(start, end);

    // (7-1)*30 + (15-15) = 180
    expect(result.days).toBe(180);
    expect(result.yearFraction).toBe(0.5);
  });

  test('should treat Feb 28 as day 30 for start date (non-leap year)', () => {
    const start = { year: 2025, month: 2, day: 28 }; // End of Feb (non-leap)
    const end = { year: 2025, month: 3, day: 31 };
    const result = calculate30360(start, end);

    // Feb 28 -> 30, Mar 31 -> 30 (because d1 = 30)
    // (3-2)*30 + (30-30) = 30
    expect(result.days).toBe(30);
  });

  test('should treat Feb 29 as day 30 for start date (leap year)', () => {
    const start = { year: 2024, month: 2, day: 29 }; // End of Feb (leap)
    const end = { year: 2024, month: 3, day: 31 };
    const result = calculate30360(start, end);

    // Feb 29 -> 30, Mar 31 -> 30 (because d1 = 30)
    // (3-2)*30 + (30-30) = 30
    expect(result.days).toBe(30);
  });

  test('should treat Feb 28 as day 30 for end date with EOM rule', () => {
    const start = { year: 2025, month: 1, day: 31 };
    const end = { year: 2025, month: 2, day: 28 }; // End of Feb (non-leap)
    const result = calculate30360(start, end, { eomRule: true });

    // Jan 31 -> 30, Feb 28 -> 30 (with EOM rule)
    // (2-1)*30 + (30-30) = 30
    expect(result.days).toBe(30);
  });
});

describe('calculate30E360', () => {
  test('should adjust both dates if day is 31', () => {
    const start = { year: 2025, month: 1, day: 31 };
    const end = { year: 2025, month: 3, day: 31 };
    const result = calculate30E360(start, end);

    // Both 31 -> 30
    // (3-1)*30 + (30-30) = 60
    expect(result.days).toBe(60);
  });

  test('should adjust only end date if it is 31', () => {
    const start = { year: 2025, month: 1, day: 15 };
    const end = { year: 2025, month: 3, day: 31 };
    const result = calculate30E360(start, end);

    // End 31 -> 30
    // (3-1)*30 + (30-15) = 75
    expect(result.days).toBe(75);
  });

  test('should calculate full year as 360 days', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 };
    const result = calculate30E360(start, end);

    expect(result.days).toBe(360);
    expect(result.yearFraction).toBe(1.0);
  });

  test('should not adjust days less than 31', () => {
    const start = { year: 2025, month: 1, day: 15 };
    const end = { year: 2025, month: 2, day: 28 };
    const result = calculate30E360(start, end);

    // (2-1)*30 + (28-15) = 43
    expect(result.days).toBe(43);
  });
});

describe('calculateACTACTISDA', () => {
  test('should calculate within same non-leap year', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 1 }; // 181 days
    const result = calculateACTACTISDA(start, end);

    expect(result.days).toBe(181);
    expect(result.basis).toBe(365);
    expect(result.yearFraction).toBeCloseTo(181 / 365, 6);
  });

  test('should calculate within same leap year', () => {
    const start = { year: 2024, month: 1, day: 1 };
    const end = { year: 2024, month: 7, day: 1 }; // 182 days (includes Feb 29)
    const result = calculateACTACTISDA(start, end);

    expect(result.days).toBe(182);
    expect(result.basis).toBe(366);
    expect(result.yearFraction).toBeCloseTo(182 / 366, 6);
  });

  test('should split calculation across years', () => {
    const start = { year: 2024, month: 7, day: 1 }; // Leap year
    const end = { year: 2025, month: 7, day: 1 }; // Non-leap year
    const result = calculateACTACTISDA(start, end);

    // Total days: 184 (2024) + 181 (2025) = 365
    expect(result.days).toBe(365);

    // Year fractions: 184/366 (leap) + 181/365 (non-leap) ≈ 0.998...
    expect(result.yearFraction).toBeCloseTo(1.0, 2);
  });

  test('should handle multi-year period', () => {
    const start = { year: 2024, month: 1, day: 1 };
    const end = { year: 2026, month: 1, day: 1 };
    const result = calculateACTACTISDA(start, end);

    // 366 (2024 leap) + 365 (2025 non-leap) = 731 days
    expect(result.days).toBe(731);

    // Should be exactly 2.0 years
    expect(result.yearFraction).toBeCloseTo(2.0, 6);
  });
});

describe('calculateACTACTICMA', () => {
  test('should calculate with default semi-annual frequency', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 1 }; // ~182 days
    const result = calculateACTACTICMA(start, end);

    expect(result.days).toBe(181);
    // Default frequency = 2 (semi-annual)
    expect(result.basis).toBe(365);
    expect(result.yearFraction).toBeCloseTo(181 / 365, 2);
  });

  test('should calculate with annual frequency', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 1 };
    const result = calculateACTACTICMA(start, end, { frequency: 1 });

    expect(result.days).toBe(181);
    expect(result.basis).toBe(365);
  });

  test('should calculate with quarterly frequency', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 4, day: 1 }; // ~91 days
    const result = calculateACTACTICMA(start, end, { frequency: 4 });

    expect(result.days).toBe(90);
    // Approximate basis for quarterly
    expect(result.basis).toBeCloseTo(365, 0);
  });

  test('should throw error for invalid frequency', () => {
    const start = { year: 2025, month: 1, day: 1 };
    const end = { year: 2025, month: 7, day: 1 };

    expect(() => calculateACTACTICMA(start, end, { frequency: 0 })).toThrow('Frequency must be positive');
    expect(() => calculateACTACTICMA(start, end, { frequency: -1 })).toThrow('Frequency must be positive');
  });
});
