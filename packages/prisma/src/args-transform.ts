import { TenancyError } from '@tenantry/core';

type PlainObject = Record<string, unknown>;

/** Operations whose `where` accepts arbitrary filters — merged with `AND`. */
const WHERE_FILTER_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Operations whose `where` must be a unique selector. Since Prisma 5, extra
 * non-unique fields are accepted alongside the unique ones, so the tenant
 * field is merged in directly.
 */
const WHERE_UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

/** Operations creating rows — the tenant id is stamped into `data`. */
const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

export class UnsupportedOperationError extends TenancyError {
  constructor(operation: string) {
    super(
      `Tenantry does not know how to scope the Prisma operation "${operation}" ` +
        'to a tenant, and fails closed rather than letting it run unfiltered. ' +
        'Please open an issue: https://github.com/gettenantry/tenantry/issues',
    );
  }
}

function asObject(value: unknown): PlainObject {
  return (value ?? {}) as PlainObject;
}

function andWhere(existing: unknown, field: string, tenantId: string): PlainObject {
  const tenantFilter: PlainObject = { [field]: tenantId };
  if (existing === undefined) {
    return tenantFilter;
  }
  return { AND: [tenantFilter, existing] };
}

function mergeUniqueWhere(existing: unknown, field: string, tenantId: string): PlainObject {
  return { ...asObject(existing), [field]: tenantId };
}

function stampData(data: unknown, field: string, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...asObject(row), [field]: tenantId }));
  }
  return { ...asObject(data), [field]: tenantId };
}

/**
 * Returns `args` scoped to `tenantId` for the given operation: reads and
 * bulk writes get the tenant filter, creates get the tenant id stamped into
 * their data, `upsert` gets both.
 *
 * Unknown operations throw {@link UnsupportedOperationError}: for an
 * isolation library, running an operation unfiltered is strictly worse than
 * failing loudly.
 */
export function applyTenantToArgs(
  operation: string,
  args: unknown,
  field: string,
  tenantId: string,
): PlainObject {
  const current = asObject(args);

  if (WHERE_FILTER_OPERATIONS.has(operation)) {
    return { ...current, where: andWhere(current['where'], field, tenantId) };
  }
  if (WHERE_UNIQUE_OPERATIONS.has(operation)) {
    const scoped: PlainObject = {
      ...current,
      where: mergeUniqueWhere(current['where'], field, tenantId),
    };
    if (operation === 'update' && current['data'] !== undefined) {
      scoped['data'] = current['data'];
    }
    return scoped;
  }
  if (CREATE_OPERATIONS.has(operation)) {
    return { ...current, data: stampData(current['data'], field, tenantId) };
  }
  if (operation === 'upsert') {
    return {
      ...current,
      where: mergeUniqueWhere(current['where'], field, tenantId),
      create: stampData(current['create'], field, tenantId),
    };
  }

  throw new UnsupportedOperationError(operation);
}
