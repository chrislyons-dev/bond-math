import { describe, it, expect } from 'vitest';
import { findServiceRoute, getServiceIdentifier } from '../src/router';

describe('Router Module', () => {
  describe('findServiceRoute', () => {
    it('should find daycount service route', () => {
      const route = findServiceRoute('/api/daycount/v1/count');

      expect(route).toBeTruthy();
      expect(route?.prefix).toBe('/api/daycount');
      expect(route?.binding).toBe('SVC_DAYCOUNT');
    });

    it('should find valuation service route', () => {
      const route = findServiceRoute('/api/valuation/v1/price');

      expect(route).toBeTruthy();
      expect(route?.prefix).toBe('/api/valuation');
      expect(route?.binding).toBe('SVC_VALUATION');
    });

    it('should find metrics service route', () => {
      const route = findServiceRoute('/api/metrics/v1/duration');

      expect(route).toBeTruthy();
      expect(route?.prefix).toBe('/api/metrics');
      expect(route?.binding).toBe('SVC_METRICS');
    });

    it('should find pricing service route', () => {
      const route = findServiceRoute('/api/pricing/v1/value');

      expect(route).toBeTruthy();
      expect(route?.prefix).toBe('/api/pricing');
      expect(route?.binding).toBe('SVC_PRICING');
    });

    it('should return null for unknown route', () => {
      const route = findServiceRoute('/api/unknown/endpoint');

      expect(route).toBeNull();
    });

    it('should return null for non-API route', () => {
      const route = findServiceRoute('/health');

      expect(route).toBeNull();
    });
  });

  describe('getServiceIdentifier', () => {
    it('should convert binding name to service identifier', () => {
      const route = findServiceRoute('/api/daycount/v1/count');

      expect(route).toBeTruthy();
      const identifier = getServiceIdentifier(route!);

      expect(identifier).toBe('svc-daycount');
    });

    it('should handle all service bindings correctly', () => {
      const routes = [
        { path: '/api/daycount/v1/count', expected: 'svc-daycount' },
        { path: '/api/valuation/v1/price', expected: 'svc-valuation' },
        { path: '/api/metrics/v1/duration', expected: 'svc-metrics' },
        { path: '/api/pricing/v1/value', expected: 'svc-pricing' },
      ];

      routes.forEach(({ path, expected }) => {
        const route = findServiceRoute(path);
        expect(route).toBeTruthy();
        expect(getServiceIdentifier(route!)).toBe(expected);
      });
    });
  });
});
