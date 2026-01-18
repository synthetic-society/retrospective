import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { VoteSchema } from '../../../../lib/schemas';

// PATCH /api/cards/[id]/vote - Toggle vote on a card (add or remove)
export async function PATCH({ params, request, locals }: APIContext) {
  const db = getDB(locals);
  const { id: card_id } = params;
  const body = await request.json();

  // Validate input
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { voter_id } = parsed.data;

  // Check if card exists
  const card = await db.prepare('SELECT id, votes FROM cards WHERE id = ?').bind(card_id).first();
  if (!card) {
    return errorResponse('Card not found', 404);
  }

  // Check if already voted
  const existing = await db
    .prepare('SELECT id FROM votes WHERE card_id = ? AND voter_id = ?')
    .bind(card_id, voter_id)
    .first();

  if (existing) {
    // Remove vote - use transactional batch and prevent negative votes
    await db.batch([
      db.prepare('DELETE FROM votes WHERE card_id = ? AND voter_id = ?').bind(card_id, voter_id),
      db.prepare('UPDATE cards SET votes = MAX(0, votes - 1) WHERE id = ?').bind(card_id),
    ]);

    const updatedCard = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(card_id).first();
    return jsonResponse({ ...updatedCard, voted: false });
  } else {
    // Add vote - use transactional batch
    const vote_id = crypto.randomUUID();
    await db.batch([
      db
        .prepare('INSERT INTO votes (id, card_id, voter_id) VALUES (?, ?, ?)')
        .bind(vote_id, card_id, voter_id),
      db.prepare('UPDATE cards SET votes = votes + 1 WHERE id = ?').bind(card_id),
    ]);

    const updatedCard = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(card_id).first();
    return jsonResponse({ ...updatedCard, voted: true }, 201);
  }
}
