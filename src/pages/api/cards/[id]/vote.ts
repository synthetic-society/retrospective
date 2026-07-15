import { defineRoute, errorResponse, jsonResponse } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { VoteSchema } from '../../../../lib/schemas';

export const PATCH = defineRoute(
  { invalidIdMessage: 'Invalid card ID', schema: VoteSchema },
  async ({ id: card_id, data }) => {
    const { voter_id, session_id } = data;
    const db = getDB();

    // Verify card belongs to the claimed session (session-scoped authorization)
    const card = await db
      .prepare('SELECT id FROM cards WHERE id = ? AND session_id = ?')
      .bind(card_id, session_id)
      .first();
    if (!card) return errorResponse('Card not found', 404);

    const existing = await db
      .prepare('SELECT id FROM votes WHERE card_id = ? AND voter_id = ?')
      .bind(card_id, voter_id)
      .first();

    if (existing) {
      await db.batch([
        db.prepare('DELETE FROM votes WHERE card_id = ? AND voter_id = ?').bind(card_id, voter_id),
        db.prepare('UPDATE cards SET votes = MAX(0, votes - 1) WHERE id = ?').bind(card_id),
      ]);
    } else {
      await db.batch([
        db
          .prepare('INSERT INTO votes (id, card_id, voter_id) VALUES (?, ?, ?)')
          .bind(crypto.randomUUID(), card_id, voter_id),
        db.prepare('UPDATE cards SET votes = votes + 1 WHERE id = ?').bind(card_id),
      ]);
    }

    const voted = !existing;
    return jsonResponse(
      { ...(await db.prepare('SELECT * FROM cards WHERE id = ?').bind(card_id).first()), voted },
      voted ? 201 : 200,
    );
  },
);
