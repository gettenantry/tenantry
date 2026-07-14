/** Base class for every error thrown by Tenantry packages. */
export class TenancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown when an operation requires a tenant but none is present in the context. */
export class MissingTenantError extends TenancyError {
  constructor(message = 'No tenant is bound to the current execution context.') {
    super(message);
  }
}

/** Thrown when the tenant context is used incorrectly (e.g. mutated outside of `run`). */
export class TenantContextError extends TenancyError {}

/** Thrown when a value cannot be safely interpolated into SQL (identifier or tenant id). */
export class UnsafeSqlValueError extends TenancyError {}
