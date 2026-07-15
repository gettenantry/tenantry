import { MissingTenantError, runWithTenant, TenancyError } from '@tenantry/core';
import { In, type EntityManager } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { GlobalEntity, TenantAware } from './decorators';
import { createTenantRepository, TenantBaseRepository } from './tenant-repository';
import { type TenantryTypeOrmOptions } from './options';

@TenantAware()
class Project {
  id!: string;
  tenantId!: string;
  name!: string;
}

@GlobalEntity()
class Country {
  code!: string;
}

interface Call {
  method: string;
  args: unknown[];
}

interface Harness {
  repo: TenantBaseRepository<Project>;
  calls: Call[];
  queries: { sql: string; parameters: unknown[] }[];
  transactions: number;
}

/**
 * Fake EntityManager: records every call, echoes back sentinel results, and
 * implements transaction() by re-entering itself.
 */
function fakeManager(state: {
  calls: Call[];
  queries: { sql: string; parameters: unknown[] }[];
  transactions: number;
}): EntityManager {
  const record =
    (method: string, result: unknown = `${method}-result`) =>
    (...args: unknown[]) => {
      state.calls.push({ method, args });
      return Promise.resolve(result);
    };

  const manager = {
    connection: {
      getMetadata: () => ({
        primaryColumns: [{ propertyName: 'id' }],
      }),
    },
    query: (sql: string, parameters: unknown[] = []) => {
      state.queries.push({ sql, parameters });
      return Promise.resolve([]);
    },
    transaction: async <T>(cb: (em: EntityManager) => Promise<T>): Promise<T> => {
      state.transactions += 1;
      return cb(manager as unknown as EntityManager);
    },
    find: record('find', ['row']),
    findBy: record('findBy', ['row']),
    findAndCount: record('findAndCount', [['row'], 1]),
    findAndCountBy: record('findAndCountBy', [['row'], 1]),
    findOne: record('findOne', null),
    findOneBy: record('findOneBy', null),
    findOneOrFail: record('findOneOrFail', 'row'),
    findOneByOrFail: record('findOneByOrFail', 'row'),
    count: record('count', 2),
    countBy: record('countBy', 2),
    exists: record('exists', true),
    existsBy: record('existsBy', true),
    update: record('update', { affected: 1 }),
    delete: record('delete', { affected: 1 }),
    save: record('save', { saved: true }),
    remove: record('remove', { removed: true }),
  };
  return manager as unknown as EntityManager;
}

function harness(options: TenantryTypeOrmOptions = {}, entity: unknown = Project): Harness {
  const state = { calls: [], queries: [], transactions: 0 } as unknown as Harness;
  const manager = fakeManager(state);
  state.repo = new TenantBaseRepository(entity as never, manager, options);
  return state;
}

function lastCall(state: Harness): Call {
  const call = state.calls.at(-1);
  if (call === undefined) {
    throw new Error('no manager call recorded');
  }
  return call;
}

