import type { APIContext } from 'astro';

// Helper to extract database instance from Cloudflare runtime
export const getDB = (locals: APIContext['locals']) => {
  // Try different ways to access the DB binding
  const db = (locals as any).runtime?.env?.DB || (locals as any).DB;
  if (!db) {
    throw new Error('Database binding not found. Make sure DB is configured in wrangler.jsonc');
  }
  return db;
};
