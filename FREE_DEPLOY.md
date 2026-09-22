# NEXORA Commerce — 100% Free Architecture

This version is designed to run without Railway, paid hosting, paid database services, or payment-provider fees.

## Stack
- Cloudflare Workers Free — API + serverless runtime
- Cloudflare D1 Free — SQLite database
- Cloudflare Workers Static Assets — storefront hosting
- GitHub — source code

Cloudflare's current Workers Free plan includes 100,000 Worker requests/day. D1 Free includes daily read/write quotas and free storage; exceeding the daily quota pauses queries until reset rather than charging automatically.

## One-time setup
1. Create a free Cloudflare account.
2. Create a D1 database named `nexora`.
3. Put its database ID into `wrangler.json`.
4. Run `npx wrangler d1 execute nexora --remote --file=./worker/schema.sql`.
5. Run `npx wrangler deploy`.

No credit card is required by this project design, but Cloudflare's own signup/payment requirements can change by account or region.

## Important
No provider can honestly promise that a third-party free tier will remain unchanged for life. This project uses free-tier services and has no paid dependency, but service limits and terms can change.

The old Railway API remains in the repository as an optional legacy deployment; the free architecture does not depend on it.
