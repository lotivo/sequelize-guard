#!/usr/bin/env node

/**
 * Generate API documentation from TypeScript source code
 * This script uses TypeDoc to generate markdown documentation
 * and formats it for the Fumadocs documentation site
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Generating API documentation...\n');

try {
  // Step 1: Generate TypeDoc markdown directly to docs folder
  console.log('📝 Step 1: Running TypeDoc...');
  execSync(
    'npx typedoc --out ./apps/sequelize-guard-docs/content/docs/api --entryPoints ./packages/sequelize-guard/src/index.ts --tsconfig ./packages/sequelize-guard/tsconfig.lib.json',
    {
      cwd: rootDir,
      stdio: 'inherit',
    }
  );

  const apiDir = join(rootDir, 'apps/sequelize-guard-docs/content/docs/api');

  // Step 2: Process all markdown files
  console.log('📝 Step 2: Processing markdown files...');
  processMarkdownFiles(apiDir);

  console.log('\n✅ API documentation generated successfully!');
  console.log(`📄 Output: ${apiDir}\n`);
} catch (error) {
  console.error('❌ Error generating API documentation:', error.message);
  process.exit(1);
}

/**
 * Process all markdown files in the directory
 */
function processMarkdownFiles(dir) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively process subdirectories
      processMarkdownFiles(filePath);
    } else if (extname(file) === '.md') {
      // Process markdown files
      processMarkdownFile(filePath);
    }
  }
}

/**
 * Process a single markdown file
 */
function processMarkdownFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const fileName = basename(filePath, '.md');
  
  // Fix internal links: .md -> .mdx
  content = content.replace(/\]\(([^)]+)\.md\)/g, ']($1.mdx)');
  
  // Fix README.mdx references to index.mdx
  content = content.replace(/README\.mdx/g, 'index.mdx');
  
  // For index/README files, make links relative with ./
  if (fileName === 'README') {
    // Fix links to subdirectories (classes/, interfaces/, type-aliases/)
    content = content.replace(/\]\(([a-z-]+\/[^)]+\.mdx)\)/g, '](./$1)');
  }
  
  // Rename README.md to index.mdx, others to .mdx
  const newPath = filePath.replace(/\.md$/, '.mdx');
  const finalPath = fileName === 'README' 
    ? join(dirname(filePath), 'index.mdx')
    : newPath;

  // Generate appropriate frontmatter based on file name
  const frontmatter = generateFrontmatter(fileName, content);
  
  // Write the file with frontmatter
  writeFileSync(finalPath, frontmatter + content, 'utf-8');
  
  // Remove original .md file if renamed
  if (finalPath !== filePath) {
    execSync(`rm -f "${filePath}"`);
  }
}

/**
 * Generate frontmatter based on file name and content
 */
function generateFrontmatter(fileName, content) {
  // Extract title from content (first heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  let title = titleMatch ? titleMatch[1] : fileName;
  
  // Clean up title
  title = title.replace(/^sequelize-guard\s+v[\d.]+\s*-?\s*/i, '');
  title = title.trim() || 'API Reference';

  // Remove or fix problematic characters for YAML
  // Remove backslashes used for escaping in markdown
  title = title.replace(/\\</g, '<').replace(/\\>/g, '>');
  // Escape quotes
  title = title.replace(/"/g, '\\"');

  // Special handling for index/README
  if (fileName === 'README') {
    return `---
title: API Reference
description: Complete API reference for sequelize-guard
icon: ShieldCheck
---

`;
  }

  // For other files, generate appropriate frontmatter
  return `---
title: "${title}"
---

`;
}
