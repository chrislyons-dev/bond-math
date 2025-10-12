/**
 * Tests for validate.ts
 */

import { describe, it, expect } from 'vitest';
import { validateRelationships } from './index.js';
import type { AACIR, Service, Relationship } from '../shared/types.js';

// Helper to create test IR
function createTestIR(services: Service[], relationships: Relationship[]): AACIR {
  return {
    version: '1.0',
    project: { name: 'test-project', description: 'Test project' },
    services,
    relationships,
    deploymentEnvironments: [],
  };
}

describe('validateRelationships', () => {
  it('should pass validation for valid relationships', () => {
    const ir = createTestIR(
      [
        {
          id: 'gateway',
          name: 'Gateway',
          type: 'cloudflare-worker-typescript',
          layer: 'api-gateway',
          description: 'Gateway',
        },
        {
          id: 'daycount',
          name: 'Daycount',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'Daycount',
        },
      ] as Service[],
      [
        { source: 'gateway', destination: 'daycount', protocol: 'service-binding' },
      ] as Relationship[]
    );

    const result = validateRelationships(ir);

    expect(result).toBe(true);
  });

  it('should detect unknown source service', () => {
    const ir = createTestIR(
      [
        {
          id: 'gateway',
          name: 'Gateway',
          type: 'cloudflare-worker-typescript',
          layer: 'api-gateway',
          description: 'Gateway',
        },
      ] as Service[],
      [{ source: 'unknown-service', destination: 'gateway', protocol: 'https' }] as Relationship[]
    );

    const result = validateRelationships(ir);

    expect(result).toBe(false);
  });

  it('should detect unknown destination service', () => {
    const ir = createTestIR(
      [
        {
          id: 'gateway',
          name: 'Gateway',
          type: 'cloudflare-worker-typescript',
          layer: 'api-gateway',
          description: 'Gateway',
        },
      ] as Service[],
      [{ source: 'gateway', destination: 'unknown-service', protocol: 'https' }] as Relationship[]
    );

    const result = validateRelationships(ir);

    expect(result).toBe(false);
  });

  it('should detect circular dependencies', () => {
    const ir = createTestIR(
      [
        {
          id: 'a',
          name: 'A',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'A',
        },
        {
          id: 'b',
          name: 'B',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'B',
        },
        {
          id: 'c',
          name: 'C',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'C',
        },
      ] as Service[],
      [
        { source: 'a', destination: 'b', protocol: 'service-binding' },
        { source: 'b', destination: 'c', protocol: 'service-binding' },
        { source: 'c', destination: 'a', protocol: 'service-binding' }, // Creates cycle
      ] as Relationship[]
    );

    const result = validateRelationships(ir);

    expect(result).toBe(false);
  });

  it('should pass for empty relationships', () => {
    const ir = createTestIR(
      [
        {
          id: 'gateway',
          name: 'Gateway',
          type: 'cloudflare-worker-typescript',
          layer: 'api-gateway',
          description: 'Gateway',
        },
      ] as Service[],
      []
    );

    const result = validateRelationships(ir);

    expect(result).toBe(true);
  });

  it('should throw on invalid IR structure (not an object)', () => {
    expect(() => validateRelationships(null as unknown as AACIR)).toThrow(
      'ir must be a valid AACIR object'
    );
    expect(() => validateRelationships(undefined as unknown as AACIR)).toThrow(
      'ir must be a valid AACIR object'
    );
    expect(() => validateRelationships('string' as unknown as AACIR)).toThrow(
      'ir must be a valid AACIR object'
    );
  });

  it('should throw on invalid IR structure (missing services array)', () => {
    const ir = {
      relationships: [],
      deploymentEnvironments: [],
    } as unknown as AACIR;

    expect(() => validateRelationships(ir)).toThrow('ir.services must be an array');
  });

  it('should throw on invalid IR structure (missing relationships array)', () => {
    const ir = {
      services: [],
      deploymentEnvironments: [],
    } as unknown as AACIR;

    expect(() => validateRelationships(ir)).toThrow('ir.relationships must be an array');
  });

  it('should handle self-referencing service (no cycle)', () => {
    const ir = createTestIR(
      [
        {
          id: 'a',
          name: 'A',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'A',
        },
      ] as Service[],
      [{ source: 'a', destination: 'a', protocol: 'service-binding' }] as Relationship[]
    );

    // Self-reference should be detected as a cycle
    const result = validateRelationships(ir);

    expect(result).toBe(false);
  });

  it('should pass for complex valid dependency graph', () => {
    const ir = createTestIR(
      [
        {
          id: 'gateway',
          name: 'Gateway',
          type: 'cloudflare-worker-typescript',
          layer: 'api-gateway',
          description: 'Gateway',
        },
        {
          id: 'daycount',
          name: 'Daycount',
          type: 'cloudflare-worker-typescript',
          layer: 'business-logic',
          description: 'Daycount',
        },
        {
          id: 'valuation',
          name: 'Valuation',
          type: 'cloudflare-worker-python',
          layer: 'business-logic',
          description: 'Valuation',
        },
        {
          id: 'metrics',
          name: 'Metrics',
          type: 'cloudflare-worker-python',
          layer: 'business-logic',
          description: 'Metrics',
        },
      ] as Service[],
      [
        { source: 'gateway', destination: 'daycount', protocol: 'service-binding' },
        { source: 'gateway', destination: 'valuation', protocol: 'service-binding' },
        { source: 'gateway', destination: 'metrics', protocol: 'service-binding' },
        { source: 'valuation', destination: 'daycount', protocol: 'service-binding' },
        { source: 'metrics', destination: 'daycount', protocol: 'service-binding' },
      ] as Relationship[]
    );

    const result = validateRelationships(ir);

    expect(result).toBe(true);
  });
});
