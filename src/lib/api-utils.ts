import type { ZodError } from 'zod';
import { UUIDSchema } from './schemas';
import { MAX_REQUEST_BODY_SIZE } from './constants';

// Response helpers
export const jsonResponse = (data: unknown, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(cacheSeconds > 0 && {
        'Cache-Control': `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      }),
    },
  });

export const errorResponse = (message: string, status = 400) => jsonResponse({ error: { message, status } }, status);

export const zodErrorResponse = (error: ZodError) =>
  errorResponse(error.issues[0]?.message || 'Validation failed', 400);

// Validation helpers
export const validateUUID = (id: string | undefined): id is string => !!id && UUIDSchema.safeParse(id).success;

export const isSessionExpired = (expiresAt: string | null | undefined) =>
  !!expiresAt && new Date(expiresAt) < new Date();

// Parse JSON body with size limit
export async function parseJsonBody(request: Request): Promise<{ data?: unknown; error?: Response }> {
  const len = request.headers.get('content-length');
  if (len && parseInt(len, 10) > MAX_REQUEST_BODY_SIZE) {
    return { error: errorResponse('Request body too large', 413) };
  }
  try {
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY_SIZE) return { error: errorResponse('Request body too large', 413) };
    return { data: JSON.parse(text) };
  } catch {
    return { error: errorResponse('Invalid JSON body') };
  }
}
