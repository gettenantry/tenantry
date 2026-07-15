/**
 * Entity classification decorators. Metadata lives in module-scoped
 * registries (WeakMap/WeakSet) — no reflect-metadata dependency and no
 * pollution of the entity classes themselves.
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- entity targets are constructors
type EntityClass = Function;

export interface TenantAwareOptions {
  /** Overrides the adapter-wide tenant column for this entity. */
  column?: string;
}

const tenantAwareRegistry = new WeakMap<EntityClass, TenantAwareOptions>();
const globalRegistry = new WeakSet<EntityClass>();

/**
 * Marks an entity as tenant-aware: the subscriber stamps its writes and
 * `TenantBaseRepository` scopes its reads.
 *
 * ```ts
 * @TenantAware()
 * @Entity()
 * export class Project { ... }
 * ```
 */
export function TenantAware(options: TenantAwareOptions = {}): ClassDecorator {
  return (target) => {
    tenantAwareRegistry.set(target, options);
  };
}

/**
 * Explicitly marks an entity as global (NOT tenant-scoped): `countries`,
 * `plans`, feature flags… Required escape hatch when the adapter is
 * configured with `entities: 'all'`, and useful documentation everywhere
 * else. Takes precedence over `@TenantAware()`.
 */
export function GlobalEntity(): ClassDecorator {
  return (target) => {
    globalRegistry.add(target);
  };
}

export function getTenantAwareOptions(target: EntityClass): TenantAwareOptions | undefined {
  return tenantAwareRegistry.get(target);
}

export function isMarkedTenantAware(target: EntityClass): boolean {
  return tenantAwareRegistry.has(target);
}

export function isMarkedGlobal(target: EntityClass): boolean {
  return globalRegistry.has(target);
}
