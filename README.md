# Retro://spective

A minimal retrospective board with four columns: **Glad** (what went well), **Wonder** (questions), **Sad** (improvements), and **Action** (follow-ups). Fully anonymous and collaborative: anyone can add, edit, vote, or delete cards. Built with Astro, Preact, Tailwind CSS, and Cloudflare D1.

## Quick Start

```bash
pnpm install
pnpm dev           # Local dev with wrangler D1
pnpm build         # Build for production
pnpm deploy        # Deploy to Cloudflare Pages
```

Set up D1 database:

```bash
npx wrangler d1 create retro-db
npx wrangler d1 migrations apply retrospective-db --local   # For local dev
npx wrangler d1 migrations apply retrospective-db --remote  # For production
```
