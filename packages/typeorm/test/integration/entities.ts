import { Column, Entity, PrimaryColumn } from 'typeorm';

import { TenantAware } from '../../src';

@TenantAware()
@Entity({ name: 'Project' })
export class Project {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  tenantId!: string;

  @Column('text')
  name!: string;
}

/** Same shape, no tenant column — used by the schema-per-tenant suite. */
@TenantAware()
@Entity({ name: 'Note' })
export class Note {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  body!: string;
}
