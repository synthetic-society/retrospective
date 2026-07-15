import { defineRoute, getValidSession, jsonResponse, parseLimit } from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { CreateCardSchema } from '../../../../lib/schemas';

export const GET = defineRoute({ invalidIdMessage: 'Invalid session ID' }, async ({ ctx, id }) => {
  const db = getDB();
  const { error } = await getValidSession(db, id);
  if (error) return error;

  const result = await db
    .prepare('SELECT * FROM cards WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
    .bind(id, parseLimit(ctx.url.searchParams.get('limit')))
    .all();
  return jsonResponse(result.results || [], 200, 1); // 1s cache with stale-while-revalidate
});

export const POST = defineRoute(
  { invalidIdMessage: 'Invalid session ID', schema: CreateCardSchema },
  async ({ id: session_id, data }) => {
    const db = getDB();
    const { error } = await getValidSession(db, session_id);
    if (error) return error;

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const { column_type, content } = data;

    await db
      .prepare('INSERT INTO cards (id, session_id, column_type, content, votes, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .bind(id, session_id, column_type, content, created_at)
      .run();

    return jsonResponse({ id, session_id, column_type, content, votes: 0, created_at }, 201);
  },
);
