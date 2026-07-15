import { createTenantSubscriber } from '@tenantry/typeorm';
import { DataSource } from 'typeorm';

import { Project } from './project.entity';

export const APP_DATABASE_URL =
  process.env['APP_DATABASE_URL'] ??
  'postgresql://app_user:app_password@localhost:5432/tenantry_example';

/**
 * The API connects as a NON-superuser role so Row-Level Security applies
 * (superusers bypass RLS). See db-init.ts for the role and the policy.
 */
export function createDataSource(): DataSource {
  const dataSource = new DataSource({
    type: 'postgres',
    url: APP_DATABASE_URL,
    entities: [Project],
    synchronize: false,
  });
  dataSource.subscribers.push(createTenantSubscriber());
  return dataSource;
}
