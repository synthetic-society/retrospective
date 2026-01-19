import type { APIContext } from 'astro';
import { jsonResponse, zodErrorResponse, parseJsonBody } from '../../lib/api-utils';
import { getDB } from '../../lib/db';
import { CreateSessionSchema } from '../../lib/schemas';

const SESSION_EXPIRY_DAYS = 30;

export async function POST({ request, locals }: APIContext) {
  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + SESSION_EXPIRY_DAYS * 86400000).toISOString();

  await getDB(locals)
    .prepare('INSERT INTO sessions (id, name, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, parsed.data.name, created_at, expires_at)
    .run();

  return jsonResponse({ id, name: parsed.data.name, created_at, expires_at }, 201);
}
