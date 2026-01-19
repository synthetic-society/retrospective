import type { APIContext } from 'astro';
import {
  jsonResponse,
  errorResponse,
  zodErrorResponse,
  validateUUID,
  isSessionExpired,
  parseJsonBody,
} from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { CreateCardSchema, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../../../lib/schemas';

type Session = { id: string; expires_at?: string };

const getValidSession = async (db: ReturnType<typeof getDB>, id: string) => {
  const session = await db.prepare('SELECT id, expires_at FROM sessions WHERE id = ?').bind(id).first<Session>();
  if (!session) return { error: errorResponse('Session not found', 404) };
  if (isSessionExpired(session.expires_at)) return { error: errorResponse('Session expired', 410) };
  return { session };
};

const parseLimit = (param: string | null) =>
  Math.min(Math.max(1, parseInt(param || '', 10) || DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);

export async function GET({ params, url, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid session ID', 400);

  const db = getDB(locals);
  const { error } = await getValidSession(db, id);
  if (error) return error;

  const result = await db
    .prepare('SELECT * FROM cards WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
    .bind(id, parseLimit(url.searchParams.get('limit')))
    .all();
  return jsonResponse(result.results || [], 200, 1); // 1s cache with stale-while-revalidate
}

export async function POST({ params, request, locals }: APIContext) {
  const { id: session_id } = params;
  if (!validateUUID(session_id)) return errorResponse('Invalid session ID', 400);

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const parsed = CreateCardSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const { error } = await getValidSession(db, session_id);
  if (error) return error;

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const { column_type, content } = parsed.data;

  await db
    .prepare('INSERT INTO cards (id, session_id, column_type, content, votes, created_at) VALUES (?, ?, ?, ?, 0, ?)')
    .bind(id, session_id, column_type, content, created_at)
    .run();

  return jsonResponse({ id, session_id, column_type, content, votes: 0, created_at }, 201);
}
