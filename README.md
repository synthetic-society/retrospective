# Retro://spective

A minimal retrospective board with four columns: **Glad** (what went well), **Wonder** (questions), **Sad** (improvements), and **Action** (follow-ups). Fully anonymous and collaborative: anyone can add, edit, vote, or delete cards. Built with Astro, Preact, Tailwind CSS, and Cloudflare D1.

## Quick Start

```bash
pnpm install
pnpm dev           # Local dev with wrangler D1
```

## Database Setup

### For Production

Create and configure the D1 database:

```bash
# Create the database
npx wrangler d1 create retrospective-db

# Copy the database_id from the output and update wrangler.jsonc
# Replace "your-database-id-here" with the actual database_id

# Apply migrations
npx wrangler d1 migrations apply retrospective-db --remote
```

### For Local Development

For local testing, use a local D1 database:

```bash
# Apply migrations to local database
npx wrangler d1 migrations apply retrospective-db --local

# Run dev server (automatically uses local D1)
pnpm dev
```

The local D1 database is stored in `.wrangler/state` and doesn't require a database_id in the config.

## Deployment

Build and deploy to Cloudflare Workers:

```bash
# Build the application
pnpm build

# Deploy to Cloudflare Workers
npx wrangler deploy
```

The app will be deployed to your Cloudflare Workers subdomain at `https://retrospective.<your-subdomain>.workers.dev`
