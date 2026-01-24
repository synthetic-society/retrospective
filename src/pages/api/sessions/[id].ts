import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, validateUUID, isSessionExpired, zodErrorResponse } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { DeleteSessionSchema } from '../../../lib/schemas';

export async function GET({ params, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid session ID', 400);

  const result = await getDB(locals)
    .prepare('SELECT id, name, created_at, expires_at FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ expires_at?: string }>();
  if (!result) return errorResponse('Session not found', 404);
  if (isSessionExpired(result.expires_at)) return errorResponse('Session expired', 410);

  return jsonResponse(result, 200, 1); // 1s cache with stale-while-revalidate
}

export async function DELETE({ params, locals, url }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid session ID', 400);

  const parsed = DeleteSessionSchema.safeParse({ admin_token: url.searchParams.get('admin_token') });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const session = await db
    .prepare('SELECT id, admin_token FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ id: string; admin_token: string }>();

  if (!session) return errorResponse('Session not found', 404);
  if (session.admin_token !== parsed.data.admin_token) {
    return errorResponse('Forbidden', 403);
  }

  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}
