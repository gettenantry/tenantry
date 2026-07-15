import { MissingTenantError, RlsSessionService, TenancyError } from '@tenantry/core';
import {
  In,
  Repository,
  type DataSource,
  type DeepPartial,
  type DeleteResult,
  type EntityManager,
  type EntityTarget,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type ObjectLiteral,
  type RemoveOptions,
  type SaveOptions,
  type UpdateResult,
} from 'typeorm';

import {
  isTenantAwareEntity,
  resolveOptions,
  tenantColumnFor,
  type ResolvedTenantryTypeOrmOptions,
  type TenantryTypeOrmOptions,
} from './options';

type Where<E extends ObjectLiteral> = FindOptionsWhere<E> | FindOptionsWhere<E>[];
type Criteria<E extends ObjectLiteral> =
  string | number | Date | string[] | number[] | Date[] | Where<E>;

/**
 * A `Repository<Entity>` that enforces the tenant boundary on every
 * operation it knows about:
 *
 * - **hybrid** (default): the tenant filter is merged into every `where`
 *   AND each operation runs in a transaction with the RLS session variable
 *   bound (`SELECT set_config('app.current_tenant', tenant, true)`);
 * - **rls-only**: no application filter; only the session binding — the
 *   PostgreSQL policy decides;
 * - **schema-per-tenant**: each operation runs with `search_path` bound to
 *   the tenant's schema (via `set_config('search_path', …, true)`).
 *
 * Writes that carry entities (`save`, `insert` via cascades) are stamped and
 * checked by `TenantSubscriber`; criteria writes (`update`, `delete`) are
 * scoped here. `createQueryBuilder` and `query` cannot be filtered at the
 * application level — in hybrid/rls-only modes the RLS policy still covers
 * them, which is the whole point of defense in depth.
 */
export class TenantBaseRepository<Entity extends ObjectLiteral> extends Repository<Entity> {
  private readonly options: ResolvedTenantryTypeOrmOptions;
  private readonly rls: RlsSessionService | undefined;

  constructor(
    target: EntityTarget<Entity>,
    manager: EntityManager,
    options: TenantryTypeOrmOptions = {},
  ) {
    super(target, manager);
    this.options = resolveOptions(options);
    this.rls =
      this.options.isolation !== 'schema-per-tenant' && this.options.sessionVariable !== false
        ? new RlsSessionService({ variable: this.options.sessionVariable })
        : undefined;
  }

  override find(options?: FindManyOptions<Entity>): Promise<Entity[]> {
    return this.execute(
      (em, scope) => em.find(this.target, scope.findMany(options)),
      () => super.find(options),
    );
  }

  override findBy(where: Where<Entity>): Promise<Entity[]> {
    return this.execute(
      (em, scope) => em.findBy(this.target, scope.where(where)),
      () => super.findBy(where),
    );
  }

  override findAndCount(options?: FindManyOptions<Entity>): Promise<[Entity[], number]> {
    return this.execute(
      (em, scope) => em.findAndCount(this.target, scope.findMany(options)),
      () => super.findAndCount(options),
    );
  }

  override findAndCountBy(where: Where<Entity>): Promise<[Entity[], number]> {
    return this.execute(
      (em, scope) => em.findAndCountBy(this.target, scope.where(where)),
      () => super.findAndCountBy(where),
    );
  }

  override findOne(options: FindOneOptions<Entity>): Promise<Entity | null> {
    return this.execute(
      (em, scope) => em.findOne(this.target, scope.findOne(options)),
      () => super.findOne(options),
    );
  }

  override findOneBy(where: Where<Entity>): Promise<Entity | null> {
    return this.execute(
      (em, scope) => em.findOneBy(this.target, scope.where(where)),
      () => super.findOneBy(where),
    );
  }

  override findOneOrFail(options: FindOneOptions<Entity>): Promise<Entity> {
    return this.execute(
      (em, scope) => em.findOneOrFail(this.target, scope.findOne(options)),
      () => super.findOneOrFail(options),
    );
  }

  override findOneByOrFail(where: Where<Entity>): Promise<Entity> {
    return this.execute(
      (em, scope) => em.findOneByOrFail(this.target, scope.where(where)),
      () => super.findOneByOrFail(where),
    );
  }

  override count(options?: FindManyOptions<Entity>): Promise<number> {
    return this.execute(
      (em, scope) => em.count(this.target, scope.findMany(options)),
      () => super.count(options),
    );
  }

