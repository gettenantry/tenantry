/**
 * TypeORM twin of the Prisma flagship suite: proves against a REAL
 * PostgreSQL that tenant A can never read or write tenant B's rows — in
 * hybrid and rls-only modes, plus the schema-per-tenant strategy — including
 * the deliberate-bug scenario (an unfiltered raw query).
 *
 * As with the Prisma suite, the application connects as a NON-superuser
 * role (superusers bypass RLS) and policies come from RlsSessionService's
 * DDL builders.
 */
import 'reflect-metadata';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MissingTenantError, RlsSessionService, runWithTenant } from '@tenantry/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTenantRepository, createTenantSubscriber } from '../../src';
import { Note, Project } from './entities';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let container: StartedPostgreSqlContainer;
let admin: DataSource;
const sources: DataSource[] = [];

async function appDataSource(): Promise<DataSource> {
  const source = new DataSource({
    type: 'postgres',
    host: container.getHost(),
    port: container.getMappedPort(5432),
    username: 'app_user',
    password: 'app_password',
    database: container.getDatabase(),
    entities: [Project, Note],
    synchronize: false,
  });
  await source.initialize();
  sources.push(source);
  return source;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  admin = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [Project, Note],
    synchronize: false,
  });
  await admin.initialize();
  sources.push(admin);

  const rls = new RlsSessionService();
  const statements = [
    `CREATE TABLE "Project" (
       "id" TEXT PRIMARY KEY,
       "tenantId" TEXT NOT NULL,
       "name" TEXT NOT NULL
     )`,
    ...rls.buildEnableRlsDdl('Project'),
    rls.buildTenantPolicyDdl('Project', 'tenantId'),
    `CREATE ROLE app_user LOGIN PASSWORD 'app_password'`,
    `GRANT USAGE ON SCHEMA public TO app_user`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON "Project" TO app_user`,
    // Schema-per-tenant fixtures: one schema per tenant, same table shape.
    `CREATE SCHEMA tenant_tenant_a`,
    `CREATE SCHEMA tenant_tenant_b`,
    `CREATE TABLE tenant_tenant_a."Note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL)`,
    `CREATE TABLE tenant_tenant_b."Note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL)`,
    `GRANT USAGE ON SCHEMA tenant_tenant_a, tenant_tenant_b TO app_user`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_tenant_a."Note" TO app_user`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_tenant_b."Note" TO app_user`,
    // Seed.
    `INSERT INTO "Project" VALUES
       ('a-1', 'tenant-a', 'Apollo'),
       ('a-2', 'tenant-a', 'Artemis'),
       ('b-1', 'tenant-b', 'Borealis'),
       ('b-2', 'tenant-b', 'Bifrost')`,
    `INSERT INTO tenant_tenant_a."Note" VALUES ('n-a', 'alpha note')`,
    `INSERT INTO tenant_tenant_b."Note" VALUES ('n-b', 'beta note')`,
  ];
  for (const sql of statements) {
    await admin.query(sql);
  }
});

afterAll(async () => {
  for (const source of sources) {
    await source.destroy();
  }
  await container.stop();
});

describe.each(['hybrid', 'rls-only'] as const)('isolation mode: %s', (isolation) => {
  it('reads only the current tenant rows', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    const rows = await runWithTenant(TENANT_A, async () => projects.find());
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set([TENANT_A]));
  });

  it('cannot fetch another tenant row by primary key', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    const row = await runWithTenant(TENANT_A, async () => projects.findOneBy({ id: 'b-1' }));
    expect(row).toBeNull();
  });

  it('criteria updates never touch another tenant', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    await runWithTenant(TENANT_A, async () =>
      projects.update({}, { name: `renamed-${isolation}` }),
    );
    const bRows = await admin.query(`SELECT name FROM "Project" WHERE "tenantId" = 'tenant-b'`);
    expect((bRows as { name: string }[]).map((r) => r.name).sort()).toEqual([
      'Bifrost',
      'Borealis',
    ]);
  });

  it("criteria deletes by another tenant's id are no-ops", async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    await runWithTenant(TENANT_A, async () => projects.delete('b-1'));
    const bRow = await admin.query(`SELECT * FROM "Project" WHERE id = 'b-1'`);
    expect(bRow).toHaveLength(1);
  });

  it('THE deliberate-bug test: a raw, unfiltered query still cannot leak rows', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    // Simulated bug: raw SQL with no tenant filter, run through the scoped
    // repository's transaction so the session variable is bound — the RLS
    // policy is the only thing standing, and it holds.
    const leaked = await runWithTenant(TENANT_A, async () =>
      projects.manager.transaction(async (em) => {
        await em.query(`SELECT set_config('app.current_tenant', $1, true)`, [TENANT_A]);
        return em.query('SELECT * FROM "Project"') as Promise<{ tenantId: string }[]>;
      }),
    );
    expect(leaked.length).toBeGreaterThan(0);
    expect(new Set(leaked.map((r) => r.tenantId))).toEqual(new Set([TENANT_A]));
  });

  it('rejects operations without a tenant in context', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation });
    await expect(projects.find()).rejects.toThrow(MissingTenantError);
  });
});

