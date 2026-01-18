import type { APIContext } from 'astro';
import { jsonResponse, errorResponse, zodErrorResponse } from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { UpdateCardSchema } from '../../../lib/schemas';

// PATCH /api/cards/[id] - Update a card
export async function PATCH({ params, request, locals }: APIContext) {
  const db = getDB(locals);
  const { id } = params;
  const body = await request.json();

  // Check if card exists first
  const existing = await db.prepare('SELECT id FROM cards WHERE id = ?').bind(id).first();
  if (!existing) {
    return errorResponse('Card not found', 404);
  }

  // Validate input with Zod
  const parsed = UpdateCardSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const updates = parsed.data;
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.column_type !== undefined) {
    fields.push('column_type = ?');
    values.push(updates.column_type);
  }

  if (fields.length === 0) {
    return errorResponse('No valid fields to update');
  }

  values.push(id);
  await db
    .prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const result = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first();

  return jsonResponse(result);
}

// DELETE /api/cards/[id] - Delete a card
export async function DELETE({ params, locals }: APIContext) {
  const db = getDB(locals);
  const { id } = params;

  await db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();

  return new Response(null, { status: 204 });
}
