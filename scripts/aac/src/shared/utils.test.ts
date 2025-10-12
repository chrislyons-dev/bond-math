/**
 * Tests for utils.ts
 */

import { describe, it, expect } from 'vitest';
import { parseAnnotations, parseList, sortServices, sortRelationships } from './utils.js';
import type { Service, Relationship } from './types.js';

describe('parseAnnotations', () => {
  it('should parse @service annotation', () => {
    const text = `/**
     * @service gateway
     * @type cloudflare-worker-typescript
     */`;

    const result = parseAnnotations(text);

    expect(result.service).toBe('gateway');
    expect(result.type).toBe('cloudflare-worker-typescript');
  });

  it('should parse @description annotation', () => {
    const text = `/**
     * @description Entry point for all API traffic
     */`;

    const result = parseAnnotations(text);

    expect(result.description).toBe('Entry point for all API traffic');
  });

  it('should parse @endpoint annotation', () => {
    const text = `/**
     * @endpoint POST /health
     * @authentication internal-jwt
     * @scope health:read
     */`;

    const result = parseAnnotations(text);

    expect(result.endpoint).toBe('POST /health');
    expect(result.authentication).toBe('internal-jwt');
    expect(result.scope).toBe('health:read');
  });

  it('should parse @exclude-from-diagram annotation', () => {
    const text = `/**
     * @exclude-from-diagram
     */`;

    const result = parseAnnotations(text);

    expect(result.excludeFromDiagram).toBe(true);
  });

  it('should handle cacheable boolean', () => {
    const text = `/**
     * @cacheable true
     * @cache-ttl 3600
     */`;

    const result = parseAnnotations(text);

    expect(result.cacheable).toBe('true');
    expect(result.cacheTtl).toBe('3600');
  });

  it('should throw on non-string input', () => {
    expect(() => parseAnnotations(null as unknown as string)).toThrow('text must be a string');
    expect(() => parseAnnotations(123 as unknown as string)).toThrow('text must be a string');
    expect(() => parseAnnotations(undefined as unknown as string)).toThrow('text must be a string');
  });

  it('should return empty object for text with no annotations', () => {
    const text = '// Just a regular comment';
    const result = parseAnnotations(text);
    expect(result).toEqual({});
  });
});

describe('parseList', () => {
  it('should parse comma-separated list', () => {
    const result = parseList('svc-pricing, svc-daycount, svc-valuation');
    expect(result).toEqual(['svc-pricing', 'svc-daycount', 'svc-valuation']);
  });

  it('should trim whitespace', () => {
    const result = parseList('  item1  ,  item2  ,  item3  ');
    expect(result).toEqual(['item1', 'item2', 'item3']);
  });

  it('should filter out "none"', () => {
    const result = parseList('none');
    expect(result).toEqual([]);
  });

  it('should filter out empty strings', () => {
    const result = parseList('item1,,item2,  ,item3');
    expect(result).toEqual(['item1', 'item2', 'item3']);
  });

  it('should return undefined for undefined input', () => {
    const result = parseList(undefined);
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const result = parseList('');
    expect(result).toBeUndefined();
  });
});

describe('sortServices', () => {
  it('should sort services alphabetically by id', () => {
    const services: Partial<Service>[] = [{ id: 'metrics' }, { id: 'gateway' }, { id: 'daycount' }];

    const result = sortServices(services as Service[]);

    expect(result.map((s) => s.id)).toEqual(['daycount', 'gateway', 'metrics']);
  });

  it('should not mutate original array', () => {
    const services: Partial<Service>[] = [{ id: 'metrics' }, { id: 'gateway' }];

    const original = [...services];
    sortServices(services as Service[]);

    expect(services).toEqual(original);
  });

  it('should handle empty array', () => {
    const result = sortServices([]);
    expect(result).toEqual([]);
  });
});

describe('sortRelationships', () => {
  it('should sort relationships by source, then destination', () => {
    const relationships: Partial<Relationship>[] = [
      { source: 'gateway', destination: 'metrics' },
      { source: 'gateway', destination: 'daycount' },
      { source: 'api', destination: 'gateway' },
    ];

    const result = sortRelationships(relationships as Relationship[]);

    expect(result.map((r) => `${r.source}->${r.destination}`)).toEqual([
      'api->gateway',
      'gateway->daycount',
      'gateway->metrics',
    ]);
  });

  it('should not mutate original array', () => {
    const relationships: Partial<Relationship>[] = [
      { source: 'b', destination: 'y' },
      { source: 'a', destination: 'x' },
    ];

    const original = [...relationships];
    sortRelationships(relationships as Relationship[]);

    expect(relationships).toEqual(original);
  });

  it('should handle empty array', () => {
    const result = sortRelationships([]);
    expect(result).toEqual([]);
  });
});
