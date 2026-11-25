Eyes Peeled is split into two independent parts. Each has its own dependencies, checks and rules; work inside the folder you are changing and run its commands from there.

| Folder | Stack | Rules / docs | Checks |
|---|---|---|---|
| `mobile/` | Expo SDK 58, Expo Router, TanStack Query | [`mobile/AGENTS.md`](mobile/AGENTS.md) (read it before touching Expo APIs) | `npx tsc --noEmit`, `npx expo lint`, `npm test` |
| `server/` | Express 5, Drizzle, Postgres/PGlite, vitest; photos checked by Claude vision (`@anthropic-ai/sdk`); admin panel in `server/admin/` (Vite + React) | [`server/README.md`](server/README.md) | `npm run typecheck`, `npm test`; admin: `npm run build` |

The API contract is [`docs/api-contract.md`](docs/api-contract.md). Response types live in `mobile/src/api/types.ts`; the server imports them through its `@shared/*` alias, so a contract change shows up in both typechecks.
