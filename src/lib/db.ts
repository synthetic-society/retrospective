import type { APIContext } from 'astro';
import type { D1Database } from '@cloudflare/workers-types';

// Helper to extract database instance from Cloudflare runtime
export const getDB = (locals: APIContext['locals']): D1Database => {
  // Try different ways to access the DB binding
  const db = (locals as any).runtime?.env?.DB || (locals as any).DB;
  if (!db) {
    throw new Error('Database binding not found. Make sure DB is configured in wrangler.jsonc');
  }
  return db;
};
