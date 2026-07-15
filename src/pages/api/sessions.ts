import { defineRoute, jsonResponse } from '../../lib/api-utils';
import { getDB } from '../../lib/db';
import { CreateSessionSchema } from '../../lib/schemas';

const SESSION_EXPIRY_DAYS = 30;

export const POST = defineRoute({ schema: CreateSessionSchema }, async ({ data }) => {
  const id = crypto.randomUUID();
  const admin_token = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + SESSION_EXPIRY_DAYS * 86400000).toISOString();

  await getDB()
    .prepare('INSERT INTO sessions (id, name, created_at, expires_at, admin_token) VALUES (?, ?, ?, ?, ?)')
    .bind(id, data.name, created_at, expires_at, admin_token)
    .run();

  return jsonResponse({ id, name: data.name, created_at, expires_at, admin_token }, 201);
});
