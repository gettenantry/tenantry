import { describe, expect, it } from 'vitest';

import { applyTenantToArgs, UnsupportedOperationError } from './args-transform';

const FIELD = 'tenantId';
const TENANT = 'tenant-a';

describe('applyTenantToArgs', () => {
  describe('filter operations (AND-merged where)', () => {
    it.each([
      'findMany',
      'findFirst',
      'findFirstOrThrow',
      'updateMany',
      'updateManyAndReturn',
      'deleteMany',
      'count',
      'aggregate',
      'groupBy',
    ])('%s: adds the tenant filter when where is absent', (operation) => {
      expect(applyTenantToArgs(operation, undefined, FIELD, TENANT)).toEqual({
        where: { tenantId: TENANT },
      });
    });

    it('AND-merges an existing where so user filters cannot widen the scope', () => {
      const args = { where: { OR: [{ name: 'x' }, { tenantId: 'tenant-b' }] }, take: 5 };
      expect(applyTenantToArgs('findMany', args, FIELD, TENANT)).toEqual({
        where: { AND: [{ tenantId: TENANT }, { OR: [{ name: 'x' }, { tenantId: 'tenant-b' }] }] },
        take: 5,
      });
    });

    it('preserves unrelated arguments', () => {
      const args = { orderBy: { name: 'asc' }, skip: 10 };
      expect(applyTenantToArgs('findMany', args, FIELD, TENANT)).toEqual({
        orderBy: { name: 'asc' },
        skip: 10,
        where: { tenantId: TENANT },
      });
    });
  });

  describe('unique operations (merged where)', () => {
    it.each(['findUnique', 'findUniqueOrThrow', 'update', 'delete'])(
      '%s: merges the tenant field into the unique selector',
      (operation) => {
        const scoped = applyTenantToArgs(operation, { where: { id: '42' } }, FIELD, TENANT);
        expect(scoped['where']).toEqual({ id: '42', tenantId: TENANT });
      },
    );

    it('overrides an attacker-supplied tenant in the unique selector', () => {
      const scoped = applyTenantToArgs(
        'findUnique',
        { where: { id: '42', tenantId: 'tenant-b' } },
        FIELD,
        TENANT,
      );
      expect(scoped['where']).toEqual({ id: '42', tenantId: TENANT });
    });

    it('keeps update data untouched', () => {
      const scoped = applyTenantToArgs(
        'update',
        { where: { id: '42' }, data: { name: 'renamed' } },
        FIELD,
        TENANT,
      );
      expect(scoped['data']).toEqual({ name: 'renamed' });
    });
  });

  describe('create operations (stamped data)', () => {
    it('create: stamps the tenant into data', () => {
      expect(applyTenantToArgs('create', { data: { name: 'p1' } }, FIELD, TENANT)).toEqual({
        data: { name: 'p1', tenantId: TENANT },
      });
    });

    it('create: overrides an attacker-supplied tenant', () => {
      const scoped = applyTenantToArgs(
        'create',
        { data: { name: 'p1', tenantId: 'tenant-b' } },
        FIELD,
        TENANT,
      );
      expect(scoped['data']).toEqual({ name: 'p1', tenantId: TENANT });
    });

    it('create: stamps even when data is absent', () => {
      expect(applyTenantToArgs('create', {}, FIELD, TENANT)).toEqual({
        data: { tenantId: TENANT },
      });
    });

    it.each(['createMany', 'createManyAndReturn'])(
      '%s: stamps every row of a list',
      (operation) => {
        const scoped = applyTenantToArgs(
          operation,
          { data: [{ name: 'a' }, { name: 'b', tenantId: 'tenant-b' }] },
          FIELD,
          TENANT,
        );
        expect(scoped['data']).toEqual([
          { name: 'a', tenantId: TENANT },
          { name: 'b', tenantId: TENANT },
        ]);
      },
    );
  });

  describe('upsert', () => {
    it('scopes the selector and stamps the create branch, leaving update alone', () => {
      const scoped = applyTenantToArgs(
        'upsert',
        {
          where: { id: '42' },
          create: { name: 'new' },
          update: { name: 'existing' },
        },
        FIELD,
        TENANT,
      );
      expect(scoped).toEqual({
        where: { id: '42', tenantId: TENANT },
        create: { name: 'new', tenantId: TENANT },
        update: { name: 'existing' },
      });
    });
  });

  describe('unknown operations', () => {
    it('fails closed instead of running unfiltered', () => {
      expect(() => applyTenantToArgs('findRaw', {}, FIELD, TENANT)).toThrow(
        UnsupportedOperationError,
      );
    });
  });
});
