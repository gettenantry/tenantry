# @tenantry/typeorm — API reference

## Entity decorators

| Decorator                | Effect                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `@TenantAware(options?)` | Marks an entity as tenant-scoped. `options.column` overrides the adapter-wide tenant column for this entity. |
| `@GlobalEntity()`        | Marks an entity as global (never filtered). Always wins over `@TenantAware()` and `entities: 'all'`.         |

Metadata lives in module-scoped registries — no `reflect-metadata` dependency, no mutation of your classes.

## createTenantSubscriber

```ts
function createTenantSubscriber(options?: TenantryTypeOrmOptions): TenantSubscriber;
```

Returns an `EntitySubscriberInterface`. Push it onto `dataSource.subscribers`. Enforces writes on tenant-aware entities:

- `beforeInsert` — stamps the tenant column from context (overwriting supplied values);
- `beforeUpdate` — throws `CrossTenantOperationError` on cross-tenant updates or tenant rebinding;
- `beforeRemove` — throws `CrossTenantOperationError` on cross-tenant removal.

No-op for global entities and in `schema-per-tenant` mode.

## createTenantRepository

```ts
function createTenantRepository<E>(
  source: DataSource | EntityManager,
  entity: EntityTarget<E>,
  options?: TenantryTypeOrmOptions,
): TenantBaseRepository<E>;
```

A `Repository<E>` whose reads (`find*`, `count*`, `exists*`) and criteria writes (`update`, `delete`) are scoped to the current tenant, running under the appropriate binding (RLS session variable, or `search_path` for schema-per-tenant). Entity-carrying writes (`save`, `remove`) run inside the bound transaction; the subscriber does the stamping and checking.

## Options

```ts
interface TenantryTypeOrmOptions {
  /** 'decorated' (default) | 'all' | explicit entity list. @GlobalEntity always wins. */
  entities?: 'decorated' | 'all' | Function[];
  /** Tenant column on tenant-aware entities. @default 'tenantId' */
  tenantColumn?: string;
  /** @default 'hybrid' */
  isolation?: 'hybrid' | 'rls-only' | 'schema-per-tenant';
  /** RLS session variable. @default 'app.current_tenant'. false = filter only (hybrid). */
  sessionVariable?: string | false;
  /** @default 'throw' */
  onMissingTenant?: 'throw' | 'passthrough';
  /** Tenant resolver. @default getCurrentTenantId from @tenantry/core */
  getTenantId?: () => string | undefined;
  /** schema-per-tenant tuning. */
  schema?: {
    naming?: (tenantId: string) => string; // must yield [a-z_][a-z0-9_]*
    sharedSchemas?: readonly string[]; // @default ['public']
  };
}
```

## Errors

| Class                             | Thrown when                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `CrossTenantOperationError`       | A write would touch another tenant's row or rebind an entity's tenant column. |
| `MissingTenantError` (from core)  | Tenant-aware operation with no tenant and `onMissingTenant: 'throw'`.         |
| `UnsafeSqlValueError` (from core) | Invalid session variable or schema name.                                      |
| `TenancyError` (from core)        | Invalid options, or id-based criteria on a composite-key entity.              |

## Helpers

`isTenantAwareEntity(target, resolvedOptions)`, `tenantColumnFor(target, resolvedOptions)`, `resolveOptions(options)` are exported for advanced integrations and testing.
