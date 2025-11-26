import path from 'path';
import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig as vitestDefineConfig } from 'vitest/config';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const vitestConfig = vitestDefineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/types/**'],
    },
    pool: 'forks',
    isolate: true,
    fileParallelism: true,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});

const outputDirBase = path.resolve(
  __dirname,
  '../../build/packages/sequelize-guard',
);

const outputDirDts = path.resolve(outputDirBase, 'types');

export default defineConfig({
  plugins: [
    dtsPlugin({
      root: __dirname,
      outDir: outputDirDts,
      tsconfigPath: path.resolve(__dirname, 'tsconfig.lib.json'),
      pathsToAliases: true,
    }),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, '../../README.md'),
          dest: './',
        },
        {
          src: path.resolve(__dirname, '../../LICENSE'),
          dest: './',
        },
      ],
    }),
  ],
  root: __dirname,
  cacheDir: path.resolve(
    __dirname,
    '../../node_modules/.vite/packages/sequelize-guard',
  ),
  build: {
    // outDir: outputDirBase,
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    lib: {
      entry: './src/index.ts',
      name: 'SequelizeGuard',
      formats: ['es'], // 'cjs for CommonJS, 'es' for ES Modules
      fileName: (format) =>
        format === 'es' ? `dist/esm/index.esm.js` : `dist/cjs/index.cjs.js`,
    },

    rollupOptions: {
      external: ['sequelize', 'lodash', 'node-cache', 'events'],
      output: {
        preserveModules: false,
        exports: 'named',
        globals: {
          sequelize: 'Sequelize',
          lodash: '_',
          'node-cache': 'NodeCache',
          events: 'EventEmitter',
        },
      },
      maxParallelFileOps: 2,
      treeshake: {
        preset: 'smallest',
        moduleSideEffects: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: vitestConfig.test,
});
