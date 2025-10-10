/**
 * Shared utilities for AAC extractors
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { AACAnnotations, PartialIR } from './types.js';

/**
 * Parse AAC annotations from JSDoc or docstring text
 * @param text - Comment text containing AAC annotations
 * @returns Parsed annotations object
 * @throws {Error} If text is not a string
 */
export function parseAnnotations(text: string): AACAnnotations {
  if (typeof text !== 'string') {
    throw new Error('text must be a string');
  }

  const annotations: AACAnnotations = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match @tag or @tag value patterns
    const match = trimmed.match(/^[@*\s]*@(\w+(?:-\w+)*)(?:\s+(.+))?$/);
    if (!match) continue;

    const [, tag, value] = match;
    const cleanValue = value?.trim() || '';

    switch (tag) {
      case 'service':
        annotations.service = cleanValue;
        break;
      case 'owner':
        annotations.owner = cleanValue;
        break;
      case 'description':
        annotations.description = cleanValue;
        break;
      case 'endpoint':
        annotations.endpoint = cleanValue;
        break;
      case 'gateway-route':
        annotations.gatewayRoute = cleanValue;
        break;
      case 'authentication':
        annotations.authentication = cleanValue as AACAnnotations['authentication'];
        break;
      case 'scope':
        annotations.scope = cleanValue;
        break;
      case 'rate-limit':
        annotations.rateLimit = cleanValue;
        break;
      case 'service-binding':
        annotations.serviceBinding = cleanValue;
        break;
      case 'target':
        annotations.target = cleanValue;
        break;
      case 'purpose':
        annotations.purpose = cleanValue;
        break;

      case 'type':
        annotations.type = cleanValue as AACAnnotations['type'];
        break;
      case 'layer':
        annotations.layer = cleanValue as AACAnnotations['layer'];
        break;
      case 'security-model':
        annotations.securityModel = cleanValue as AACAnnotations['securityModel'];
        break;
      case 'sla-tier':
        annotations.slaTier = cleanValue as AACAnnotations['slaTier'];
        break;

      case 'internal-routes':
        annotations.internalRoutes = cleanValue;
        break;
      case 'public-routes':
        annotations.publicRoutes = cleanValue;
        break;
      case 'dependencies':
        annotations.dependencies = cleanValue;
        break;

      case 'cacheable':
        annotations.cacheable = cleanValue.toLowerCase() as AACAnnotations['cacheable'];
        break;

      case 'cache-ttl':
        annotations.cacheTtl = cleanValue;
        break;

      case 'exclude-from-diagram':
        annotations.excludeFromDiagram = true;
        break;
    }
  }

  return annotations;
}

/**
 * Convert kebab-case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Parse comma-separated list from annotation value
 */
export function parseList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== 'none');
}

/**
 * Save partial IR to JSON file
 * @throws {Error} If file cannot be written
 */
export async function savePartialIR(filePath: string, data: PartialIR): Promise<void> {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be a non-empty string');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('data must be a valid PartialIR object');
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    throw new Error(`Failed to save IR to ${filePath}: ${error.message}`);
  }
}

/**
 * Load JSON file
 * @throws {Error} If file cannot be read or JSON is invalid
 */
export async function loadJSON<T>(filePath: string): Promise<T> {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be a non-empty string');
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to load JSON from ${filePath}: ${error.message}`);
  }
}

/**
 * Deterministic sort for arrays to prevent diff churn
 */
export function sortServices<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortRelationships<T extends { source: string; destination: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const sourceCompare = a.source.localeCompare(b.source);
    if (sourceCompare !== 0) return sourceCompare;
    return a.destination.localeCompare(b.destination);
  });
}

export function sortComponents<T extends { serviceId: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const serviceCompare = a.serviceId.localeCompare(b.serviceId);
    if (serviceCompare !== 0) return serviceCompare;
    return a.id.localeCompare(b.id);
  });
}

export function sortComponentRelationships<T extends { source: string; destination: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const sourceCompare = a.source.localeCompare(b.source);
    if (sourceCompare !== 0) return sourceCompare;
    return a.destination.localeCompare(b.destination);
  });
}

/**
 * Logging utilities
 */
export const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  success: (message: string) => console.log(`[SUCCESS] ${message}`),
};
