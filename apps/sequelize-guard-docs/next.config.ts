import path from 'path';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const workspaceRoot = path.resolve(import.meta.dirname, '../../');

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {
    // force the correct workspace root for Turbopack (silences multiple-lockfile warning)
    root: workspaceRoot,
  },
};

export default withMDX(config);
