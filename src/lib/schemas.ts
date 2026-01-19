import { z } from 'zod';

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
  content: trimmedString(500),
});
export const UpdateCardSchema = z.object({
  content: trimmedString(500).optional(),
  column_type: ColumnTypeSchema.optional(),
});
export const VoteSchema = z.object({ voter_id: UUIDSchema });

// Limits
export const MAX_CARD_CONTENT_LENGTH = 500;
export const MAX_PAGE_LIMIT = 500;
export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_REQUEST_BODY_SIZE = 16 * 1024;
