import type { APIContext, APIRoute } from 'astro';
import * as v from 'valibot';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, MAX_REQUEST_BODY_SIZE } from './constants';
import { UUIDSchema } from './schemas';

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

export const validationErrorResponse = (issues: v.BaseIssue<unknown>[]) =>
  errorResponse(issues[0]?.message || 'Validation failed', 400);

// Validation helpers
const validateUUID = (id: string | undefined): id is string => !!id && v.safeParse(UUIDSchema, id).success;

const isSessionExpired = (expiresAt: string | null | undefined) => !!expiresAt && new Date(expiresAt) < new Date();

// Parse JSON body with size limit
async function parseJsonBody(request: Request): Promise<{ data?: unknown; error?: Response }> {
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

// Clamp a page-limit query param into [1, MAX_PAGE_LIMIT], defaulting when absent/invalid
export const parseLimit = (param: string | null) =>
  Math.min(Math.max(1, parseInt(param || '', 10) || DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);

// Load a session and enforce existence + expiry, returning either the row or an error Response
export const getValidSession = async (db: D1Database, id: string) => {
  const session = await db
    .prepare('SELECT id, name, created_at, expires_at FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ id: string; name: string; created_at: string; expires_at?: string }>();
  if (!session) return { error: errorResponse('Session not found', 404) };
  if (isSessionExpired(session.expires_at)) return { error: errorResponse('Session expired', 410) };
  return { session };
};

// Route wrapper: validates the UUID `id` param and/or parses+validates the JSON body,
// then hands the handler the typed values. Error responses are byte-identical to inline checks.
type RouteData<S> = S extends v.GenericSchema ? v.InferOutput<S> : undefined;

export function defineRoute<S extends v.GenericSchema | undefined = undefined>(
  options: { invalidIdMessage?: string; schema?: S },
  handler: (args: { ctx: APIContext; id: string; data: RouteData<S> }) => Promise<Response>,
): APIRoute {
  return async (ctx) => {
    let id = '';
    if (options.invalidIdMessage !== undefined) {
      if (!validateUUID(ctx.params.id)) return errorResponse(options.invalidIdMessage, 400);
      id = ctx.params.id;
    }
    let data: unknown;
    if (options.schema) {
      const { data: body, error } = await parseJsonBody(ctx.request);
      if (error) return error;
      const parsed = v.safeParse(options.schema, body);
      if (!parsed.success) return validationErrorResponse(parsed.issues);
      data = parsed.output;
    }
    return handler({ ctx, id, data: data as RouteData<S> });
  };
}
