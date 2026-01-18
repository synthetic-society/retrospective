import type { APIContext } from 'astro';

// Helper to extract database instance from Cloudflare runtime
export const getDB = (locals: APIContext['locals']) => (locals as any).runtime.env.DB;
