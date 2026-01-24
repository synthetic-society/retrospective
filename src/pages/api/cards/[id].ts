import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse, validateUUID, parseJsonBody } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { UpdateCardSchema, DeleteCardSchema } from '../../../lib/schemas';

export async function PATCH({ params, request, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid card ID', 400);

  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = UpdateCardSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const existing = await db.prepare('SELECT id, session_id FROM cards WHERE id = ?').bind(id).first<{ id: string; session_id: string }>();
  if (!existing) return errorResponse('Card not found', 404);

  // Verify the requester knows the correct session_id (session-scoped authorization)
  if (existing.session_id !== parsed.data.session_id) {
    return errorResponse('Forbidden', 403);
  }

  const { content, column_type } = parsed.data;
  const sets = [content !== undefined && 'content = ?', column_type !== undefined && 'column_type = ?'].filter(Boolean);
  if (!sets.length) return errorResponse('No fields to update');

  const values = [content, column_type].filter(v => v !== undefined);
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
  const parsed = DeleteCardSchema.safeParse({ session_id: url.searchParams.get('session_id') });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const existing = await db.prepare('SELECT id, session_id FROM cards WHERE id = ?').bind(id).first<{ id: string; session_id: string }>();
  if (!existing) return errorResponse('Card not found', 404);

  // Verify the requester knows the correct session_id (session-scoped authorization)
  if (existing.session_id !== parsed.data.session_id) {
    return errorResponse('Forbidden', 403);
  }

  await db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}
