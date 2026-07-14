# @tenantry/core — API reference

## TenantContextService

Injectable service over a module-scoped `AsyncLocalStorage`.

| Member            | Signature                                               | Notes                                                                                          |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `run`             | `run<T>(tenantId: string \| undefined, fn: () => T): T` | Opens a (possibly empty) context; nests; restores the outer context afterwards, even on throw. |
| `getTenantId`     | `(): string \| undefined`                               | Never throws.                                                                                  |
| `requireTenantId` | `(): string`                                            | Throws `MissingTenantError` when absent.                                                       |
| `setTenantId`     | `(tenantId: string \| undefined): void`                 | Rebinds the active context; throws `TenantContextError` outside of one.                        |
| `isActive`        | `(): boolean`                                           | `true` inside any context, even empty.                                                         |

Plain-function equivalents (usable outside DI): `runWithTenant(tenantId, fn)`, `getCurrentTenantId()`, `hasActiveContext()`.

## TenancyModule

```ts
TenancyModule.forRoot(options: TenancyModuleOptions): DynamicModule
```

Global module. Registers the extraction pipeline, `TenancyMiddleware` (applied to all routes), and exports `TenantContextService`, `TenancyGuard`, `RlsSessionService`.

```ts
interface TenancyModuleOptions {
  extraction: ExtractionOptions; // required — see below
  guard?: { exceptionFactory?: () => Error }; // default: 403 ForbiddenException
  middlewareRoutes?: string[]; // default ['{*splat}'] (NestJS 11); use ['*'] on NestJS 10
}
```

## Extraction

```ts
type ExtractionOptions =
  | { strategy: 'header'; header?: string } // default 'x-tenant-id'
  | { strategy: 'jwt'; claim?: string; header?: string } // defaults 'tenantId', 'authorization' — decode only, NO verification
  | { strategy: 'subdomain'; baseDomain: string } // exactly one label; strict
  | { strategy: 'custom'; extractor: TenantExtractor };

type TenantExtractor = (
  req: RequestLike,
) => string | null | undefined | Promise<string | null | undefined>;

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
}
```

Factories are exported individually too: `headerExtractor(header?)`, `jwtClaimExtractor(claim?, header?)`, `subdomainExtractor(baseDomain)`, `createTenantExtractor(options)`.

## Guard & decorators

- **`TenancyGuard`** — `CanActivate` that throws (403 by default) when `getTenantId()` is `undefined`. Register globally via `APP_GUARD`.
- **`@Public()`** — handler- or class-level opt-out checked by the guard (metadata key `IS_PUBLIC_ROUTE`).
- **`@CurrentTenant()`** — parameter decorator returning the current tenant (`string | undefined`). Reads the ALS context, so it works on any transport.

## RlsSessionService

The single home of RLS logic, reused by every adapter.

```ts
new RlsSessionService({ variable: 'app.current_tenant' }); // variable validated: lowercase dotted name
```

| Member                                             | Returns               | Notes                                                                        |
| -------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `variable`                                         | `string`              | The configured session variable.                                             |
| `buildSetTenantStatement(tenantId)`                | `{ sql, parameters }` | `SELECT set_config($1, $2, true)` — fully parameterized, transaction-scoped. |
| `applyTenant(executor, tenantId)`                  | `Promise<void>`       | Runs the statement through any `{ execute(sql, params) }`.                   |
| `buildEnableRlsDdl(table)`                         | `string[]`            | `ENABLE` **and** `FORCE` row-level security.                                 |
| `buildTenantPolicyDdl(table, column, policyName?)` | `string`              | `CREATE POLICY … USING … WITH CHECK …`.                                      |

Identifiers are validated (`[A-Za-z_][A-Za-z0-9_]*`) and quoted; invalid input throws `UnsafeSqlValueError` — never silent interpolation.

## Errors

| Class                 | Thrown when                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `TenancyError`        | Base class of everything below.                                          |
| `MissingTenantError`  | A tenant is required but absent (`requireTenantId`, adapter operations). |
| `TenantContextError`  | Context misuse (`setTenantId` outside `run`).                            |
| `UnsafeSqlValueError` | Invalid session variable, identifier, or tenant id for SQL.              |
