import { env } from 'cloudflare:workers';

export const getDB = (): D1Database => env.DB;
