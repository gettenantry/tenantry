# @tenantry/prisma — API reference

## createTenancyExtension

```ts
function createTenancyExtension(options: TenantryPrismaOptions); // → pass to client.$extends()
```

```ts
interface TenantryPrismaOptions {
  /** Tenant-aware model names as in schema.prisma, or 'all'. Empty list refused. */
  models: readonly string[] | 'all';
  /** Tenant column. @default 'tenantId' */
  tenantField?: string;
  /** @default 'hybrid' */
  isolation?: 'hybrid' | 'rls-only';
  /**
   * Session variable bound per transaction. @default 'app.current_tenant'.
   * `false` skips RLS binding — hybrid only (refused with rls-only), discouraged.
   */
  sessionVariable?: string | false;
  /** Behavior on tenant-aware models with no tenant in context. @default 'throw' */
  onMissingTenant?: 'throw' | 'passthrough';
  /** Tenant resolver. @default getCurrentTenantId from @tenantry/core */
  getTenantId?: () => string | undefined;
}
```

Behavior per operation family is detailed in the [Prisma guide](/guide/prisma#what-the-extension-does-per-operation).

## applyTenantToArgs

```ts
function applyTenantToArgs(
  operation: string,
  args: unknown,
  field: string,
  tenantId: string,
): Record<string, unknown>;
```

The pure transform behind hybrid mode — exported for advanced use and testing. Throws `UnsupportedOperationError` on operations it does not know (fail closed).

## resolveOptions

```ts
function resolveOptions(options: TenantryPrismaOptions): ResolvedTenantryPrismaOptions;
```

Applies defaults and validates the combination (`rls-only` + `sessionVariable: false` and empty model lists are refused with a `TenancyError`).

## Errors

| Class                             | Thrown when                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `UnsupportedOperationError`       | An unknown Prisma operation would run unfiltered in hybrid mode.      |
| `MissingTenantError` (from core)  | Tenant-aware operation with no tenant and `onMissingTenant: 'throw'`. |
| `UnsafeSqlValueError` (from core) | Invalid session variable or tenant id.                                |
