import { defineConfig } from 'vite';
import { defineConfig as vitestDefineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import path, { resolve } from 'path';

const __dirname = process.cwd();

const vitestConfig = vitestDefineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/**/types/**',
      ],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
    pool: 'forks',
    maxConcurrency: 1,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      outDir: 'dist',
      rollupTypes: true,
      copyDtsFiles: false,
      strictOutput: true,
    }),
  ],
  build: {
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
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    outDir: './dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: vitestConfig.test,
});
