import { runWithTenant, TenancyError, UnsafeSqlValueError } from '@tenantry/core';
import { describe, expect, it } from 'vitest';

import { GlobalEntity, TenantAware } from './decorators';
import { isTenantAwareEntity, resolveOptions, tenantColumnFor } from './options';

@TenantAware()
class Project {}

@TenantAware({ column: 'orgId' })
class Invoice {}

@GlobalEntity()
class Country {}

@TenantAware()
@GlobalEntity()
class Contradiction {}

class Undecorated {}

describe('resolveOptions', () => {
  it('applies safe defaults', () => {
    const resolved = resolveOptions();
    expect(resolved.entities).toBe('decorated');
    expect(resolved.tenantColumn).toBe('tenantId');
    expect(resolved.isolation).toBe('hybrid');
    expect(resolved.sessionVariable).toBe('app.current_tenant');
    expect(resolved.onMissingTenant).toBe('throw');
    expect(resolved.sharedSchemas).toEqual(['public']);
  });

  it('defaults tenant resolution to the core AsyncLocalStorage context', () => {
    const resolved = resolveOptions();
    expect(resolved.getTenantId()).toBeUndefined();
    expect(runWithTenant('acme', () => resolved.getTenantId())).toBe('acme');
  });

  it('honors overrides', () => {
    const getTenantId = (): string => 'fixed';
    const resolved = resolveOptions({
      entities: [Project],
      tenantColumn: 'orgId',
      isolation: 'rls-only',
      sessionVariable: 'app.org',
      onMissingTenant: 'passthrough',
      getTenantId,
    });
    expect(resolved.entities).toEqual(new Set([Project]));
    expect(resolved.tenantColumn).toBe('orgId');
    expect(resolved.isolation).toBe('rls-only');
    expect(resolved.sessionVariable).toBe('app.org');
    expect(resolved.onMissingTenant).toBe('passthrough');
    expect(resolved.getTenantId).toBe(getTenantId);
  });

  it('rejects rls-only without a session variable', () => {
    expect(() => resolveOptions({ isolation: 'rls-only', sessionVariable: false })).toThrow(
      TenancyError,
    );
  });

  it('rejects an empty entity list', () => {
    expect(() => resolveOptions({ entities: [] })).toThrow(TenancyError);
  });

  describe('schema naming', () => {
    it('derives a safe schema from the tenant id by default', () => {
      const resolved = resolveOptions({ isolation: 'schema-per-tenant' });
      expect(resolved.schemaForTenant('Acme-42')).toBe('tenant_acme_42');
    });

    it('validates custom naming output', () => {
      const resolved = resolveOptions({
        isolation: 'schema-per-tenant',
        schema: { naming: (t) => `Bad Schema ${t}` },
      });
      expect(() => resolved.schemaForTenant('acme')).toThrow(UnsafeSqlValueError);
    });

    it('validates shared schemas at resolve time', () => {
      expect(() => resolveOptions({ schema: { sharedSchemas: ['public', 'not valid!'] } })).toThrow(
        UnsafeSqlValueError,
      );
    });
  });
});

describe('isTenantAwareEntity', () => {
  it("mode 'decorated' (default): only @TenantAware entities", () => {
    const options = resolveOptions();
    expect(isTenantAwareEntity(Project, options)).toBe(true);
    expect(isTenantAwareEntity(Undecorated, options)).toBe(false);
    expect(isTenantAwareEntity(Country, options)).toBe(false);
  });

  it("mode 'all': everything except @GlobalEntity", () => {
    const options = resolveOptions({ entities: 'all' });
    expect(isTenantAwareEntity(Project, options)).toBe(true);
    expect(isTenantAwareEntity(Undecorated, options)).toBe(true);
    expect(isTenantAwareEntity(Country, options)).toBe(false);
  });

  it('explicit list: exactly the listed classes', () => {
    const options = resolveOptions({ entities: [Project] });
    expect(isTenantAwareEntity(Project, options)).toBe(true);
    expect(isTenantAwareEntity(Invoice, options)).toBe(false);
  });

  it('@GlobalEntity always wins, even over @TenantAware', () => {
    for (const entities of ['decorated', 'all'] as const) {
      const options = resolveOptions({ entities });
      expect(isTenantAwareEntity(Contradiction, options)).toBe(false);
    }
    expect(isTenantAwareEntity(Contradiction, resolveOptions({ entities: [Contradiction] }))).toBe(
      false,
    );
  });
});

describe('tenantColumnFor', () => {
  it('uses the per-entity override, then the adapter-wide column', () => {
    const options = resolveOptions();
    expect(tenantColumnFor(Invoice, options)).toBe('orgId');
    expect(tenantColumnFor(Project, options)).toBe('tenantId');
    expect(tenantColumnFor(Undecorated, resolveOptions({ tenantColumn: 'org' }))).toBe('org');
  });
});