  override countBy(where: Where<Entity>): Promise<number> {
    return this.execute(
      (em, scope) => em.countBy(this.target, scope.where(where)),
      () => super.countBy(where),
    );
  }

  override exists(options?: FindManyOptions<Entity>): Promise<boolean> {
    return this.execute(
      (em, scope) => em.exists(this.target, scope.findMany(options)),
      () => super.exists(options),
    );
  }

  override existsBy(where: Where<Entity>): Promise<boolean> {
    return this.execute(
      (em, scope) => em.existsBy(this.target, scope.where(where)),
      () => super.existsBy(where),
    );
  }

  override update(
    criteria: Criteria<Entity>,
    partialEntity: Parameters<Repository<Entity>['update']>[1],
  ): Promise<UpdateResult> {
    return this.execute(
      (em, scope) => em.update(this.target, scope.criteria(criteria), partialEntity),
      () => super.update(criteria as never, partialEntity),
    );
  }

  override delete(criteria: Criteria<Entity>): Promise<DeleteResult> {
    return this.execute(
      (em, scope) => em.delete(this.target, scope.criteria(criteria)),
      () => super.delete(criteria as never),
    );
  }

  override save<T extends DeepPartial<Entity>>(
    entities: T[],
    options: SaveOptions & { reload: false },
  ): Promise<T[]>;
  override save<T extends DeepPartial<Entity>>(
    entities: T[],
    options?: SaveOptions,
  ): Promise<(T & Entity)[]>;
  override save<T extends DeepPartial<Entity>>(
    entity: T,
    options: SaveOptions & { reload: false },
  ): Promise<T>;
  override save<T extends DeepPartial<Entity>>(
    entity: T,
    options?: SaveOptions,
  ): Promise<T & Entity>;
  override save<T extends DeepPartial<Entity>>(
    entityOrEntities: T | T[],
    saveOptions?: SaveOptions,
  ): Promise<T | T[] | (T & Entity) | (T & Entity)[]> {
    type SaveFn = (target: EntityTarget<Entity>, e: T | T[], o?: SaveOptions) => Promise<T | T[]>;
    return this.execute(
      (em) => (em.save.bind(em) as SaveFn)(this.target, entityOrEntities, saveOptions),
      () =>
        (super.save.bind(this) as (e: T | T[], o?: SaveOptions) => Promise<T | T[]>)(
          entityOrEntities,
          saveOptions,
        ),
    );
  }

  override remove(entities: Entity[], options?: RemoveOptions): Promise<Entity[]>;
  override remove(entity: Entity, options?: RemoveOptions): Promise<Entity>;
  override remove(
    entityOrEntities: Entity | Entity[],
    removeOptions?: RemoveOptions,
  ): Promise<Entity | Entity[]> {
    type RemoveFn = (e: Entity | Entity[], o?: RemoveOptions) => Promise<Entity | Entity[]>;
    return this.execute(
      (em) => (em.remove.bind(em) as RemoveFn)(entityOrEntities, removeOptions),
      () => (super.remove.bind(this) as RemoveFn)(entityOrEntities, removeOptions),
    );
  }

  // ---------------------------------------------------------------- internals

  /**
   * Runs `bound` inside a transaction carrying the tenant binding, or
   * `plain` when no binding applies (global entity, passthrough, or hybrid
   * with sessionVariable disabled — filtering still applies in that case).
   */
  private async execute<T>(
    bound: (em: EntityManager, scope: Scoper<Entity>) => Promise<T>,
    plain: () => Promise<T>,
  ): Promise<T> {
    if (!this.isTenantAware()) {
      return plain();
    }

    const tenantId = this.options.getTenantId();
    if (tenantId === undefined) {
      if (this.options.onMissingTenant === 'passthrough') {
        return plain();
      }
      throw new MissingTenantError(
        `Operation on tenant-aware entity "${this.entityName()}" was attempted ` +
          'without a tenant in context. Wrap the unit of work in TenantContextService.run().',
      );
    }

    const scope = new Scoper<Entity>(
      this.options.isolation === 'hybrid' ? this.tenantColumn() : undefined,
      tenantId,
      () => this.primaryColumnName(),
    );

    const binding = this.bindingStatement(tenantId);
    if (binding === undefined) {
      // hybrid with sessionVariable: false — filter only, no transaction.
      return bound(this.manager, scope);
    }

    return this.manager.transaction(async (em) => {
      await em.query(binding.sql, [...binding.parameters]);
      return bound(em, scope);
    });
  }

