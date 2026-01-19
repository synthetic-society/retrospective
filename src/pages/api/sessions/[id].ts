import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, validateUUID, isSessionExpired } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';

export async function GET({ params, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid session ID', 400);

  const result = await getDB(locals)
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ expires_at?: string }>();
  if (!result) return errorResponse('Session not found', 404);
  if (isSessionExpired(result.expires_at)) return errorResponse('Session expired', 410);

  return jsonResponse(result);
}
