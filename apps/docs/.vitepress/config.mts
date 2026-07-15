import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Tenantry',
  description:
    'Multi-tenancy toolkit for NestJS — tenant context, PostgreSQL Row-Level Security, and thin ORM adapters for Prisma and TypeORM.',
  // Served from https://gettenantry.github.io/tenantry/
  base: '/tenantry/',
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#0f766e' }]],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Reference', link: '/reference/core' },
      { text: 'FAQ', link: '/faq' },
      {
        text: 'Roadmap',
        link: 'https://github.com/gettenantry/tenantry/blob/main/ROADMAP.md',
      },
    ],
    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'Introduction', link: '/guide/introduction' },
          { text: 'Quickstart', link: '/guide/quickstart' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Tenant context', link: '/guide/concepts/tenant-context' },
          { text: 'Isolation & RLS', link: '/guide/concepts/isolation' },
          { text: 'Tenant extraction', link: '/guide/concepts/extraction' },
        ],
      },
      {
        text: 'Adapters',
        items: [
          { text: 'Prisma', link: '/guide/prisma' },
          { text: 'TypeORM', link: '/guide/typeorm' },
          { text: 'Adapter comparison', link: '/guide/adapters' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: '@tenantry/core', link: '/reference/core' },
          { text: '@tenantry/prisma', link: '/reference/prisma' },
          { text: '@tenantry/typeorm', link: '/reference/typeorm' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Example app', link: '/examples' },
          { text: 'vs. alternatives', link: '/comparison' },
          { text: 'FAQ', link: '/faq' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/gettenantry/tenantry' }],
    footer: {
      message: 'Released under the MIT License.',
    },
    search: { provider: 'local' },
    outline: 'deep',
  },
});
