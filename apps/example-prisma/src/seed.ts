import { PrismaClient } from '@prisma/client';

/**
 * Seeds two tenants with sample projects. Runs as the admin connection
 * (DATABASE_URL) — superusers bypass RLS, which is fine for seeding.
 */
async function seed(): Promise<void> {
  const prisma = new PrismaClient({
    datasourceUrl:
      process.env['DATABASE_URL'] ??
      'postgresql://postgres:postgres@localhost:5432/tenantry_example',
  });
  try {
    await prisma.project.createMany({
      data: [
        { tenantId: 'acme', name: 'Rocket launch' },
        { tenantId: 'acme', name: 'Road runner trap' },
        { tenantId: 'globex', name: 'World domination' },
      ],
      skipDuplicates: true,
    });
    console.log('Seeded projects for tenants "acme" and "globex".');
    console.log('curl -H "x-tenant-id: acme"   http://localhost:3000/projects');
    console.log('curl -H "x-tenant-id: globex" http://localhost:3000/projects');
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
