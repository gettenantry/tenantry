import { MissingTenantError } from '@tenantry/core';
import {
  type EntitySubscriberInterface,
  type InsertEvent,
  type RemoveEvent,
  type UpdateEvent,
} from 'typeorm';

import { CrossTenantOperationError } from './errors';
import {
  isTenantAwareEntity,
  resolveOptions,
  tenantColumnFor,
  type ResolvedTenantryTypeOrmOptions,
  type TenantryTypeOrmOptions,
} from './options';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- entity targets are constructors
type EntityClass = Function;

type TenantRecord = Record<string, unknown>;

/**
 * Write-side enforcement for tenant-aware entities:
 *
 * - **insert**: stamps the tenant column from the context, overwriting any
 *   attacker-supplied value;
 * - **update**: refuses updates on rows owned by another tenant, and refuses
 *   rebinding the tenant column;
 * - **remove**: refuses removing another tenant's row.
 *
 * In `schema-per-tenant` mode the subscriber is a no-op (isolation is the
 * schema, entities have no tenant column).
 *
 * Register it on your DataSource:
 *
 * ```ts
 * const dataSource = new DataSource({ ... });
 * dataSource.subscribers.push(createTenantSubscriber({ ... }));
 * ```
 */
export class TenantSubscriber implements EntitySubscriberInterface {
  private readonly options: ResolvedTenantryTypeOrmOptions;

  constructor(options: TenantryTypeOrmOptions = {}) {
    this.options = resolveOptions(options);
  }

  beforeInsert(event: InsertEvent<unknown>): void {
    const target = this.tenantAwareTarget(event.metadata.target);
    if (target === undefined || event.entity == null) {
      return;
    }
    const tenantId = this.requireTenant('insert', target);
    if (tenantId === undefined) {
      return;
    }
    (event.entity as TenantRecord)[tenantColumnFor(target, this.options)] = tenantId;
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    const target = this.tenantAwareTarget(event.metadata.target);
    if (target === undefined) {
      return;
    }
    const tenantId = this.requireTenant('update', target);
    if (tenantId === undefined) {
      return;
    }
    const column = tenantColumnFor(target, this.options);

    const existing = (event.databaseEntity ?? undefined) as TenantRecord | undefined;
    const existingTenant = existing?.[column] as string | undefined;
    if (existingTenant !== undefined && existingTenant !== tenantId) {
      throw new CrossTenantOperationError(
        `Refusing to update a "${target.name}" row owned by tenant ` +
          `"${existingTenant}" from tenant "${tenantId}"'s context.`,
      );
    }

    const updated = (event.entity ?? undefined) as TenantRecord | undefined;
    const updatedTenant = updated?.[column];
    if (updatedTenant !== undefined && updatedTenant !== tenantId) {
      throw new CrossTenantOperationError(
        `Refusing to rebind ${target.name}.${column} to another tenant.`,
      );
    }
    if (updated !== undefined) {
      updated[column] = tenantId;
    }
  }

  beforeRemove(event: RemoveEvent<unknown>): void {
    const target = this.tenantAwareTarget(event.metadata.target);
    if (target === undefined) {
      return;
    }
    const tenantId = this.requireTenant('remove', target);
    if (tenantId === undefined) {
      return;
    }
    const column = tenantColumnFor(target, this.options);
    const existing = (event.databaseEntity ?? undefined) as TenantRecord | undefined;
    const existingTenant = existing?.[column] as string | undefined;
    if (existingTenant !== undefined && existingTenant !== tenantId) {
      throw new CrossTenantOperationError(
        `Refusing to remove a "${target.name}" row owned by tenant ` +
          `"${existingTenant}" from tenant "${tenantId}"'s context.`,
      );
    }
  }

  /** Returns the entity class when the event concerns a tenant-aware entity. */
  private tenantAwareTarget(target: unknown): EntityClass | undefined {
    if (this.options.isolation === 'schema-per-tenant') {
      return undefined;
    }
    if (typeof target !== 'function') {
      return undefined;
    }
    return isTenantAwareEntity(target, this.options) ? target : undefined;
  }

  /**
   * Resolves the tenant; throws or signals passthrough (undefined) per the
   * configured missing-tenant behavior.
   */
  private requireTenant(operation: string, target: EntityClass): string | undefined {
    const tenantId = this.options.getTenantId();
    if (tenantId !== undefined) {
      return tenantId;
    }
    if (this.options.onMissingTenant === 'passthrough') {
      return undefined;
    }
    throw new MissingTenantError(
      `${operation} on tenant-aware entity "${target.name}" was attempted ` +
        'without a tenant in context. Wrap the unit of work in ' +
        "TenantContextService.run(), or mark the entity @GlobalEntity() if it isn't tenant-scoped.",
    );
  }
}

/** Factory mirroring the Prisma adapter's ergonomics. */
export function createTenantSubscriber(options: TenantryTypeOrmOptions = {}): TenantSubscriber {
  return new TenantSubscriber(options);
}
