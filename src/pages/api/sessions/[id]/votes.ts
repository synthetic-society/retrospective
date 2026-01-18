import type { APIContext } from 'astro';
import { jsonResponse, errorResponse } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';

// GET /api/sessions/[id]/votes?voter_id=xxx - Get all card IDs this user voted on
export async function GET({ params, url, locals }: APIContext) {
  const db = getDB(locals);
  const { id: session_id } = params;
  const voter_id = url.searchParams.get('voter_id');

  if (!voter_id) {
    return errorResponse('voter_id is required');
  }

  const result = await db
    .prepare(
      `
    SELECT v.card_id FROM votes v
    JOIN cards c ON c.id = v.card_id
    WHERE c.session_id = ? AND v.voter_id = ?
  `
    )
    .bind(session_id, voter_id)
    .all();

  const cardIds = (result.results || []).map((r: any) => r.card_id);

  return jsonResponse(cardIds);
}
