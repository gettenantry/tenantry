# Introduction

Tenantry brings **provable tenant isolation** to [NestJS](https://nestjs.com) applications. It is built around one conviction: in a multi-tenant system, `WHERE tenant_id = ?` scattered across your codebase is one forgotten line away from a data breach.

## What you get

- **Tenant context** propagated with `AsyncLocalStorage` — available anywhere in the async call chain, without request-scoped providers and their performance cost.
- **Pluggable extraction**: read the tenant from a header, a JWT claim, a subdomain, or your own callback.
- **Enforcement by default**: `TenancyGuard` rejects any request without a resolved tenant; routes opt _out_ explicitly with `@Public()`.
- **Automatic query scoping** through thin ORM adapters — [Prisma](/guide/prisma) first, TypeORM planned for v2.
- **PostgreSQL Row-Level Security** as defense in depth: even a buggy raw query cannot cross tenant boundaries. This is [proven by integration tests](https://github.com/gettenantry/tenantry/blob/main/packages/prisma/test/integration/isolation.spec.ts) against a real PostgreSQL, including a deliberately introduced application bug.

## The architecture in one picture

```
        request (header / JWT / subdomain)
                      │
              TenancyMiddleware ── extraction strategy
                      │
         AsyncLocalStorage tenant context
                      │
               TenancyGuard (403 if no tenant, unless @Public)
                      │
              your controllers / services
                      │
        @tenantry/prisma extension ($extends)
          │ hybrid: inject tenant filter
          │ always: SELECT set_config('app.current_tenant', …, true)
                      │
         PostgreSQL — RLS policy on every tenant-aware table
```

The core package never depends on an ORM. Adapters stay thin and share the same `RlsSessionService`, so every adapter offers the same guarantees.

## Status

Tenantry is in **pre-release** (v1, Prisma MVP). The API documented here reflects the code on `main`. Follow the [roadmap](https://github.com/gettenantry/tenantry/blob/main/ROADMAP.md).

Ready? Head to the [quickstart](/guide/quickstart).