describe('subscriber write enforcement (hybrid)', () => {
  it('stamps saves with the context tenant, overwriting smuggled values', async () => {
    const source = await appDataSource();
    source.subscribers.push(createTenantSubscriber());
    const projects = createTenantRepository(source, Project);

    await runWithTenant(TENANT_A, async () =>
      projects.save({ id: 'evil-1', tenantId: TENANT_B, name: 'smuggled' }),
    );
    const saved = await admin.query(`SELECT "tenantId" FROM "Project" WHERE id = 'evil-1'`);
    expect((saved as { tenantId: string }[])[0]?.tenantId).toBe(TENANT_A);
    await admin.query(`DELETE FROM "Project" WHERE id = 'evil-1'`);
  });

  it("refuses hijacking another tenant's loaded row", async () => {
    const source = await appDataSource();
    source.subscribers.push(createTenantSubscriber());
    const projects = createTenantRepository(source, Project);

    const stolen = await runWithTenant(TENANT_B, async () =>
      projects.findOneByOrFail({ id: 'b-1' }),
    );
    // Under tenant A, RLS hides b-1, so TypeORM attempts an INSERT; the
    // subscriber stamps it to tenant A and the primary key collides. Which
    // layer refuses first doesn't matter — the write must fail and B's row
    // must be intact. Defense in depth in action.
    await expect(
      runWithTenant(TENANT_A, async () => projects.save({ ...stolen, name: 'hijacked' })),
    ).rejects.toThrow(/duplicate key|row-level security|CrossTenant/i);

    const untouched = await admin.query(`SELECT name, "tenantId" FROM "Project" WHERE id = 'b-1'`);
    expect(untouched).toEqual([{ name: 'Borealis', tenantId: TENANT_B }]);
  });
});

describe('rls-only write enforcement', () => {
  it('lets PostgreSQL reject writes for another tenant (WITH CHECK)', async () => {
    const source = await appDataSource();
    const projects = createTenantRepository(source, Project, { isolation: 'rls-only' });
    await expect(
      runWithTenant(TENANT_A, async () =>
        projects.save({ id: 'evil-2', tenantId: TENANT_B, name: 'smuggled' }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('schema-per-tenant strategy', () => {
  it('routes each tenant to its own schema through search_path', async () => {
    const source = await appDataSource();
    const notes = createTenantRepository(source, Note, { isolation: 'schema-per-tenant' });

    const aNotes = await runWithTenant(TENANT_A, async () => notes.find());
    const bNotes = await runWithTenant(TENANT_B, async () => notes.find());
    expect(aNotes.map((n) => n.id)).toEqual(['n-a']);
    expect(bNotes.map((n) => n.id)).toEqual(['n-b']);
  });

  it('writes land in the tenant schema only', async () => {
    const source = await appDataSource();
    const notes = createTenantRepository(source, Note, { isolation: 'schema-per-tenant' });

    await runWithTenant(TENANT_A, async () => notes.save({ id: 'n-a2', body: 'second alpha' }));
    const inA = await admin.query(`SELECT id FROM tenant_tenant_a."Note" ORDER BY id`);
    const inB = await admin.query(`SELECT id FROM tenant_tenant_b."Note"`);
    expect((inA as { id: string }[]).map((r) => r.id)).toEqual(['n-a', 'n-a2']);
    expect((inB as { id: string }[]).map((r) => r.id)).toEqual(['n-b']);
  });
});

describe('defense in depth without the adapter', () => {
  it('a completely unprotected connection sees nothing on the RLS table', async () => {
    const source = await appDataSource();
    const rows = await source.query('SELECT * FROM "Project"');
    expect(rows).toEqual([]);
  });

  it('sanity check: the data does exist for the superuser', async () => {
    const all = await admin.query('SELECT * FROM "Project"');
    expect((all as unknown[]).length).toBeGreaterThanOrEqual(4);
  });
});
