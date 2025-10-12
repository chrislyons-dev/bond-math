/**
 * Request validation utilities for day-count service
 *
 * @module validators
 */

import type { DayCountRequest, DayCountConvention } from './types';

/**
 * Validation error with field context
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validator function signature
 */
export type Validator = (body: unknown) => ValidationError | null;

/**
 * Validates that body has a pairs array
 */
export const validatePairsExists: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (!req.pairs || !Array.isArray(req.pairs) || req.pairs.length === 0) {
    return {
      field: 'pairs',
      message: 'Required field: must be non-empty array',
    };
  }
  return null;
};

/**
 * Validates pairs array length to prevent DoS
 */
export const validatePairsLength: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (req.pairs && req.pairs.length > 1000) {
    return {
      field: 'pairs',
      message: 'Maximum 1000 pairs per request',
    };
  }
  return null;
};

/**
 * Validates that convention field exists
 */
export const validateConventionExists: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (!req.convention) {
    return {
      field: 'convention',
      message: 'Required field',
    };
  }
  return null;
};

/**
 * Validates that convention is a string
 */
export const validateConventionType: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (req.convention && typeof req.convention !== 'string') {
    return {
      field: 'convention',
      message: 'Must be a string value',
    };
  }
  return null;
};

/**
 * Validates that options is an object (not array)
 */
export const validateOptionsType: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (req.options && (typeof req.options !== 'object' || Array.isArray(req.options))) {
    return {
      field: 'options',
      message: 'Must be an object with optional eomRule and frequency',
    };
  }
  return null;
};

/**
 * Validates eomRule is a boolean
 */
export const validateEomRuleType: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (req.options?.eomRule !== undefined && typeof req.options.eomRule !== 'boolean') {
    return {
      field: 'options.eomRule',
      message: 'Must be a boolean value',
    };
  }
  return null;
};

/**
 * Validates frequency is a positive number
 */
export const validateFrequency: Validator = (body: unknown) => {
  const req = body as DayCountRequest;
  if (req.options?.frequency !== undefined) {
    if (typeof req.options.frequency !== 'number' || req.options.frequency <= 0) {
      return {
        field: 'options.frequency',
        message: 'Must be a positive number',
      };
    }
  }
  return null;
};

/**
 * Validates date pair structure (both start and end are strings)
 */
export const validatePairStructure = (pair: unknown, index: number): ValidationError | null => {
  const p = pair as { start?: unknown; end?: unknown };
  if (!p || typeof p.start !== 'string' || typeof p.end !== 'string') {
    return {
      field: `pairs[${index}]`,
      message: 'Start and end must be string dates in YYYY-MM-DD format',
    };
  }
  return null;
};

/**
 * Validates and normalizes a day-count convention string
 */
export function normalizeConvention(convention: string): DayCountConvention {
  const normalized = convention.toUpperCase().replace(/\//g, '_');

  const supportedConventions: DayCountConvention[] = [
    '30_360',
    '30E_360',
    'ACT_360',
    'ACT_365F',
    'ACT_ACT_ISDA',
    'ACT_ACT_ICMA',
  ];

  if (supportedConventions.includes(normalized as DayCountConvention)) {
    return normalized as DayCountConvention;
  }

  throw new Error(`Unsupported convention: ${convention}`);
}

/**
 * Request-level validators (run once per request)
 */
export const requestValidators: Validator[] = [
  validatePairsExists,
  validatePairsLength,
  validateConventionExists,
  validateConventionType,
  validateOptionsType,
  validateEomRuleType,
  validateFrequency,
];

/**
 * Runs all validators and returns first error found
 */
export function validateRequest(body: unknown): ValidationError | null {
  for (const validator of requestValidators) {
    const error = validator(body);
    if (error) {
      return error;
    }
  }
  return null;
}
