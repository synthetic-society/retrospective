import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse, validateUUID, parseJsonBody } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { VoteSchema } from '../../../../lib/schemas';

export async function PATCH({ params, request, locals }: APIContext) {
  const { id: card_id } = params;
  if (!validateUUID(card_id)) return errorResponse('Invalid card ID', 400);

  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { voter_id } = parsed.data;
  const db = getDB(locals);

  const card = await db.prepare('SELECT id FROM cards WHERE id = ?').bind(card_id).first();
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
    return jsonResponse({
      ...(await db.prepare('SELECT * FROM cards WHERE id = ?').bind(card_id).first()),
      voted: false,
    });
  }

  await db.batch([
    db
      .prepare('INSERT INTO votes (id, card_id, voter_id) VALUES (?, ?, ?)')
      .bind(crypto.randomUUID(), card_id, voter_id),
    db.prepare('UPDATE cards SET votes = votes + 1 WHERE id = ?').bind(card_id),
  ]);
  return jsonResponse(
    {
      ...(await db.prepare('SELECT * FROM cards WHERE id = ?').bind(card_id).first()),
      voted: true,
    },
    201
  );
}
