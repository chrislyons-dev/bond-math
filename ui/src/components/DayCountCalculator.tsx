import { useState } from 'react';
import type {
  DatePair,
  DayCountConvention,
  DayCountResult,
  DayCountResponse,
} from '@lib/api/client';
import { calculateDayCount, ApiError } from '@lib/api/client';
import { isValidDate, isValidDateRange, getToday, getDaysFromToday } from '@lib/utils/validation';

/**
 * DayCountCalculator - Interactive calculator for day count conventions
 *
 * Features:
 * - Multiple date pairs support
 * - Real-time validation
 * - Error handling with user feedback
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Responsive design
 */
export default function DayCountCalculator() {
  const [pairs, setPairs] = useState<DatePair[]>([
    { start: getToday(), end: getDaysFromToday(180) },
  ]);
  const [convention, setConvention] = useState<DayCountConvention>('ACT_360');
  const [results, setResults] = useState<DayCountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const conventions: Array<{ value: DayCountConvention; label: string; description: string }> = [
    { value: 'ACT_360', label: 'ACT/360', description: 'Actual/360 - Money market' },
    { value: 'ACT_365F', label: 'ACT/365F', description: 'Actual/365 Fixed' },
    { value: '30_360', label: '30/360', description: 'U.S. 30/360 Bond Basis' },
    { value: '30E_360', label: '30E/360', description: 'European 30E/360' },
    { value: 'ACT_ACT_ISDA', label: 'ACT/ACT ISDA', description: 'Actual/Actual ISDA' },
    { value: 'ACT_ACT_ICMA', label: 'ACT/ACT ICMA', description: 'Actual/Actual ICMA' },
  ];

  const handleAddPair = () => {
    setPairs([...pairs, { start: getToday(), end: getDaysFromToday(180) }]);
  };

  const handleRemovePair = (index: number) => {
    if (pairs.length > 1) {
      setPairs(pairs.filter((_, i) => i !== index));
      // Clear field errors for removed pair
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[`pairs[${index}].start`];
      delete newFieldErrors[`pairs[${index}].end`];
      setFieldErrors(newFieldErrors);
    }
  };

  const handlePairChange = (index: number, field: 'start' | 'end', value: string) => {
    const newPairs = [...pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setPairs(newPairs);

    // Clear field error when user types
    const errorKey = `pairs[${index}].${field}`;
    if (fieldErrors[errorKey]) {
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[errorKey];
      setFieldErrors(newFieldErrors);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    pairs.forEach((pair, index) => {
      if (!isValidDate(pair.start)) {
        errors[`pairs[${index}].start`] = 'Invalid date format (use YYYY-MM-DD)';
      }
      if (!isValidDate(pair.end)) {
        errors[`pairs[${index}].end`] = 'Invalid date format (use YYYY-MM-DD)';
      }
      if (isValidDate(pair.start) && isValidDate(pair.end)) {
        if (!isValidDateRange(pair.start, pair.end)) {
          errors[`pairs[${index}].end`] = 'End date must be after start date';
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await calculateDayCount({
        pairs,
        convention,
      });
      setResults(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.errors) {
          const errors: Record<string, string> = {};
          err.errors.forEach((e) => {
            if (e.field) {
              errors[e.field] = e.message;
            }
          });
          setFieldErrors(errors);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Calculator Form */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Day Count Calculator
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Calculate year fractions and accrual days using various day count conventions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Convention Selection */}
          <div>
            <label htmlFor="convention" className="label">
              Day Count Convention
            </label>
            <select
              id="convention"
              value={convention}
              onChange={(e) => setConvention(e.target.value as DayCountConvention)}
              className="input"
              required
            >
              {conventions.map((conv) => (
                <option key={conv.value} value={conv.value}>
                  {conv.label} - {conv.description}
                </option>
              ))}
            </select>
          </div>

          {/* Date Pairs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold text-gray-900 dark:text-white">
                Date Pairs
              </label>
              <button
                type="button"
                onClick={handleAddPair}
                className="btn btn-secondary text-sm"
                aria-label="Add date pair"
              >
                + Add Pair
              </button>
            </div>

            <div className="space-y-4">
              {pairs.map((pair, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Pair {index + 1}
                    </h3>
                    {pairs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePair(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                        aria-label={`Remove pair ${index + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`start-${index}`} className="label">
                        Start Date
                      </label>
                      <input
                        type="date"
                        id={`start-${index}`}
                        value={pair.start}
                        onChange={(e) => handlePairChange(index, 'start', e.target.value)}
                        className="input"
                        required
                        aria-invalid={!!fieldErrors[`pairs[${index}].start`]}
                        aria-describedby={
                          fieldErrors[`pairs[${index}].start`]
                            ? `start-${index}-error`
                            : undefined
                        }
                      />
                      {fieldErrors[`pairs[${index}].start`] && (
                        <p id={`start-${index}-error`} className="error-text" role="alert">
                          {fieldErrors[`pairs[${index}].start`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor={`end-${index}`} className="label">
                        End Date
                      </label>
                      <input
                        type="date"
                        id={`end-${index}`}
                        value={pair.end}
                        onChange={(e) => handlePairChange(index, 'end', e.target.value)}
                        className="input"
                        required
                        aria-invalid={!!fieldErrors[`pairs[${index}].end`]}
                        aria-describedby={
                          fieldErrors[`pairs[${index}].end`] ? `end-${index}-error` : undefined
                        }
                      />
                      {fieldErrors[`pairs[${index}].end`] && (
                        <p id={`end-${index}-error`} className="error-text" role="alert">
                          {fieldErrors[`pairs[${index}].end`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              role="alert"
            >
              <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full md:w-auto"
          >
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </form>
      </div>

      {/* Results */}
      {results && (
        <div className="card p-6 animate-slide-in">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Results</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Convention: <span className="font-mono font-medium">{results.convention}</span> •
            Service Version: <span className="font-mono">{results.version}</span>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Pair
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Days
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Year Fraction
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Basis
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((result: DayCountResult, index: number) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                      {pairs[index]?.start} → {pairs[index]?.end}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                      {result.days}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                      {result.yearFraction.toFixed(8)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                      {result.basis}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
