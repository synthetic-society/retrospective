import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse, validateUUID, parseJsonBody } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { UpdateCardSchema } from '../../../lib/schemas';

export async function PATCH({ params, request, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid card ID', 400);

  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = UpdateCardSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const db = getDB(locals);
  const existing = await db.prepare('SELECT id FROM cards WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('Card not found', 404);

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

export async function DELETE({ params, locals }: APIContext) {
  const { id } = params;
  if (!validateUUID(id)) return errorResponse('Invalid card ID', 400);

  await getDB(locals).prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}