describe('hybrid mode (default)', () => {
  it('merges the tenant into find options and binds the session variable in a transaction', async () => {
    const state = harness();
    const rows = await runWithTenant('tenant-a', async () =>
      state.repo.find({ where: { name: 'x' }, take: 3 }),
    );
    expect(rows).toEqual(['row']);
    expect(state.transactions).toBe(1);
    expect(state.queries).toEqual([
      { sql: 'SELECT set_config($1, $2, true)', parameters: ['app.current_tenant', 'tenant-a'] },
    ]);
    expect(lastCall(state)).toEqual({
      method: 'find',
      args: [Project, { where: { name: 'x', tenantId: 'tenant-a' }, take: 3 }],
    });
  });

  it('scopes even when no where is provided', async () => {
    const state = harness();
    await runWithTenant('tenant-a', async () => state.repo.count());
    expect(lastCall(state).args[1]).toEqual({ where: { tenantId: 'tenant-a' } });
  });

  it('scopes each branch of an OR (array) where', async () => {
    const state = harness();
    await runWithTenant('tenant-a', async () =>
      state.repo.findBy([{ name: 'x' }, { name: 'y' }] as never),
    );
    expect(lastCall(state).args[1]).toEqual([
      { name: 'x', tenantId: 'tenant-a' },
      { name: 'y', tenantId: 'tenant-a' },
    ]);
  });

  it('overrides an attacker-supplied tenant in where clauses', async () => {
    const state = harness();
    await runWithTenant('tenant-a', async () =>
      state.repo.findOneBy({ id: '42', tenantId: 'tenant-b' } as never),
    );
    expect(lastCall(state).args[1]).toEqual({ id: '42', tenantId: 'tenant-a' });
  });

  it.each([
    ['find', (r: TenantBaseRepository<Project>) => r.find()],
    ['findBy', (r: TenantBaseRepository<Project>) => r.findBy({} as never)],
    ['findAndCount', (r: TenantBaseRepository<Project>) => r.findAndCount()],
    ['findAndCountBy', (r: TenantBaseRepository<Project>) => r.findAndCountBy({} as never)],
    ['findOne', (r: TenantBaseRepository<Project>) => r.findOne({ where: {} })],
    ['findOneBy', (r: TenantBaseRepository<Project>) => r.findOneBy({} as never)],
    ['findOneOrFail', (r: TenantBaseRepository<Project>) => r.findOneOrFail({ where: {} })],
    ['findOneByOrFail', (r: TenantBaseRepository<Project>) => r.findOneByOrFail({} as never)],
    ['count', (r: TenantBaseRepository<Project>) => r.count()],
    ['countBy', (r: TenantBaseRepository<Project>) => r.countBy({} as never)],
    ['exists', (r: TenantBaseRepository<Project>) => r.exists()],
    ['existsBy', (r: TenantBaseRepository<Project>) => r.existsBy({} as never)],
  ])('%s runs bound and scoped', async (method, run) => {
    const state = harness();
    await runWithTenant('tenant-a', async () => run(state.repo));
    expect(state.transactions).toBe(1);
    expect(lastCall(state).method).toBe(method);
  });

  describe('criteria writes', () => {
    it('scopes object criteria on update', async () => {
      const state = harness();
      await runWithTenant('tenant-a', async () =>
        state.repo.update({ name: 'old' }, { name: 'new' }),
      );
      expect(lastCall(state)).toEqual({
        method: 'update',
        args: [Project, { name: 'old', tenantId: 'tenant-a' }, { name: 'new' }],
      });
    });

    it('converts a primitive id into a scoped where on delete', async () => {
      const state = harness();
      await runWithTenant('tenant-a', async () => state.repo.delete('42'));
      expect(lastCall(state).args[1]).toEqual({ id: '42', tenantId: 'tenant-a' });
    });

    it('converts an id array into a scoped In() where', async () => {
      const state = harness();
      await runWithTenant('tenant-a', async () => state.repo.delete(['1', '2']));
      expect(lastCall(state).args[1]).toEqual({ id: In(['1', '2']), tenantId: 'tenant-a' });
    });

    it('scopes arrays of where objects', async () => {
      const state = harness();
      await runWithTenant('tenant-a', async () =>
        state.repo.update([{ name: 'a' }, { name: 'b' }] as never, { name: 'z' }),
      );
      expect(lastCall(state).args[1]).toEqual([
        { name: 'a', tenantId: 'tenant-a' },
        { name: 'b', tenantId: 'tenant-a' },
      ]);
    });
  });

  it('runs save and remove inside the bound transaction (subscriber does the stamping)', async () => {
    const state = harness();
    await runWithTenant('tenant-a', async () => state.repo.save({ name: 'p' } as never));
    await runWithTenant('tenant-a', async () => state.repo.remove({ id: '1' } as never));
    expect(state.transactions).toBe(2);
    expect(state.calls.map((c) => c.method)).toEqual(['save', 'remove']);
  });

  it('skips the transaction when sessionVariable is false but still filters', async () => {
    const state = harness({ sessionVariable: false });
    await runWithTenant('tenant-a', async () => state.repo.find());
    expect(state.transactions).toBe(0);
    expect(state.queries).toEqual([]);
    expect(lastCall(state).args[1]).toEqual({ where: { tenantId: 'tenant-a' } });
  });
});

describe('rls-only mode', () => {
  it('binds the session variable but leaves criteria untouched', async () => {
    const state = harness({ isolation: 'rls-only' });
    await runWithTenant('tenant-a', async () => state.repo.find({ where: { name: 'x' } }));
    expect(state.transactions).toBe(1);
    expect(state.queries[0]?.parameters).toEqual(['app.current_tenant', 'tenant-a']);
    expect(lastCall(state).args[1]).toEqual({ where: { name: 'x' } });
  });

  it('leaves findOne options and write criteria untouched', async () => {
    const state = harness({ isolation: 'rls-only' });
    await runWithTenant('tenant-a', async () => {
      await state.repo.findOne({ where: { id: '42' } });
      await state.repo.delete('42');
    });
    expect(state.calls[0]?.args[1]).toEqual({ where: { id: '42' } });
    expect(state.calls[1]?.args[1]).toBe('42');
    expect(state.transactions).toBe(2);
  });
});

