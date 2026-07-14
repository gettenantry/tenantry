# example-prisma

Minimal NestJS demo for Tenantry: a per-tenant "projects" REST API built with `@tenantry/core` + `@tenantry/prisma`, backed by PostgreSQL with **Row-Level Security**.

The interesting part is what you _don't_ see: [projects.controller.ts](src/projects.controller.ts) contains **zero tenant-filtering logic**. The tenant comes from the `x-tenant-id` header, flows through `AsyncLocalStorage`, and every Prisma query is scoped automatically — with RLS as the safety net. (Creates take the tenant from `@CurrentTenant()` to satisfy the generated types; the extension enforces it matches the context regardless.)

## Run it (5 commands)

From the repository root:

```sh
pnpm install && pnpm build
docker compose -f apps/example-prisma/docker-compose.yml up -d --wait
cp apps/example-prisma/.env.example apps/example-prisma/.env
pnpm --filter @tenantry/example-prisma exec dotenv -- pnpm --filter @tenantry/example-prisma db:migrate
pnpm --filter @tenantry/example-prisma start
```

> No `dotenv` CLI? Just export the two URLs from [.env.example](.env.example) and run `pnpm --filter @tenantry/example-prisma db:migrate && pnpm --filter @tenantry/example-prisma start`.

Seed sample data (optional): `pnpm --filter @tenantry/example-prisma db:seed`

## Prove the isolation

```sh
# Each tenant sees only its own world:
curl -H "x-tenant-id: acme"   localhost:3000/projects
curl -H "x-tenant-id: globex" localhost:3000/projects

# Create as acme…
curl -X POST -H "x-tenant-id: acme" -H "content-type: application/json" \
     -d '{"name":"Secret plan"}' localhost:3000/projects

# …and try to read it as globex using the returned id → 404
curl -H "x-tenant-id: globex" localhost:3000/projects/<id>

# No tenant header → 403 (TenancyGuard), except @Public() routes:
curl localhost:3000/projects
curl localhost:3000/health
```

## Why two database URLs?

- `DATABASE_URL` (superuser) — migrations only.
- `APP_DATABASE_URL` (`app_user`, non-superuser) — the API. PostgreSQL superusers bypass RLS, so running the app as one would silently disable the second layer of defense. The migration creates the role, the policy, and `FORCE`s RLS.
