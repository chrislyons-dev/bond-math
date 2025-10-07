/**
 * Structured JSON logger for Day Count Worker
 * Implements ADR-0013: Structured Logging Standards using hono-pino
 *
 * @module logger
 */

import { pino } from 'pino';
import type { Logger as PinoLogger } from 'pino';

/**
 * Create a configured pino logger for Day Count service
 *
 * @returns Configured pino logger instance
 */
export function createLogger(): PinoLogger {
  return pino({
    level: 'info',
    base: {
      service: 'daycount',
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  });
}

// Export default logger instance
export const logger = createLogger();
