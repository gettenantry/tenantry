import { DataSource } from 'typeorm';

/** Seeds two tenants with sample projects (admin connection, like example-prisma). */
async function seed(): Promise<void> {
  const admin = new DataSource({
    type: 'postgres',
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/tenantry_example',
  });
  await admin.initialize();
  try {
    await admin.query(
      `INSERT INTO "Project" ("tenantId", "name") VALUES
         ('acme', 'Rocket launch'),
         ('acme', 'Road runner trap'),
         ('globex', 'World domination')`,
    );
    console.log('Seeded projects for tenants "acme" and "globex".');
  } finally {
    await admin.destroy();
  }
}

void seed();
