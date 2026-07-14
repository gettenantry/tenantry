/**
 * The flagship test of Tenantry: proves, against a REAL PostgreSQL (no
 * mocks), that a request running under tenant A can never read or write
 * tenant B's rows — in both isolation modes, and even when the application
 * layer is deliberately bypassed with a raw, unfiltered SQL query.
 *
 * Setup notes that matter for correctness:
 * - The application connects as `app_user`, a NON-superuser role: PostgreSQL
 *   superusers always bypass RLS, so testing through the container's default
 *   superuser would prove nothing.
 * - Policies are created through RlsSessionService's DDL builders — the same
 *   code paths users are given in the docs.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MissingTenantError, RlsSessionService, runWithTenant } from '@tenantry/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTenancyExtension } from '../../src';
import { PrismaClient } from './generated/client';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let container: StartedPostgreSqlContainer;
let admin: PrismaClient;
let appUrl: string;
const disposers: (() => Promise<void>)[] = [];

function appClient(isolation: 'hybrid' | 'rls-only') {
  const base = new PrismaClient({ datasourceUrl: appUrl });
  disposers.push(() => base.$disconnect());
  return base.$extends(createTenancyExtension({ models: ['Project'], isolation }));
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  admin = new PrismaClient({ datasourceUrl: container.getConnectionUri() });
  disposers.push(() => admin.$disconnect());

  const rls = new RlsSessionService();
  const statements = [
    `CREATE TABLE "Project" (
       "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
       "tenantId" TEXT NOT NULL,
       "name" TEXT NOT NULL
     )`,
    ...rls.buildEnableRlsDdl('Project'),
    rls.buildTenantPolicyDdl('Project', 'tenantId'),
    `CREATE ROLE app_user LOGIN PASSWORD 'app_password'`,
    `GRANT USAGE ON SCHEMA public TO app_user`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON "Project" TO app_user`,
  ];
  for (const sql of statements) {
    await admin.$executeRawUnsafe(sql);
  }

  // Seed both tenants as the superuser (which legitimately bypasses RLS).
  await admin.project.createMany({
    data: [
      { id: 'a-1', tenantId: TENANT_A, name: 'Apollo' },
      { id: 'a-2', tenantId: TENANT_A, name: 'Artemis' },
      { id: 'b-1', tenantId: TENANT_B, name: 'Borealis' },
      { id: 'b-2', tenantId: TENANT_B, name: 'Bifrost' },
    ],
  });

  appUrl = `postgresql://app_user:app_password@${container.getHost()}:${container.getMappedPort(
    5432,
  )}/${container.getDatabase()}`;
});

afterAll(async () => {
  for (const dispose of disposers) {
    await dispose();
  }
  await container.stop();
});

describe.each(['hybrid', 'rls-only'] as const)('isolation mode: %s', (isolation) => {
  it('reads only the current tenant rows', async () => {
    const prisma = appClient(isolation);
    const rows = await runWithTenant(TENANT_A, async () => prisma.project.findMany());
    expect(rows.map((r) => r.tenantId)).toEqual([TENANT_A, TENANT_A]);
  });

  it('cannot fetch another tenant row by primary key', async () => {
    const prisma = appClient(isolation);
    const row = await runWithTenant(TENANT_A, async () =>
      prisma.project.findUnique({ where: { id: 'b-1' } }),
    );
    expect(row).toBeNull();
  });

  it('bulk updates never touch another tenant', async () => {
    const prisma = appClient(isolation);
    const result = await runWithTenant(TENANT_A, async () =>
      prisma.project.updateMany({ data: { name: 'renamed' } }),
    );
    expect(result.count).toBe(2);

    const untouched = await admin.project.findMany({ where: { tenantId: TENANT_B } });
    expect(untouched.map((r) => r.name).sort()).toEqual(['Bifrost', 'Borealis']);
  });

  it('bulk deletes never touch another tenant', async () => {
    const prisma = appClient(isolation);
    const created = await runWithTenant(TENANT_B, async () =>
      prisma.project.create({ data: { id: `tmp-${isolation}`, tenantId: TENANT_B, name: 'temp' } }),
    );
    expect(created.tenantId).toBe(TENANT_B);

    const result = await runWithTenant(TENANT_A, async () => prisma.project.deleteMany());
    expect(result.count).toBe(2);

    const bRows = await admin.project.findMany({ where: { tenantId: TENANT_B } });
    expect(bRows.length).toBeGreaterThanOrEqual(3);

    // Restore tenant A rows for the following tests.
    await admin.project.createMany({
      data: [
        { id: `a-1-${isolation}`, tenantId: TENANT_A, name: 'Apollo' },
        { id: `a-2-${isolation}`, tenantId: TENANT_A, name: 'Artemis' },
      ],
    });
    await admin.project.delete({ where: { id: `tmp-${isolation}` } });
  });

  it('THE deliberate-bug test: a raw, unfiltered query still cannot leak rows', async () => {
    const prisma = appClient(isolation);

    // Simulated application bug: a developer writes a raw query and forgets
    // the tenant WHERE clause entirely. The extension cannot filter raw SQL —
    // only the PostgreSQL policy stands between tenants.
    const leaked = await runWithTenant(TENANT_A, async () =>
      prisma.$queryRawUnsafe<{ tenantId: string }[]>('SELECT * FROM "Project"'),
    );

    expect(leaked.length).toBeGreaterThan(0);
    expect(new Set(leaked.map((r) => r.tenantId))).toEqual(new Set([TENANT_A]));
  });

  it('rejects operations without a tenant in context', async () => {
    const prisma = appClient(isolation);
    await expect(async () => prisma.project.findMany()).rejects.toThrow(MissingTenantError);
  });
});

describe('hybrid-specific behavior', () => {
  it('stamps creates with the context tenant, ignoring attacker-supplied values', async () => {
    const prisma = appClient('hybrid');
    const created = await runWithTenant(TENANT_A, async () =>
      prisma.project.create({
        // @ts-expect-error — simulating a malicious/buggy payload
        data: { id: 'evil-1', tenantId: TENANT_B, name: 'smuggled' },
      }),
    );
    expect(created.tenantId).toBe(TENANT_A);
    await admin.project.delete({ where: { id: 'evil-1' } });
  });
});

describe('rls-only-specific behavior', () => {
  it('lets PostgreSQL reject writes for another tenant (WITH CHECK)', async () => {
    const prisma = appClient('rls-only');
    await expect(
      runWithTenant(TENANT_A, async () =>
        prisma.project.create({ data: { id: 'evil-2', tenantId: TENANT_B, name: 'smuggled' } }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('defense in depth without the extension', () => {
  it('a completely unprotected client sees nothing (no session variable, policy fails closed)', async () => {
    const naked = new PrismaClient({ datasourceUrl: appUrl });
    disposers.push(() => naked.$disconnect());
    const rows = await naked.$queryRawUnsafe<unknown[]>('SELECT * FROM "Project"');
    expect(rows).toEqual([]);
  });

  it('sanity check: the data does exist for the superuser', async () => {
    const all = await admin.project.findMany();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });
});
