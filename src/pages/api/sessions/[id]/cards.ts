import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { CreateCardSchema } from '../../../../lib/schemas';

// GET /api/sessions/[id]/cards - Get all cards for a session
export async function GET({ params, locals }: APIContext) {
  const db = getDB(locals);
  const { id } = params;

  const result = await db
    .prepare('SELECT * FROM cards WHERE session_id = ? ORDER BY created_at ASC')
    .bind(id)
    .all();

  return jsonResponse(result.results || []);
}

// POST /api/sessions/[id]/cards - Create a new card
export async function POST({ params, request, locals }: APIContext) {
  const db = getDB(locals);
  const { id: session_id } = params;
  const body = await request.json();

  // Validate input with Zod
  const parsed = CreateCardSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { column_type, content } = parsed.data;

  // Check if session exists
  const session = await db.prepare('SELECT id FROM sessions WHERE id = ?').bind(session_id).first();

  if (!session) {
    return errorResponse('Session not found', 404);
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO cards (id, session_id, column_type, content, votes, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    )
    .bind(id, session_id, column_type, content, created_at)
    .run();

  return jsonResponse({ id, session_id, column_type, content, votes: 0, created_at }, 201);
}
