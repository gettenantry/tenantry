---
'@tenantry/core': minor
'@tenantry/prisma': minor
---

Initial release of the Prisma MVP.

**@tenantry/core** — ORM-agnostic multi-tenancy toolkit for NestJS:

- `TenantContextService`: tenant propagation via `AsyncLocalStorage` (`run`, `getTenantId`, `requireTenantId`, `setTenantId`), no request-scoped providers.
- `TenancyModule.forRoot()` with pluggable extraction strategies: header, JWT claim (decode-only), subdomain, or custom callback.
- `@CurrentTenant()` parameter decorator and `TenancyGuard` with explicit `@Public()` opt-out.
- `RlsSessionService`: PostgreSQL Row-Level Security session binding (`SELECT set_config(..., true)`, transaction-scoped, fully parameterized) plus DDL builders for policies — shared by every ORM adapter.

**@tenantry/prisma** — Prisma adapter:

- Client extension (`$extends`) that scopes every operation on tenant-aware models: AND-merged `where` filters, tenant-stamped creates, scoped upserts — fail-closed on unknown operations and missing tenants.
- Two isolation modes: `hybrid` (application filter + RLS, default) and `rls-only`.
- RLS session variable bound in the same transaction as each query, so pooled connections can never leak a tenant binding.
- Raw queries get the RLS binding too — proven by an integration test where a deliberately unfiltered raw query still cannot read another tenant's rows.
