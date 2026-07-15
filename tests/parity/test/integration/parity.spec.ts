/**
 * Cross-adapter regression suite (#25): ONE isolation scenario, executed
 * against the Prisma adapter AND the TypeORM adapter, on the SAME table of
 * the SAME PostgreSQL. Both must produce exactly the same outcomes — any
 * divergence in security behavior between adapters fails this build.
 */
import 'reflect-metadata';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MissingTenantError, RlsSessionService, runWithTenant } from '@tenantry/core';
import { createTenancyExtension } from '@tenantry/prisma';
import { createTenantRepository, createTenantSubscriber } from '@tenantry/typeorm';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from './generated/client';
import { ProjectEntity } from './project.entity';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

interface Row {
  id: string;
  tenantId: string;
  name: string;
}

/** The adapter-agnostic surface the shared scenario runs against. */
interface AdapterHarness {
  name: string;
  list(tenant: string): Promise<Row[]>;
  getById(tenant: string, id: string): Promise<Row | null>;
  create(tenant: string, row: Row): Promise<Row>;
  updateAllNames(tenant: string, name: string): Promise<number>;
  deleteById(tenant: string, id: string): Promise<void>;
  /** Deliberate bug: raw SQL, no tenant filter. */
  rawUnfiltered(tenant: string): Promise<{ tenantId: string }[]>;
  /** Must reject with MissingTenantError. */
  listWithoutTenant(): Promise<unknown>;
}

let container: StartedPostgreSqlContainer;
let admin: DataSource;
let appUrl: string;
const disposers: (() => Promise<void>)[] = [];

function prismaHarness(): AdapterHarness {
  const base = new PrismaClient({ datasourceUrl: appUrl });
  disposers.push(() => base.$disconnect());
  const client = base.$extends(createTenancyExtension({ models: ['Project'] }));
  return {
    name: 'prisma',
    list: (tenant) =>
      runWithTenant(tenant, async () => client.project.findMany({ orderBy: { id: 'asc' } })),
    getById: (tenant, id) =>
      runWithTenant(tenant, async () => client.project.findUnique({ where: { id } })),
    create: (tenant, row) =>
      runWithTenant(tenant, async () => client.project.create({ data: row })),
    updateAllNames: async (tenant, name) => {
      const result = await runWithTenant(tenant, async () =>
        client.project.updateMany({ data: { name } }),
      );
      return result.count;
    },
    deleteById: async (tenant, id) => {
      await runWithTenant(tenant, async () => client.project.deleteMany({ where: { id } }));
    },
    rawUnfiltered: (tenant) =>
      runWithTenant(tenant, async () =>
        client.$queryRawUnsafe<{ tenantId: string }[]>('SELECT * FROM "Project"'),
      ),
    listWithoutTenant: async () => client.project.findMany(),
  };
}

async function typeormHarness(): Promise<AdapterHarness> {
  const source = new DataSource({
    type: 'postgres',
    url: appUrl,
    entities: [ProjectEntity],
    synchronize: false,
  });
  source.subscribers.push(createTenantSubscriber());
  await source.initialize();
  disposers.push(() => source.destroy());
  const repo = createTenantRepository(source, ProjectEntity);
  return {
    name: 'typeorm',
    list: (tenant) => runWithTenant(tenant, async () => repo.find({ order: { id: 'ASC' } })),
    getById: (tenant, id) => runWithTenant(tenant, async () => repo.findOneBy({ id })),
    create: (tenant, row) => runWithTenant(tenant, async () => repo.save({ ...row })),
    updateAllNames: async (tenant, name) => {
      const result = await runWithTenant(tenant, async () => repo.update({}, { name }));
      return result.affected ?? -1;
    },
    deleteById: async (tenant, id) => {
      await runWithTenant(tenant, async () => repo.delete({ id }));
    },
    rawUnfiltered: (tenant) =>
      runWithTenant(tenant, async () =>
        repo.manager.transaction(async (em) => {
          await em.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenant]);
          return em.query('SELECT * FROM "Project"') as Promise<{ tenantId: string }[]>;
        }),
      ),
    listWithoutTenant: async () => repo.find(),
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['TENANTRY_TEST_DATABASE_URL'] = container.getConnectionUri();

  admin = new DataSource({ type: 'postgres', url: container.getConnectionUri() });
  await admin.initialize();
  disposers.push(() => admin.destroy());

  const rls = new RlsSessionService();
  const statements = [
    `CREATE TABLE "Project" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL)`,
    ...rls.buildEnableRlsDdl('Project'),
    rls.buildTenantPolicyDdl('Project', 'tenantId'),
    `CREATE ROLE app_user LOGIN PASSWORD 'app_password'`,
    `GRANT USAGE ON SCHEMA public TO app_user`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON "Project" TO app_user`,
  ];
  for (const sql of statements) {
    await admin.query(sql);
  }
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

beforeEach(async () => {
  await admin.query('TRUNCATE "Project"');
  await admin.query(`INSERT INTO "Project" VALUES
    ('a-1', 'tenant-a', 'Apollo'),
    ('a-2', 'tenant-a', 'Artemis'),
    ('b-1', 'tenant-b', 'Borealis')`);
});

/**
 * The single source of truth for what "isolated" means. Every adapter runs
 * exactly this — identical assertions, identical expected values.
 */
function isolationScenario(getHarness: () => Promise<AdapterHarness> | AdapterHarness): void {
  it('lists only the current tenant rows', async () => {
    const h = await getHarness();
    const rows = await h.list(TENANT_A);
    expect(rows.map((r) => r.id)).toEqual(['a-1', 'a-2']);
  });

  it("cannot fetch another tenant's row by id", async () => {
    const h = await getHarness();
    expect(await h.getById(TENANT_A, 'b-1')).toBeNull();
  });

  it('stamps creates with the context tenant, overriding smuggled values', async () => {
    const h = await getHarness();
    const created = await h.create(TENANT_A, { id: 'new-1', tenantId: TENANT_B, name: 'smuggled' });
    expect(created.tenantId).toBe(TENANT_A);
  });

  it('bulk updates touch exactly the current tenant rows', async () => {
    const h = await getHarness();
    expect(await h.updateAllNames(TENANT_A, 'renamed')).toBe(2);
    const bRows = (await admin.query(
      `SELECT name FROM "Project" WHERE "tenantId" = 'tenant-b'`,
    )) as { name: string }[];
    expect(bRows.map((r) => r.name)).toEqual(['Borealis']);
  });

  it("deletes by another tenant's id are no-ops", async () => {
    const h = await getHarness();
    await h.deleteById(TENANT_A, 'b-1');
    const bRow = (await admin.query(`SELECT id FROM "Project" WHERE id = 'b-1'`)) as unknown[];
    expect(bRow).toHaveLength(1);
  });

  it('deliberate bug: an unfiltered raw query still leaks nothing', async () => {
    const h = await getHarness();
    const rows = await h.rawUnfiltered(TENANT_A);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set([TENANT_A]));
  });

  it('rejects tenant-less operations with MissingTenantError', async () => {
    const h = await getHarness();
    await expect(h.listWithoutTenant()).rejects.toThrow(MissingTenantError);
  });
}

describe('isolation parity — prisma adapter', () => {
  isolationScenario(() => prismaHarness());
});

describe('isolation parity — typeorm adapter', () => {
  isolationScenario(() => typeormHarness());
});
