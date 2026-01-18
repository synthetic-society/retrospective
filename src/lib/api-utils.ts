import type { ZodError } from 'zod';

// Utility functions for API responses

export const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Error codes for consistent error handling
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR';

export const errorResponse = (message: string, status = 400, code?: ErrorCode) =>
  jsonResponse(
    {
      error: {
        message,
        code: code || (status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST'),
        status,
      },
    },
    status
  );

// Helper to format Zod validation errors
export const zodErrorResponse = (error: ZodError) =>
  errorResponse(error.issues[0]?.message || 'Validation failed', 400, 'VALIDATION_ERROR');

// Rate limit error response
export const rateLimitResponse = () =>
  errorResponse('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMITED');
