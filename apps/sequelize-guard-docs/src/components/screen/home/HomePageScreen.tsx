import Link from 'next/link';

export const HomePageScreen = () => (
  <main className="mx-auto max-w-4xl px-6 py-24 space-y-10">
    <p>Sequelize Guard · 6.1.0 candidate</p>
    <h1 className="text-5xl font-bold">Role-based authorization for Sequelize 6</h1>
    <p className="text-xl">Allow-only grants, single-parent inheritance and registered application role holders. Current writer-backed checks with native ESM, CommonJS and TypeScript support.</p>
    <nav className="flex flex-wrap gap-6">
      <Link href="/docs/guide/getting-started">Get started</Link>
      <Link href="/docs/examples">Executable recipes</Link>
      <Link href="/docs/migration/upgrade-to-v6">Upgrade safely</Link>
      <Link href="/docs/guide/authorization">Security contract</Link>
      <Link href="/docs/api">API reference</Link>
    </nav>
    <p>Start by choosing automatic initialization for a new database, or explicit deployment migrations for an existing application. Always await initialization before protected work.</p>
    <p>Your application verifies identity and protects policy administration. Guard reads the writer for authorization; manual caches do not decide access. Events support observation; applications own durable audits and expiry enforcement.</p>
    <p>Node 22 (minimum 22.17.1) and 24 · Sequelize ^6.37.8 · SQLite, PostgreSQL 17 and MySQL 8.4.</p>
    <p>The 6.1.0 candidate includes deliberate policy and schema changes. Follow the offline upgrade guide before moving from published 6.0.2.</p>
    <a href="https://github.com/lotivo/sequelize-guard">Source and release status</a>
  </main>
);
