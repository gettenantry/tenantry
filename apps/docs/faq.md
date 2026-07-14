# FAQ

## Does this work outside HTTP — queues, cron, gRPC?

Yes. The context is plain `AsyncLocalStorage`: wrap any unit of work in `TenantContextService.run(tenantId, fn)` (or the bare `runWithTenant`). Only the automatic extraction middleware is HTTP-specific.

## Do I have to use RLS?

No, but you should. `hybrid` mode with `sessionVariable: false` gives you application-level filtering only — that's the mode every incident report starts with. If your database is PostgreSQL, the policies cost little and cover exactly the bugs you won't see coming.

## Why does my app connect with a separate, non-superuser role?

PostgreSQL superusers bypass RLS unconditionally, and table owners do too unless the table is `FORCE`d. A dedicated `app_user` role with plain grants is what makes the second defense layer real. Migrations keep using the admin connection.

## What happens on a request with no tenant?

The middleware opens an empty context; `TenancyGuard` returns 403 (customizable) unless the route is `@Public()`. If some code still reaches the database tenant-less, the Prisma extension throws `MissingTenantError` — and if even that is bypassed, RLS shows an empty table. Three layers, all fail closed.

## Can a client spoof another tenant's id in a payload?

In `hybrid` mode, tenant values in `create`/`upsert` data and unique selectors are overwritten with the context tenant. In `rls-only` mode, PostgreSQL's `WITH CHECK` rejects the write. Both paths are [integration-tested](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts).

## Does the extension slow my queries down?

Hybrid filtering is a where-clause merge — negligible. The RLS binding adds one `set_config` statement inside a batch transaction per operation: one extra round-trip. For read-heavy hot paths, measure; for everything else, the isolation is worth far more than the microseconds.

## NestJS 10 or 11?

Both are supported (`peerDependencies: ^10 || ^11`). One difference: the middleware route wildcard defaults to NestJS 11 syntax (`{*splat}`); on NestJS 10 pass `middlewareRoutes: ['*']` to `forRoot()`.

## MySQL / SQLite / MongoDB?

Application-level filtering (hybrid mode with `sessionVariable: false`) works with any Prisma datasource. The RLS layer is PostgreSQL-specific. Native support for other engines' row-security mechanisms has no timeline — tell us your use case in an issue.

## When is v1 on npm? When TypeORM?

v1 ships once the docs and release pipeline are final — the code and tests are on `main` today. TypeORM (v2) starts after v1 is published; follow the [milestones](https://github.com/gettenantry/tenantry/milestones).
