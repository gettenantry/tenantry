import { MissingTenantError, runWithTenant } from '@tenantry/core';
import { type InsertEvent, type RemoveEvent, type UpdateEvent } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { GlobalEntity, TenantAware } from './decorators';
import { CrossTenantOperationError } from './errors';
import { createTenantSubscriber, TenantSubscriber } from './tenant-subscriber';

@TenantAware()
class Project {}

@GlobalEntity()
class Country {}

function insertEvent(
  entity: Record<string, unknown> | null,
  target: unknown = Project,
): InsertEvent<unknown> {
  return { entity, metadata: { target } } as unknown as InsertEvent<unknown>;
}

function updateEvent(
  entity: Record<string, unknown> | undefined,
  databaseEntity: Record<string, unknown> | undefined,
  target: unknown = Project,
): UpdateEvent<unknown> {
  return { entity, databaseEntity, metadata: { target } } as unknown as UpdateEvent<unknown>;
}

function removeEvent(
  databaseEntity: Record<string, unknown> | undefined,
  target: unknown = Project,
): RemoveEvent<unknown> {
  return { databaseEntity, metadata: { target } } as unknown as RemoveEvent<unknown>;
}

const subscriber = new TenantSubscriber();

describe('TenantSubscriber.beforeInsert', () => {
  it('stamps the tenant column from the context', () => {
    const entity: Record<string, unknown> = { name: 'p1' };
    runWithTenant('tenant-a', () => subscriber.beforeInsert(insertEvent(entity)));
    expect(entity['tenantId']).toBe('tenant-a');
  });

  it('overwrites attacker-supplied tenant values', () => {
    const entity: Record<string, unknown> = { name: 'p1', tenantId: 'tenant-b' };
    runWithTenant('tenant-a', () => subscriber.beforeInsert(insertEvent(entity)));
    expect(entity['tenantId']).toBe('tenant-a');
  });

  it('throws without a tenant in context', () => {
    expect(() => subscriber.beforeInsert(insertEvent({ name: 'p1' }))).toThrow(MissingTenantError);
  });

  it('passes through when configured', () => {
    const lax = createTenantSubscriber({ onMissingTenant: 'passthrough' });
    const entity: Record<string, unknown> = { name: 'p1' };
    lax.beforeInsert(insertEvent(entity));
    expect(entity['tenantId']).toBeUndefined();
  });

  it('ignores global entities and nullish payloads', () => {
    const entity: Record<string, unknown> = { name: 'FR' };
    runWithTenant('tenant-a', () => {
      subscriber.beforeInsert(insertEvent(entity, Country));
      subscriber.beforeInsert(insertEvent(null));
      subscriber.beforeInsert(insertEvent(entity, 'string-target'));
    });
    expect(entity['tenantId']).toBeUndefined();
  });

  it('is inert in schema-per-tenant mode', () => {
    const schemaMode = new TenantSubscriber({ isolation: 'schema-per-tenant' });
    const entity: Record<string, unknown> = { name: 'p1' };
    runWithTenant('tenant-a', () => schemaMode.beforeInsert(insertEvent(entity)));
    expect(entity['tenantId']).toBeUndefined();
  });
});

describe('TenantSubscriber.beforeUpdate', () => {
  it('refuses updating a row owned by another tenant', () => {
    expect(() =>
      runWithTenant('tenant-a', () =>
        subscriber.beforeUpdate(updateEvent({ name: 'x' }, { tenantId: 'tenant-b' })),
      ),
    ).toThrow(CrossTenantOperationError);
  });

  it('refuses rebinding the tenant column', () => {
    expect(() =>
      runWithTenant('tenant-a', () =>
        subscriber.beforeUpdate(updateEvent({ tenantId: 'tenant-b' }, { tenantId: 'tenant-a' })),
      ),
    ).toThrow(CrossTenantOperationError);
  });

  it('stamps the updated entity with the context tenant', () => {
    const entity: Record<string, unknown> = { name: 'renamed' };
    runWithTenant('tenant-a', () =>
      subscriber.beforeUpdate(updateEvent(entity, { tenantId: 'tenant-a' })),
    );
    expect(entity['tenantId']).toBe('tenant-a');
  });

  it('tolerates missing entity snapshots (criteria updates)', () => {
    runWithTenant('tenant-a', () => subscriber.beforeUpdate(updateEvent(undefined, undefined)));
  });

  it('throws without a tenant, passes through when configured', () => {
    expect(() => subscriber.beforeUpdate(updateEvent({ name: 'x' }, undefined))).toThrow(
      MissingTenantError,
    );
    const lax = createTenantSubscriber({ onMissingTenant: 'passthrough' });
    lax.beforeUpdate(updateEvent({ name: 'x' }, { tenantId: 'tenant-b' }));
  });

  it('ignores updates on global entities', () => {
    const entity: Record<string, unknown> = { name: 'FR' };
    runWithTenant('tenant-a', () =>
      subscriber.beforeUpdate(updateEvent(entity, { tenantId: 'tenant-b' }, Country)),
    );
    expect(entity['tenantId']).toBeUndefined();
  });
});

describe('TenantSubscriber.beforeRemove', () => {
  it("refuses removing another tenant's row", () => {
    expect(() =>
      runWithTenant('tenant-a', () =>
        subscriber.beforeRemove(removeEvent({ tenantId: 'tenant-b' })),
      ),
    ).toThrow(CrossTenantOperationError);
  });

  it('allows removing own rows', () => {
    runWithTenant('tenant-a', () => subscriber.beforeRemove(removeEvent({ tenantId: 'tenant-a' })));
  });

  it('tolerates a missing database snapshot', () => {
    runWithTenant('tenant-a', () => subscriber.beforeRemove(removeEvent(undefined)));
  });

  it('throws without a tenant in context', () => {
    expect(() => subscriber.beforeRemove(removeEvent({ tenantId: 'tenant-a' }))).toThrow(
      MissingTenantError,
    );
  });

  it('ignores global entities', () => {
    runWithTenant('tenant-a', () =>
      subscriber.beforeRemove(removeEvent({ tenantId: 'tenant-b' }, Country)),
    );
  });

  it('passes through on missing tenant when configured', () => {
    const lax = createTenantSubscriber({ onMissingTenant: 'passthrough' });
    lax.beforeRemove(removeEvent({ tenantId: 'tenant-b' }));
  });
});
