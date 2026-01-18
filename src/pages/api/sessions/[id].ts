import type { APIContext } from 'astro';
import { jsonResponse, errorResponse } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';

// GET /api/sessions/[id] - Get session by ID
export async function GET({ params, locals }: APIContext) {
  const db = getDB(locals);
  const { id } = params;

  const result = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();

  if (!result) {
    return errorResponse('Session not found', 404);
  }

  return jsonResponse(result);
}