describe('schema-per-tenant mode', () => {
  it('binds search_path to the tenant schema plus shared schemas', async () => {
    const state = harness({ isolation: 'schema-per-tenant' });
    await runWithTenant('Tenant-A', async () => state.repo.find());
    expect(state.queries).toEqual([
      {
        sql: 'SELECT set_config($1, $2, true)',
        parameters: ['search_path', 'tenant_tenant_a,public'],
      },
    ]);
    expect(lastCall(state).args[1]).toEqual({});
  });

  it('honors custom naming and shared schemas', async () => {
    const state = harness({
      isolation: 'schema-per-tenant',
      schema: { naming: (t) => `t_${t}`, sharedSchemas: ['shared', 'public'] },
    });
    await runWithTenant('acme', async () => state.repo.findBy({ name: 'x' } as never));
    expect(state.queries[0]?.parameters).toEqual(['search_path', 't_acme,shared,public']);
    expect(lastCall(state).args[1]).toEqual({ name: 'x' });
  });
});

describe('global entities and passthrough', () => {
  it('passes global entities through to the plain repository path', async () => {
    const state = harness({}, Country);
    const result = await runWithTenant('tenant-a', async () =>
      (state.repo as unknown as TenantBaseRepository<Country>).find(),
    );
    expect(result).toEqual(['row']);
    expect(state.transactions).toBe(0);
    // Plain path goes through Repository -> this.manager directly.
    expect(lastCall(state).method).toBe('find');
    expect(lastCall(state).args[1]).toBeUndefined();
  });

  it('runs global-entity save and remove through the plain path', async () => {
    const state = harness({}, Country);
    const repo = state.repo as unknown as TenantBaseRepository<Country>;
    await runWithTenant('tenant-a', async () => repo.save({ code: 'FR' } as never));
    await runWithTenant('tenant-a', async () => repo.remove({ code: 'FR' } as never));
    expect(state.transactions).toBe(0);
    expect(state.calls.map((c) => c.method)).toEqual(['save', 'remove']);
  });

  it('scopes string-target entities with the adapter-wide tenant column', async () => {
    const state = harness({ tenantColumn: 'orgId' }, 'project_table');
    await runWithTenant('tenant-a', async () => state.repo.findBy({ name: 'x' } as never));
    expect(lastCall(state).args[1]).toEqual({ name: 'x', orgId: 'tenant-a' });
  });

  it('throws on missing tenant by default', async () => {
    const state = harness();
    await expect(state.repo.find()).rejects.toThrow(MissingTenantError);
  });

  it('passes through on missing tenant when configured', async () => {
    const state = harness({ onMissingTenant: 'passthrough' });
    await state.repo.find();
    expect(state.transactions).toBe(0);
  });

  it('fails closed for string targets (cannot carry decorators)', async () => {
    const state = harness({}, 'project_table');
    await expect(state.repo.find()).rejects.toThrow(MissingTenantError);
  });
});

describe('id-criteria safety', () => {
  it('refuses id criteria on entities with composite primary keys', async () => {
    const state = harness();
    const manager = fakeManager(state);
    (manager.connection as unknown as { getMetadata: () => unknown }).getMetadata = () => ({
      primaryColumns: [{ propertyName: 'a' }, { propertyName: 'b' }],
    });
    const repo = new TenantBaseRepository(Project, manager, {});
    await expect(runWithTenant('tenant-a', async () => repo.delete('42'))).rejects.toThrow(
      TenancyError,
    );
  });
});

describe('createTenantRepository', () => {
  it('accepts a DataSource-like source', () => {
    const state = { calls: [], queries: [], transactions: 0 } as unknown as Harness;
    const manager = fakeManager(state);
    const dataSource = { manager } as never;
    const repo = createTenantRepository(dataSource, Project);
    expect(repo).toBeInstanceOf(TenantBaseRepository);
  });

  it('accepts a bare EntityManager', () => {
    const state = { calls: [], queries: [], transactions: 0 } as unknown as Harness;
    const manager = fakeManager(state);
    const repo = createTenantRepository(manager, Project);
    expect(repo).toBeInstanceOf(TenantBaseRepository);
  });
});
