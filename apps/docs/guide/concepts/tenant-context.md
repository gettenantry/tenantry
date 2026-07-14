# Tenant context

The tenant context is the backbone of Tenantry: a value that says _"this unit of work belongs to tenant X"_, visible from anywhere in the async call chain.

## Why AsyncLocalStorage?

The classic NestJS answer to per-request state is request-scoped providers. They work, but every provider that depends on one becomes request-scoped too — the scope is viral, and NestJS re-instantiates the whole subtree on every request. Measurable overhead, and it only works for HTTP.

`AsyncLocalStorage` (a Node.js core API) attaches the tenant to the _async execution context_ instead: near-zero cost, no DI contamination, and it works for anything async — HTTP requests, BullMQ jobs, cron ticks, Kafka consumers.

## The service

```ts
import { TenantContextService } from '@tenantry/core';

@Injectable()
export class ReportsService {
  constructor(private readonly tenantContext: TenantContextService) {}

  generate() {
    const tenantId = this.tenantContext.getTenantId(); // string | undefined
    const required = this.tenantContext.requireTenantId(); // throws MissingTenantError if absent
  }
}
```

For HTTP, `TenancyMiddleware` (registered by `TenancyModule.forRoot()`) opens the context before guards run. For everything else, open it yourself:

```ts
// a queue worker
await this.tenantContext.run(job.data.tenantId, async () => {
  await this.reports.generate(); // context visible in every nested call
});
```

## Semantics worth knowing

- **Nesting**: contexts nest; the innermost `run()` wins and the outer tenant is restored afterwards.
- **Empty context**: `run(undefined, fn)` opens a context _without_ a tenant — that's what the middleware does when extraction fails, letting `TenancyGuard` decide the response.
- **No leakage**: concurrent chains never see each other's tenant (covered by tests interleaving 25 concurrent contexts).
- **`setTenantId()`** rebinds the tenant of the _active_ context (useful after a late lookup). Outside of a context it throws `TenantContextError` instead of silently doing nothing.
- **Outside DI**: `getCurrentTenantId()` and `runWithTenant()` are exported as plain functions — that's what the Prisma extension uses internally.

## The lazy-promise pitfall

Prisma promises are **lazy**: the query executes when awaited, not when created. Always `await` inside the context:

```ts
// ❌ the query may execute outside the context
const rows = tenantContext.run(tenantId, () => prisma.project.findMany());

// ✅ the await happens inside
const rows = await tenantContext.run(tenantId, async () => prisma.project.findMany());
```
