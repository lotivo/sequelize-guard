import path, { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { defineConfig as vitestDefineConfig } from 'vitest/config';

const __dirname = process.cwd();

const vitestConfig = vitestDefineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/**/types/**',
      ],
    },
    pool: 'forks',
    isolate: true,
    fileParallelism: true,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});

export default defineConfig({
  plugins: [
    dts({
      include: ['./src/**/*'],
      exclude: ['./src/**/*.test.ts', './src/**/*.spec.ts'],
      outDir: 'dist',
      rollupTypes: true,
      copyDtsFiles: false,
      strictOutput: true,
    }),
  ],
  root: __dirname,
  cacheDir: path.resolve(
    __dirname,
    '../../node_modules/.vite/packages/sequelize-guard',
  ),
  build: {
    outDir: path.resolve(__dirname, '../../dist/packages/sequelize-guard'),
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, './src/index.ts'),
      name: 'SequelizeGuard',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'es.js' : 'js'}`,
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
