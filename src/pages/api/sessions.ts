import type { APIContext } from 'astro';
import * as v from 'valibot';
import { jsonResponse, parseJsonBody, validationErrorResponse } from '../../lib/api-utils';
import { getDB } from '../../lib/db';
import { CreateSessionSchema } from '../../lib/schemas';

const SESSION_EXPIRY_DAYS = 30;

export async function POST({ request, locals }: APIContext) {
  const { data: body, error } = await parseJsonBody(request);
  if (error) return error;

  const parsed = v.safeParse(CreateSessionSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.issues);

  const id = crypto.randomUUID();
  const admin_token = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + SESSION_EXPIRY_DAYS * 86400000).toISOString();

  await getDB(locals)
    .prepare('INSERT INTO sessions (id, name, created_at, expires_at, admin_token) VALUES (?, ?, ?, ?, ?)')
    .bind(id, parsed.output.name, created_at, expires_at, admin_token)
    .run();

  return jsonResponse({ id, name: parsed.output.name, created_at, expires_at, admin_token }, 201);
}
