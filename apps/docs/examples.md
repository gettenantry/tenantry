# Example app

The repository ships a runnable demo: [`apps/example-prisma`](https://github.com/gettenantry/tenantry/tree/main/apps/example-prisma) — a per-tenant "projects" REST API.

## What it demonstrates

- Header-based extraction (`x-tenant-id`) via `TenancyModule.forRoot()`
- Global `TenancyGuard` with a `@Public()` health route
- A Prisma client scoped by `createTenancyExtension` — controllers contain **zero tenant-filtering logic**
- A migration that enables + **forces** RLS, creates the policy, and provisions a non-superuser application role
- The two-URL pattern: admin URL for migrations, restricted `app_user` URL for the API

## Run it

```sh
pnpm install && pnpm build
docker compose -f apps/example-prisma/docker-compose.yml up -d --wait
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tenantry_example"
pnpm --filter @tenantry/example-prisma db:migrate
pnpm --filter @tenantry/example-prisma start
```

## Poke at the isolation

```sh
# Two tenants, two worlds
curl -H "x-tenant-id: acme"   localhost:3000/projects
curl -H "x-tenant-id: globex" localhost:3000/projects

# Create as acme, then try to read it as globex → 404
curl -X POST -H "x-tenant-id: acme" -H "content-type: application/json" \
     -d '{"name":"Secret plan"}' localhost:3000/projects
curl -H "x-tenant-id: globex" localhost:3000/projects/<returned-id>

# No tenant → 403, except public routes
curl localhost:3000/projects   # 403
curl localhost:3000/health     # 200
```

Want the adversarial version — raw SQL, deliberately bypassed filters, smuggled tenant ids? That lives in the [integration suite](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts), which runs on every CI build.
