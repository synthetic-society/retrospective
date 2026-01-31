import type { D1Database } from '@cloudflare/workers-types';
import type { APIContext } from 'astro';

interface CloudflareLocals {
  runtime?: { env?: { DB?: D1Database } };
  DB?: D1Database;
}

// Helper to extract database instance from Cloudflare runtime
export const getDB = (locals: APIContext['locals']): D1Database => {
  // Try different ways to access the DB binding
  const cfLocals = locals as CloudflareLocals;
  const db = cfLocals.runtime?.env?.DB || cfLocals.DB;
  if (!db) {
    throw new Error('Database binding not found. Make sure DB is configured in wrangler.jsonc');
  }
  return db;
};
