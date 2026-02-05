import * as v from 'valibot';
import { MAX_CARD_CONTENT_LENGTH } from './constants';

// Shared helpers
const trimmedString = (max: number) =>
  v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(max),
    v.transform((s) => s.trim()),
  );

const sanitizedString = (max: number) =>
  v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(max),
    v.transform((s) => s.trim().replace(/<[^>]*>/g, '')),
    v.minLength(1, 'Name must not be empty after sanitization'),
  );
export const UUIDSchema = v.pipe(v.string(), v.uuid());

// Column types
export const ColumnTypeSchema = v.picklist(['glad', 'wondering', 'sad', 'action']);
export type ColumnType = v.InferOutput<typeof ColumnTypeSchema>;

// Schemas
export const CreateSessionSchema = v.object({ name: sanitizedString(100) });
export const CreateCardSchema = v.object({
  column_type: ColumnTypeSchema,
  content: trimmedString(MAX_CARD_CONTENT_LENGTH),
});
export const UpdateCardSchema = v.object({
  session_id: UUIDSchema,
  content: v.optional(trimmedString(MAX_CARD_CONTENT_LENGTH)),
  column_type: v.optional(ColumnTypeSchema),
});
export const DeleteCardSchema = v.object({ session_id: UUIDSchema });
export const DeleteSessionSchema = v.object({ admin_token: UUIDSchema });
export const VoterIdSchema = v.object({ voter_id: UUIDSchema });
export const VoteSchema = v.object({ session_id: UUIDSchema, voter_id: UUIDSchema });
