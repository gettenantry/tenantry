# example-typeorm

Mirror of [example-prisma](../example-prisma): the **same** per-tenant "projects" REST API, built with `@tenantry/core` + `@tenantry/typeorm`. Same routes, same `TenancyModule` configuration, same guarantees — proof that the core API is adapter-agnostic.

It even shares the PostgreSQL instance and the `Project` table with the Prisma demo (same [docker-compose](../example-prisma/docker-compose.yml)), so you can run both side by side and watch two ORMs serve the same isolated data.

## Run it (5 commands)

From the repository root:

```sh
pnpm install && pnpm build
docker compose -f apps/example-prisma/docker-compose.yml up -d --wait
pnpm --filter @tenantry/example-typeorm db:init
pnpm --filter @tenantry/example-typeorm db:seed   # optional
pnpm --filter @tenantry/example-typeorm start     # listens on :3001
```

## Prove the isolation

```sh
curl -H "x-tenant-id: acme"   localhost:3001/projects
curl -H "x-tenant-id: globex" localhost:3001/projects

# Create as acme — no tenantId anywhere; the subscriber stamps it:
curl -X POST -H "x-tenant-id: acme" -H "content-type: application/json" \
     -d '{"name":"Secret plan"}' localhost:3001/projects

# Read it as globex → 404. No tenant header → 403 (except /health).
```

Run the Prisma demo on :3000 at the same time and query both — same data, same isolation, different ORM.
