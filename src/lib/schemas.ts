import { z } from 'zod';
import { MAX_CARD_CONTENT_LENGTH } from './constants';

// Shared helpers
const trimmedString = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .transform(s => s.trim());
export const UUIDSchema = z.string().uuid();

// Column types
export const ColumnTypeSchema = z.enum(['glad', 'wondering', 'sad', 'action']);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

// Schemas
export const CreateSessionSchema = z.object({ name: trimmedString(100) });
export const CreateCardSchema = z.object({
  column_type: ColumnTypeSchema,
  content: trimmedString(MAX_CARD_CONTENT_LENGTH),
});
export const UpdateCardSchema = z.object({
  session_id: UUIDSchema,
  content: trimmedString(MAX_CARD_CONTENT_LENGTH).optional(),
  column_type: ColumnTypeSchema.optional(),
});
export const DeleteCardSchema = z.object({ session_id: UUIDSchema });
export const VoteSchema = z.object({ voter_id: UUIDSchema });
