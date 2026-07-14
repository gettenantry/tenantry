import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Tenantry',
  description:
    'Multi-tenancy toolkit for NestJS — tenant context, PostgreSQL Row-Level Security, and ORM adapters for Prisma and TypeORM.',
  // Served from https://gettenantry.github.io/tenantry/
  base: '/tenantry/',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Roadmap', link: 'https://github.com/gettenantry/tenantry/blob/main/ROADMAP.md' },
    ],
    sidebar: [
      {
        text: 'Getting started',
        items: [{ text: 'Introduction', link: '/guide/introduction' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/gettenantry/tenantry' }],
    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
