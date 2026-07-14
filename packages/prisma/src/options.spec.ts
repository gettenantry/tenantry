import { runWithTenant, TenancyError } from '@tenantry/core';
import { describe, expect, it } from 'vitest';

import { resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies safe defaults', () => {
    const resolved = resolveOptions({ models: ['Project'] });
    expect(resolved.tenantField).toBe('tenantId');
    expect(resolved.isolation).toBe('hybrid');
    expect(resolved.sessionVariable).toBe('app.current_tenant');
    expect(resolved.onMissingTenant).toBe('throw');
    expect(resolved.models).toEqual(new Set(['Project']));
  });

  it('defaults tenant resolution to the core AsyncLocalStorage context', () => {
    const resolved = resolveOptions({ models: 'all' });
    expect(resolved.getTenantId()).toBeUndefined();
    expect(runWithTenant('acme', () => resolved.getTenantId())).toBe('acme');
  });

  it("keeps models: 'all' as-is", () => {
    expect(resolveOptions({ models: 'all' }).models).toBe('all');
  });

  it('honors every override', () => {
    const getTenantId = (): string => 'fixed';
    const resolved = resolveOptions({
      models: ['A', 'B'],
      tenantField: 'orgId',
      isolation: 'rls-only',
      sessionVariable: 'app.org',
      onMissingTenant: 'passthrough',
      getTenantId,
    });
    expect(resolved).toEqual({
      models: new Set(['A', 'B']),
      tenantField: 'orgId',
      isolation: 'rls-only',
      sessionVariable: 'app.org',
      onMissingTenant: 'passthrough',
      getTenantId,
    });
  });

  it('rejects rls-only without a session variable', () => {
    expect(() =>
      resolveOptions({ models: 'all', isolation: 'rls-only', sessionVariable: false }),
    ).toThrow(TenancyError);
  });

  it('rejects an empty model list', () => {
    expect(() => resolveOptions({ models: [] })).toThrow(TenancyError);
  });

  it('allows disabling the session variable in hybrid mode', () => {
    const resolved = resolveOptions({ models: 'all', sessionVariable: false });
    expect(resolved.sessionVariable).toBe(false);
  });
});
