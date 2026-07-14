import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  tenantId: string | undefined;
}

/**
 * Module-scoped AsyncLocalStorage shared by `TenantContextService`, the
 * `@CurrentTenant()` decorator and any adapter needing the current tenant
 * outside of NestJS dependency injection (e.g. a Prisma client extension).
 *
 * Kept private to the package: only typed accessors are exported.
 */
const storage = new AsyncLocalStorage<TenantStore>();

/** Runs `fn` inside a context bound to `tenantId`. */
export function runWithTenant<T>(tenantId: string | undefined, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

/** Returns the tenant of the active context, or `undefined` outside of one. */
export function getCurrentTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}

/**
 * Rebinds the tenant of the active context. Returns `false` when called
 * outside of a context (the caller decides whether that is an error).
 */
export function setCurrentTenantId(tenantId: string | undefined): boolean {
  const store = storage.getStore();
  if (store === undefined) {
    return false;
  }
  store.tenantId = tenantId;
  return true;
}

/** `true` when an execution context is active (even with no tenant bound). */
export function hasActiveContext(): boolean {
  return storage.getStore() !== undefined;
}
