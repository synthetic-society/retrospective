import { z } from 'zod';

// Column types enum
export const ColumnTypeSchema = z.enum(['glad', 'wondering', 'sad', 'action']);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

// Session schemas
export const CreateSessionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .transform(s => s.trim()),
});

// Card schemas
export const CreateCardSchema = z.object({
  column_type: ColumnTypeSchema,
  content: z
    .string()
    .min(1, 'Content is required')
    .max(500, 'Content must be 500 characters or less')
    .transform(s => s.trim()),
});

export const UpdateCardSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(500, 'Content must be 500 characters or less')
    .transform(s => s.trim())
    .optional(),
  column_type: ColumnTypeSchema.optional(),
});

// Vote schemas
export const VoteSchema = z.object({
  voter_id: z.string().uuid('Invalid voter_id format'),
});

// Content limits (shared between frontend and backend)
export const MAX_SESSION_NAME_LENGTH = 100;
export const MAX_CARD_CONTENT_LENGTH = 500;
