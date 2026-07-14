import { describe, expect, it } from 'vitest';

import { TENANTRY_PRISMA_VERSION } from './index';

describe('@tenantry/prisma package stub', () => {
  it('exposes the pre-release version marker', () => {
    expect(TENANTRY_PRISMA_VERSION).toBe('0.0.0');
  });
});
