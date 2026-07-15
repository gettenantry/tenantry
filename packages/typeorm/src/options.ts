import { getCurrentTenantId, TenancyError, UnsafeSqlValueError } from '@tenantry/core';

import { getTenantAwareOptions, isMarkedGlobal, isMarkedTenantAware } from './decorators';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- entity targets are constructors
type EntityClass = Function;

/**
 * - `hybrid` (default): reads are filtered on the tenant column AND the RLS
 *   session variable is bound per operation — defense in depth. Set
 *   `sessionVariable: false` for application-only filtering (discouraged).
 * - `rls-only`: no application filter; the PostgreSQL policy is the single
 *   source of truth. The session variable is always bound.
 * - `schema-per-tenant`: each tenant lives in its own PostgreSQL schema; the
 *   `search_path` is bound per operation. No tenant column involved.
 */
export type TypeOrmIsolationMode = 'hybrid' | 'rls-only' | 'schema-per-tenant';

export type MissingTenantBehavior = 'throw' | 'passthrough';

export interface SchemaPerTenantOptions {
  /**
   * Maps a tenant id to its schema name. The result must match
   * `[a-z_][a-z0-9_]*`. @default (t) => `tenant_${t}` (t lowercased,
   * non-alphanumerics replaced by underscores)
   */
  naming?: (tenantId: string) => string;
  /** Schemas appended after the tenant schema. @default ['public'] */
  sharedSchemas?: readonly string[];
}

export interface TenantryTypeOrmOptions {
  /**
   * Which entities are tenant-aware:
   * - `'decorated'` (default): entities marked with `@TenantAware()`;
   * - `'all'`: every entity except those marked `@GlobalEntity()`;
   * - an explicit list of entity classes.
   * `@GlobalEntity()` always wins.
   */
  entities?: 'decorated' | 'all' | readonly EntityClass[];
  /** Tenant column on tenant-aware entities. @default 'tenantId' */
  tenantColumn?: string;
  /** @default 'hybrid' */
  isolation?: TypeOrmIsolationMode;
  /**
   * RLS session variable (@default 'app.current_tenant'). `false` disables
   * the binding — hybrid mode only, discouraged. Ignored by
   * schema-per-tenant (which binds `search_path` instead).
   */
  sessionVariable?: string | false;
  /** @default 'throw' */
  onMissingTenant?: MissingTenantBehavior;
  /** Tenant resolver. @default getCurrentTenantId from @tenantry/core */
  getTenantId?: () => string | undefined;
  /** Options for the schema-per-tenant strategy. */
  schema?: SchemaPerTenantOptions;
}

export interface ResolvedTenantryTypeOrmOptions {
  entities: 'decorated' | 'all' | ReadonlySet<EntityClass>;
  tenantColumn: string;
  isolation: TypeOrmIsolationMode;
  sessionVariable: string | false;
  onMissingTenant: MissingTenantBehavior;
  getTenantId: () => string | undefined;
  schemaForTenant: (tenantId: string) => string;
  sharedSchemas: readonly string[];
}

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

function defaultSchemaNaming(tenantId: string): string {
  return `tenant_${tenantId.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
}

export function resolveOptions(
  options: TenantryTypeOrmOptions = {},
): ResolvedTenantryTypeOrmOptions {
  const isolation = options.isolation ?? 'hybrid';
  const sessionVariable = options.sessionVariable ?? 'app.current_tenant';

  if (isolation === 'rls-only' && sessionVariable === false) {
    throw new TenancyError(
      "isolation 'rls-only' requires a session variable: with no application " +
        'filter and no RLS binding there would be no isolation at all.',
    );
  }
  if (Array.isArray(options.entities) && options.entities.length === 0) {
    throw new TenancyError(
      "entities must be 'decorated', 'all', or a non-empty list of entity " +
        'classes. An empty list would silently disable tenant isolation everywhere.',
    );
  }

  const naming = options.schema?.naming ?? defaultSchemaNaming;
  const sharedSchemas = options.schema?.sharedSchemas ?? ['public'];
  for (const shared of sharedSchemas) {
    assertValidSchema(shared);
  }

  return {
    entities: Array.isArray(options.entities)
      ? new Set(options.entities as readonly EntityClass[])
      : ((options.entities ?? 'decorated') as 'decorated' | 'all'),
    tenantColumn: options.tenantColumn ?? 'tenantId',
    isolation,
    sessionVariable,
    onMissingTenant: options.onMissingTenant ?? 'throw',
    getTenantId: options.getTenantId ?? getCurrentTenantId,
    schemaForTenant: (tenantId) => {
      const schema = naming(tenantId);
      assertValidSchema(schema);
      return schema;
    },
    sharedSchemas,
  };
}

function assertValidSchema(schema: string): void {
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new UnsafeSqlValueError(
      `Invalid schema name "${schema}": only lowercase letters, digits and ` +
        'underscores are allowed.',
    );
  }
}

/** Decides whether an entity is tenant-aware under the given options. */
export function isTenantAwareEntity(
  target: EntityClass,
  options: ResolvedTenantryTypeOrmOptions,
): boolean {
  if (isMarkedGlobal(target)) {
    return false;
  }
  if (options.entities === 'all') {
    return true;
  }
  if (options.entities === 'decorated') {
    return isMarkedTenantAware(target);
  }
  return options.entities.has(target);
}

/** The tenant column for an entity (per-entity override, then adapter-wide). */
export function tenantColumnFor(
  target: EntityClass,
  options: ResolvedTenantryTypeOrmOptions,
): string {
  return getTenantAwareOptions(target)?.column ?? options.tenantColumn;
}
