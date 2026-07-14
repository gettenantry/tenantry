import { MissingTenantError, runWithTenant } from '@tenantry/core';
import { describe, expect, it, vi } from 'vitest';

import { createTenancyExtension } from './extension';
import { type TenantryPrismaOptions } from './options';

type QueryHandler = (context: {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

type RawHandler = (context: {
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

interface CapturedConfig {
  name: string;
  query: {
    $allModels: { $allOperations: QueryHandler };
    $queryRaw: RawHandler;
    $queryRawUnsafe: RawHandler;
    $executeRaw: RawHandler;
    $executeRawUnsafe: RawHandler;
  };
}

interface FakeClient {
  config: CapturedConfig | undefined;
  transactions: unknown[][];
  rawExecutions: { sql: string; parameters: unknown[] }[];
  $extends(config: CapturedConfig): FakeClient;
  $executeRawUnsafe(sql: string, ...parameters: unknown[]): Promise<unknown>;
  $transaction(operations: Promise<unknown>[]): Promise<unknown[]>;
}

function fakeClient(): FakeClient {
  const client: FakeClient = {
    config: undefined,
    transactions: [],
    rawExecutions: [],
    $extends(config) {
      client.config = config;
      return client;
    },
    $executeRawUnsafe(sql, ...parameters) {
      client.rawExecutions.push({ sql, parameters });
      return Promise.resolve('set_config-done');
    },
    $transaction(operations) {
      client.transactions.push(operations);
      return Promise.all(operations);
    },
  };
  return client;
}

function setup(options: TenantryPrismaOptions): { client: FakeClient; config: CapturedConfig } {
  const extension = createTenancyExtension(options) as unknown as (
    client: FakeClient,
  ) => FakeClient;
  const client = fakeClient();
  extension(client);
  if (client.config === undefined) {
    throw new Error('extension did not call $extends');
  }
  return { client, config: client.config };
}

function trackingQuery(): {
  query: (args: unknown) => Promise<unknown>;
  seenArgs: () => unknown;
} {
  const spy = vi.fn((args: unknown) => Promise.resolve({ result: args }));
  return { query: spy, seenArgs: () => spy.mock.calls[0]?.[0] };
}

describe('createTenancyExtension', () => {
  it('registers handlers for model and raw operations', () => {
    const { config } = setup({ models: ['Project'] });
    expect(config.name).toBe('tenantry');
    expect(config.query.$allModels.$allOperations).toBeTypeOf('function');
    for (const op of [
      '$queryRaw',
      '$queryRawUnsafe',
      '$executeRaw',
      '$executeRawUnsafe',
    ] as const) {
      expect(config.query[op]).toBeTypeOf('function');
    }
  });

  describe('hybrid mode (default)', () => {
    it('filters the operation and binds the session variable in one transaction', async () => {
      const { client, config } = setup({ models: ['Project'] });
      const { query, seenArgs } = trackingQuery();

      await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Project',
          operation: 'findMany',
          args: { where: { name: 'x' } },
          query,
        }),
      );

      expect(seenArgs()).toEqual({
        where: { AND: [{ tenantId: 'tenant-a' }, { name: 'x' }] },
      });
      expect(client.transactions).toHaveLength(1);
      expect(client.rawExecutions).toEqual([
        {
          sql: 'SELECT set_config($1, $2, true)',
          parameters: ['app.current_tenant', 'tenant-a'],
        },
      ]);
    });

    it('returns the query result, not the set_config result', async () => {
      const { config } = setup({ models: ['Project'] });
      const result = await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Project',
          operation: 'findMany',
          args: undefined,
          query: () => Promise.resolve(['row-1']),
        }),
      );
      expect(result).toEqual(['row-1']);
    });

    it('skips RLS binding when sessionVariable is false', async () => {
      const { client, config } = setup({ models: ['Project'], sessionVariable: false });
      const { query, seenArgs } = trackingQuery();

      await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Project',
          operation: 'findMany',
          args: undefined,
          query,
        }),
      );

      expect(seenArgs()).toEqual({ where: { tenantId: 'tenant-a' } });
      expect(client.transactions).toHaveLength(0);
    });
  });

  describe('rls-only mode', () => {
    it('binds the session variable but leaves the arguments untouched', async () => {
      const { client, config } = setup({ models: ['Project'], isolation: 'rls-only' });
      const { query, seenArgs } = trackingQuery();
      const args = { where: { name: 'x' } };

      await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Project',
          operation: 'findMany',
          args,
          query,
        }),
      );

      expect(seenArgs()).toBe(args);
      expect(client.transactions).toHaveLength(1);
      expect(client.rawExecutions[0]?.parameters).toEqual(['app.current_tenant', 'tenant-a']);
    });
  });

  describe('global (non tenant-aware) models', () => {
    it('passes through untouched, without transaction overhead', async () => {
      const { client, config } = setup({ models: ['Project'] });
      const { query, seenArgs } = trackingQuery();
      const args = { where: { code: 'FR' } };

      await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Country',
          operation: 'findMany',
          args,
          query,
        }),
      );

      expect(seenArgs()).toBe(args);
      expect(client.transactions).toHaveLength(0);
    });

    it("treats every model as tenant-aware with models: 'all'", async () => {
      const { config } = setup({ models: 'all' });
      const { query, seenArgs } = trackingQuery();
      await runWithTenant('tenant-a', () =>
        config.query.$allModels.$allOperations({
          model: 'Anything',
          operation: 'findMany',
          args: undefined,
          query,
        }),
      );
      expect(seenArgs()).toEqual({ where: { tenantId: 'tenant-a' } });
    });
  });

  describe('missing tenant', () => {
    it('throws MissingTenantError by default', () => {
      const { config } = setup({ models: ['Project'] });
      const { query } = trackingQuery();
      expect(() =>
        config.query.$allModels.$allOperations({
          model: 'Project',
          operation: 'findMany',
          args: undefined,
          query,
        }),
      ).toThrow(MissingTenantError);
    });

    it('passes through when configured explicitly', async () => {
      const { config } = setup({ models: ['Project'], onMissingTenant: 'passthrough' });
      const { query, seenArgs } = trackingQuery();
      await config.query.$allModels.$allOperations({
        model: 'Project',
        operation: 'findMany',
        args: { take: 1 },
        query,
      });
      expect(seenArgs()).toEqual({ take: 1 });
    });

    it('uses a custom getTenantId resolver over the ALS context', async () => {
      const { config } = setup({ models: ['Project'], getTenantId: () => 'from-resolver' });
      const { query, seenArgs } = trackingQuery();
      await config.query.$allModels.$allOperations({
        model: 'Project',
        operation: 'findMany',
        args: undefined,
        query,
      });
      expect(seenArgs()).toEqual({ where: { tenantId: 'from-resolver' } });
    });
  });

  describe('raw operations', () => {
    it('binds the session variable around raw queries when a tenant is present', async () => {
      const { client, config } = setup({ models: ['Project'] });
      const { query, seenArgs } = trackingQuery();
      const args = { sql: 'SELECT * FROM "Project"' };

      await runWithTenant('tenant-a', () => config.query.$queryRawUnsafe({ args, query }));

      expect(seenArgs()).toBe(args);
      expect(client.transactions).toHaveLength(1);
      expect(client.rawExecutions[0]?.parameters).toEqual(['app.current_tenant', 'tenant-a']);
    });

    it('runs unbound (database fails closed) when no tenant is present', async () => {
      const { client, config } = setup({ models: ['Project'] });
      const { query, seenArgs } = trackingQuery();
      const args = { sql: 'SELECT 1' };

      await config.query.$executeRaw({ args, query });

      expect(seenArgs()).toBe(args);
      expect(client.transactions).toHaveLength(0);
    });
  });
});
