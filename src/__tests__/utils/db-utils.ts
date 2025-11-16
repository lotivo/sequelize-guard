import * as path from 'path';
import * as fs from 'fs';

// Test database directory - in project root .sandbox/db
export const TEST_DB_DIR = path.resolve(__dirname, '../../../.sandbox/db');

// Set to false to keep database files after tests for debugging
export const CLEANUP_DB_AFTER_TESTS = true;

/**
 * Ensure test database directory exists
 */
export function ensureTestDbDir(): void {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
}

/**
 * Generate a unique database file path for a test suite
 * Cleans up any previous database files with the same prefix
 */
export function generateDbPath(prefix: string = 'test'): string {
  ensureTestDbDir();

  const uniqueDbName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.db`;
  return path.join(TEST_DB_DIR, uniqueDbName);
}

/**
 * Clean up a database file
 */
export function cleanupDbFile(dbPath: string): void {
  if (!CLEANUP_DB_AFTER_TESTS) {
    console.log(`Keeping test database for debugging: ${dbPath}`);
    return;
  }

  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn(`Failed to delete test database: ${dbPath}`);
    }
  }
}
