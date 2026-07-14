# example-prisma

Minimal NestJS demo app for Tenantry: a per-tenant "projects" REST API built with `@tenantry/core` + `@tenantry/prisma`, backed by PostgreSQL (docker-compose).

> **Status: placeholder.** This app is implemented as part of v1 — see the [roadmap](../../ROADMAP.md).

Planned quickstart (5 commands max):

```sh
git clone https://github.com/gettenantry/tenantry
cd tenantry && pnpm install
docker compose -f apps/example-prisma/docker-compose.yml up -d
pnpm --filter @tenantry/example-prisma prisma:migrate
pnpm --filter @tenantry/example-prisma start:dev
```
