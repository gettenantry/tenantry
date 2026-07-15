/**
 * @tenantry/typeorm — TypeORM adapter for Tenantry.
 */

export {
  GlobalEntity,
  TenantAware,
  getTenantAwareOptions,
  isMarkedGlobal,
  isMarkedTenantAware,
  type TenantAwareOptions,
} from './decorators';

export { CrossTenantOperationError } from './errors';

export {
  isTenantAwareEntity,
  resolveOptions,
  tenantColumnFor,
  type MissingTenantBehavior,
  type ResolvedTenantryTypeOrmOptions,
  type SchemaPerTenantOptions,
  type TenantryTypeOrmOptions,
  type TypeOrmIsolationMode,
} from './options';

export { createTenantSubscriber, TenantSubscriber } from './tenant-subscriber';
export { createTenantRepository, TenantBaseRepository } from './tenant-repository';
