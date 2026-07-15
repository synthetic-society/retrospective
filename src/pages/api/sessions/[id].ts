import * as v from 'valibot';
import {
  defineRoute,
  errorResponse,
  getValidSession,
  jsonResponse,
  validationErrorResponse,
} from '../../../lib/api-utils';
import { getDB } from '../../../lib/db';
import { DeleteSessionSchema } from '../../../lib/schemas';

export const GET = defineRoute({ invalidIdMessage: 'Invalid session ID' }, async ({ id }) => {
  const { session, error } = await getValidSession(getDB(), id);
  if (error) return error;

  return jsonResponse(session, 200, 1); // 1s cache with stale-while-revalidate
});

export const DELETE = defineRoute({ invalidIdMessage: 'Invalid session ID' }, async ({ ctx, id }) => {
  const authHeader = ctx.request.headers.get('Authorization');
  const admin_token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const parsed = v.safeParse(DeleteSessionSchema, { admin_token });
  if (!parsed.success) return validationErrorResponse(parsed.issues);

  const db = getDB();
  const session = await db
    .prepare('SELECT id, admin_token FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ id: string; admin_token: string }>();

  if (!session) return errorResponse('Session not found', 404);
  if (session.admin_token !== parsed.output.admin_token) {
    return errorResponse('Forbidden', 403);
  }

  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
});
