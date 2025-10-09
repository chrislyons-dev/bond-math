/**
 * Shared utilities for AAC extractors
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { AACAnnotations, PartialIR } from './types.js';

/**
 * Parse AAC annotations from JSDoc or docstring text
 */
export function parseAnnotations(text: string): AACAnnotations {
  const annotations: AACAnnotations = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match @tag value patterns
    const match = trimmed.match(/^[@*\s]*@(\w+(?:-\w+)*)\s+(.+)$/);
    if (!match) continue;

    const [, tag, value] = match;
    const cleanValue = value.trim();

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
        annotations.authentication = cleanValue;
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
        annotations.type = cleanValue as any;
        break;
      case 'layer':
        annotations.layer = cleanValue as any;
        break;
      case 'security-model':
        annotations.securityModel = cleanValue as any;
        break;
      case 'sla-tier':
        annotations.slaTier = cleanValue as any;
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
        annotations.cacheable = cleanValue.toLowerCase();
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
 */
export async function savePartialIR(filePath: string, data: PartialIR): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Load JSON file
 */
export async function loadJSON<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
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
