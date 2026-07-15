import { TenantAware } from '@tenantry/typeorm';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@TenantAware()
@Entity({ name: 'Project' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  tenantId!: string;

  @Column('text')
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
