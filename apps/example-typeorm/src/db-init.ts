import { RlsSessionService } from '@tenantry/core';
import { DataSource } from 'typeorm';

/**
 * Provisions the demo database: table, RLS policy (via the same
 * RlsSessionService DDL builders the library documents) and the
 * non-superuser application role. Idempotent; runs as the admin connection.
 * Shares the table with example-prisma — both demos operate on the same
 * data, which makes the side-by-side comparison direct.
 */
async function init(): Promise<void> {
  const admin = new DataSource({
    type: 'postgres',
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/tenantry_example',
  });
  await admin.initialize();
  const rls = new RlsSessionService();

  try {
    await admin.query(`CREATE TABLE IF NOT EXISTS "Project" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE INDEX IF NOT EXISTS "Project_tenantId_idx" ON "Project"("tenantId")`);
    for (const ddl of rls.buildEnableRlsDdl('Project')) {
      await admin.query(ddl);
    }
    const hasPolicy: unknown[] = await admin.query(
      `SELECT 1 FROM pg_policies WHERE tablename = 'Project' AND policyname = 'tenant_isolation'`,
    );
    if (hasPolicy.length === 0) {
      await admin.query(rls.buildTenantPolicyDdl('Project', 'tenantId'));
    }
    await admin.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user LOGIN PASSWORD 'app_password';
        END IF;
      END
      $$`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO app_user`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "Project" TO app_user`);
    console.log('Database initialized: table, RLS policy and app_user role are in place.');
  } finally {
    await admin.destroy();
  }
}

void init();
