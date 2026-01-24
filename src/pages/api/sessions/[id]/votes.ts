import type { APIContext } from 'astro';
import {
  jsonResponse,
  errorResponse,
  zodErrorResponse,
  validateUUID,
  isSessionExpired,
} from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { VoterIdSchema } from '../../../../lib/schemas';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../../../lib/constants';

export async function GET({ params, url, locals }: APIContext) {
  const { id: session_id } = params;
  if (!validateUUID(session_id)) return errorResponse('Invalid session ID', 400);

  const parsed = VoterIdSchema.safeParse({ voter_id: url.searchParams.get('voter_id') });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const session = await db
    .prepare('SELECT expires_at FROM sessions WHERE id = ?')
    .bind(session_id)
    .first<{ expires_at?: string }>();
  if (!session) return errorResponse('Session not found', 404);
  if (isSessionExpired(session.expires_at)) return errorResponse('Session expired', 410);

  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get('limit') || '', 10) || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT
  );
  const result = await db
    .prepare(
      `SELECT v.card_id FROM votes v JOIN cards c ON c.id = v.card_id WHERE c.session_id = ? AND v.voter_id = ? LIMIT ${limit}`
    )
    .bind(session_id, parsed.data.voter_id)
    .all();

  return jsonResponse((result.results || []).map((r: any) => r.card_id), 200, 1); // 1s cache with stale-while-revalidate
}