  private bindingStatement(
    tenantId: string,
  ): { sql: string; parameters: readonly string[] } | undefined {
    if (this.options.isolation === 'schema-per-tenant') {
      const schema = this.options.schemaForTenant(tenantId);
      const searchPath = [schema, ...this.options.sharedSchemas].join(',');
      // search_path is a built-in GUC (no dot), so it is bound here rather
      // than through RlsSessionService — same parameterized set_config shape.
      return { sql: 'SELECT set_config($1, $2, true)', parameters: ['search_path', searchPath] };
    }
    return this.rls?.buildSetTenantStatement(tenantId);
  }

  private isTenantAware(): boolean {
    if (this.options.isolation === 'schema-per-tenant') {
      // Schema isolation applies to every entity in the tenant schema.
      return typeof this.target !== 'function' || isTenantAwareEntity(this.target, this.options);
    }
    if (typeof this.target !== 'function') {
      // String targets cannot carry decorators; fail closed and scope them.
      return true;
    }
    return isTenantAwareEntity(this.target, this.options);
  }

  private tenantColumn(): string {
    return typeof this.target === 'function'
      ? tenantColumnFor(this.target, this.options)
      : this.options.tenantColumn;
  }

  private entityName(): string {
    if (typeof this.target === 'function') {
      return this.target.name;
    }
    return typeof this.target === 'string' ? this.target : 'unknown entity';
  }

  private primaryColumnName(): string {
    const primaryColumns = this.metadata.primaryColumns;
    const first = primaryColumns[0];
    if (first === undefined || primaryColumns.length > 1) {
      throw new TenancyError(
        `Cannot scope id-based criteria for "${this.entityName()}": exactly one ` +
          'primary column is required. Pass an explicit where object instead.',
      );
    }
    return first.propertyName;
  }
}

/** Merges the tenant filter into where clauses, options and criteria. */
class Scoper<Entity extends ObjectLiteral> {
  constructor(
    private readonly column: string | undefined,
    private readonly tenantId: string,
    private readonly primaryColumn: () => string,
  ) {}

  where(where: Where<Entity>): Where<Entity> {
    if (this.column === undefined) {
      return where;
    }
    const merge = (clause: FindOptionsWhere<Entity>): FindOptionsWhere<Entity> => ({
      ...clause,
      [this.column!]: this.tenantId,
    });
    return Array.isArray(where) ? where.map(merge) : merge(where);
  }

  private optionalWhere(where: Where<Entity> | undefined): Where<Entity> {
    if (where === undefined) {
      return this.where({});
    }
    return this.where(where);
  }

  findMany(options: FindManyOptions<Entity> | undefined): FindManyOptions<Entity> {
    if (this.column === undefined) {
      return options ?? {};
    }
    return { ...(options ?? {}), where: this.optionalWhere(options?.where) };
  }

  findOne(options: FindOneOptions<Entity>): FindOneOptions<Entity> {
    if (this.column === undefined) {
      return options;
    }
    return { ...options, where: this.optionalWhere(options.where) };
  }

  criteria(criteria: Criteria<Entity>): Where<Entity> {
    if (this.column === undefined) {
      return criteria as Where<Entity>;
    }
    if (Array.isArray(criteria)) {
      if (criteria.every((item) => typeof item === 'object' && !(item instanceof Date))) {
        return this.where(criteria as FindOptionsWhere<Entity>[]);
      }
      return this.where({
        [this.primaryColumn()]: In(criteria as unknown[]),
      } as FindOptionsWhere<Entity>);
    }
    if (typeof criteria === 'object' && !(criteria instanceof Date)) {
      return this.where(criteria);
    }
    return this.where({ [this.primaryColumn()]: criteria } as FindOptionsWhere<Entity>);
  }
}

/**
 * Builds a tenant-scoped repository for an entity.
 *
 * ```ts
 * const projects = createTenantRepository(dataSource, Project, { isolation: 'hybrid' });
 * await runWithTenant('acme', async () => projects.find());
 * ```
 */
export function createTenantRepository<Entity extends ObjectLiteral>(
  source: DataSource | EntityManager,
  entity: EntityTarget<Entity>,
  options: TenantryTypeOrmOptions = {},
): TenantBaseRepository<Entity> {
  const manager: EntityManager =
    'manager' in source && source.manager !== undefined
      ? source.manager
      : (source as EntityManager);
  return new TenantBaseRepository(entity, manager, options);
}
