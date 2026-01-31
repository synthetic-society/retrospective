import type { APIContext } from 'astro';
import * as v from 'valibot';
import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  validateUUID,
  validationErrorResponse,
} from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { DeleteCardSchema, UpdateCardSchema } from '../../../lib/schemas';

export async function PATCH({ params, request, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid card ID', 400);

  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = v.safeParse(UpdateCardSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.issues);

  const db = getDB(locals);
  const existing = await db
    .prepare('SELECT id, session_id FROM cards WHERE id = ?')
    .bind(id)
    .first<{ id: string; session_id: string }>();
  if (!existing) return errorResponse('Card not found', 404);

  // Verify the requester knows the correct session_id (session-scoped authorization)
  if (existing.session_id !== parsed.output.session_id) {
    return errorResponse('Forbidden', 403);
  }

  const { content, column_type } = parsed.output;
  const sets = [content !== undefined && 'content = ?', column_type !== undefined && 'column_type = ?'].filter(Boolean);
  if (!sets.length) return errorResponse('No fields to update');

  const values = [content, column_type].filter((val) => val !== undefined);
  await db
    .prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  return jsonResponse(await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first());
}

export async function DELETE({ params, locals, url }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid card ID', 400);

  // Require session_id query param for authorization
  const deleteParsed = v.safeParse(DeleteCardSchema, { session_id: url.searchParams.get('session_id') });
  if (!deleteParsed.success) return validationErrorResponse(deleteParsed.issues);

  const db = getDB(locals);
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
}
