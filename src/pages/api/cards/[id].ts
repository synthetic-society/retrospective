import * as v from 'valibot';
import { defineRoute, errorResponse, jsonResponse, validationErrorResponse } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { DeleteCardSchema, UpdateCardSchema } from '../../../lib/schemas';

export const PATCH = defineRoute(
  { invalidIdMessage: 'Invalid card ID', schema: UpdateCardSchema },
  async ({ id, data }) => {
    const db = getDB();
    const existing = await db
      .prepare('SELECT id, session_id FROM cards WHERE id = ?')
      .bind(id)
      .first<{ id: string; session_id: string }>();
    if (!existing) return errorResponse('Card not found', 404);

    // Verify the requester knows the correct session_id (session-scoped authorization)
    if (existing.session_id !== data.session_id) {
      return errorResponse('Forbidden', 403);
    }

    const { content, column_type } = data;
    const sets = [content !== undefined && 'content = ?', column_type !== undefined && 'column_type = ?'].filter(
      Boolean,
    );
    if (!sets.length) return errorResponse('No fields to update');

    const values = [content, column_type].filter((val) => val !== undefined);
    await db
      .prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return jsonResponse(await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first());
  },
);

export const DELETE = defineRoute({ invalidIdMessage: 'Invalid card ID' }, async ({ ctx, id }) => {
  // Require session_id query param for authorization
  const deleteParsed = v.safeParse(DeleteCardSchema, { session_id: ctx.url.searchParams.get('session_id') });
  if (!deleteParsed.success) return validationErrorResponse(deleteParsed.issues);

  const db = getDB();
  const existing = await db
    .prepare('SELECT id, session_id FROM cards WHERE id = ?')
    .bind(id)
    .first<{ id: string; session_id: string }>();
  if (!existing) return errorResponse('Card not found', 404);

  // Verify the requester knows the correct session_id (session-scoped authorization)
  if (existing.session_id !== deleteParsed.output.session_id) {
    return errorResponse('Forbidden', 403);
  }

  await db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
});
