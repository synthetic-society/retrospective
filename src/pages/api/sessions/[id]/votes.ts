import * as v from 'valibot';
import {
  defineRoute,
  getValidSession,
  jsonResponse,
  parseLimit,
  validationErrorResponse,
} from '../../../../lib/api-utils';
import { getDB } from '../../../../lib/db';
import { VoterIdSchema } from '../../../../lib/schemas';

export const GET = defineRoute({ invalidIdMessage: 'Invalid session ID' }, async ({ ctx, id: session_id }) => {
  const parsed = v.safeParse(VoterIdSchema, { voter_id: ctx.url.searchParams.get('voter_id') });
  if (!parsed.success) return validationErrorResponse(parsed.issues);

  const db = getDB();
  const { error } = await getValidSession(db, session_id);
  if (error) return error;

  const result = await db
    .prepare(
      'SELECT v.card_id FROM votes v JOIN cards c ON c.id = v.card_id WHERE c.session_id = ? AND v.voter_id = ? LIMIT ?',
    )
    .bind(session_id, parsed.output.voter_id, parseLimit(ctx.url.searchParams.get('limit')))
    .all();

  return jsonResponse(
    ((result.results || []) as { card_id: string }[]).map((r) => r.card_id),
    200,
    1,
  ); // 1s cache with stale-while-revalidate
});
