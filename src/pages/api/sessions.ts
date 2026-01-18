import type { APIContext } from 'astro';
import { jsonResponse, zodErrorResponse } from '../../lib/api-utils';
import { getDB } from '../../lib/db';
import { CreateSessionSchema } from '../../lib/schemas';

// Session expiry: 30 days from creation
const SESSION_EXPIRY_DAYS = 30;

export async function POST({ request, locals }: APIContext) {
  const db = getDB(locals);
  const body = await request.json();

  // Validate input with Zod
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const { name } = parsed.data;
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare('INSERT INTO sessions (id, name, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, name, created_at, expires_at)
    .run();

  return jsonResponse({ id, name, created_at, expires_at }, 201);
}
