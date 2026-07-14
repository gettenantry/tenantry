import { getCurrentTenantId, TenancyError } from '@tenantry/core';

/**
 * - `hybrid` (default): the extension injects the tenant filter into every
 *   operation **and** binds the RLS session variable — defense in depth.
 * - `rls-only`: no application-level filter; the PostgreSQL policy is the
 *   single source of truth. The session variable is always bound.
 */
export type IsolationMode = 'hybrid' | 'rls-only';

/** Behavior when a tenant-aware model is queried with no tenant in context. */
export type MissingTenantBehavior = 'throw' | 'passthrough';

export interface TenantryPrismaOptions {
  /**
   * Names of the tenant-aware models, as written in `schema.prisma`
   * (e.g. `['Project', 'Invoice']`), or `'all'` to cover every model.
   * Models not listed are treated as global and never filtered.
   */
  models: readonly string[] | 'all';
  /** Column holding the tenant id on tenant-aware models. @default 'tenantId' */
  tenantField?: string;
  /** @default 'hybrid' */
  isolation?: IsolationMode;
  /**
   * PostgreSQL session variable bound before each operation
   * (@default 'app.current_tenant'). Pass `false` to skip RLS binding
   * entirely — only allowed in `hybrid` mode, for databases without RLS
   * policies. Strongly discouraged: it leaves application filtering as the
   * only line of defense.
   */
  sessionVariable?: string | false;
  /** @default 'throw' */
  onMissingTenant?: MissingTenantBehavior;
  /**
   * How the current tenant is resolved. Defaults to Tenantry's
   * AsyncLocalStorage context (`getCurrentTenantId` from @tenantry/core).
   */
  getTenantId?: () => string | undefined;
}

export interface ResolvedTenantryPrismaOptions {
  models: 'all' | ReadonlySet<string>;
  tenantField: string;
  isolation: IsolationMode;
  sessionVariable: string | false;
  onMissingTenant: MissingTenantBehavior;
  getTenantId: () => string | undefined;
}

export function resolveOptions(options: TenantryPrismaOptions): ResolvedTenantryPrismaOptions {
  const isolation = options.isolation ?? 'hybrid';
  const sessionVariable = options.sessionVariable ?? 'app.current_tenant';

  if (isolation === 'rls-only' && sessionVariable === false) {
    throw new TenancyError(
      "isolation 'rls-only' requires a session variable: with no application " +
        'filter and no RLS binding there would be no isolation at all.',
    );
  }
  if (options.models !== 'all' && options.models.length === 0) {
    throw new TenancyError(
      "models must be a non-empty list of model names, or 'all'. " +
        'An empty list would silently disable tenant isolation everywhere.',
    );
  }

  return {
    models: options.models === 'all' ? 'all' : new Set(options.models),
    tenantField: options.tenantField ?? 'tenantId',
    isolation,
    sessionVariable,
    onMissingTenant: options.onMissingTenant ?? 'throw',
    getTenantId: options.getTenantId ?? getCurrentTenantId,
  };
}
