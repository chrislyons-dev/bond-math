import { describe, it, expect } from 'vitest';
import {
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createInternalErrorResponse,
  handleError,
} from '../src/errors';

describe('Errors Module', () => {
  describe('createUnauthorizedResponse', () => {
    it('should create 401 response with RFC 7807 format', async () => {
      const response = createUnauthorizedResponse('Invalid token');

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');

      const body = await response.json();
      expect(body.type).toContain('/errors/unauthorized');
      expect(body.title).toBe('Unauthorized');
      expect(body.status).toBe(401);
      expect(body.detail).toBe('Invalid token');
    });
  });

  describe('createForbiddenResponse', () => {
    it('should create 403 response', async () => {
      const response = createForbiddenResponse('Insufficient permissions');

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.title).toBe('Forbidden');
      expect(body.detail).toBe('Insufficient permissions');
    });
  });

  describe('createNotFoundResponse', () => {
    it('should create 404 response', async () => {
      const response = createNotFoundResponse('Service not found');

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.title).toBe('Not Found');
      expect(body.detail).toBe('Service not found');
    });
  });

  describe('createInternalErrorResponse', () => {
    it('should create 500 response', async () => {
      const response = createInternalErrorResponse('Database connection failed');

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBe('Database connection failed');
    });
  });

  describe('handleError', () => {
    it('should map invalid token error to 401', async () => {
      const error = new Error('Token is invalid');
      const response = handleError(error, '/api/test');

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.detail).toBe('Invalid authentication token');
    });

    it('should map expired token error to 401', async () => {
      const error = new Error('Token expired');
      const response = handleError(error);

      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.detail).toBe('Authentication token expired');
    });

    it('should map audience error to 403', async () => {
      const error = new Error('Invalid token audience');
      const response = handleError(error);

      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.detail).toBe('Invalid token audience');
    });

    it('should map issuer error to 403', async () => {
      const error = new Error('Invalid token issuer');
      const response = handleError(error);

      expect(response.status).toBe(403);
    });

    it('should handle unknown errors as 500', async () => {
      const error = new Error('Something unexpected happened');
      const response = handleError(error);

      expect(response.status).toBe(500);
    });

    it('should handle non-Error objects as 500', async () => {
      const error = 'string error';
      const response = handleError(error);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.detail).toBe('An unexpected error occurred');
    });
  });
});
