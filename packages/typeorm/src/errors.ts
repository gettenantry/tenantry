import { TenancyError } from '@tenantry/core';

/**
 * Thrown when a write would move data across the tenant boundary — e.g.
 * updating or removing a row that belongs to another tenant, or attempting
 * to rebind a row's tenant column.
 */
export class CrossTenantOperationError extends TenancyError {
  constructor(message = 'Operation crosses the tenant boundary and was refused.') {
    super(message);
  }
}
