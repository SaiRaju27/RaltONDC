#!/usr/bin/env node

/**
 * sync-versions.js
 * Synchronizes the semantic release version across:
 * - root package.json
 * - apps/delivery-app (package.json and Expo app.json)
 * - packages/ (package.json)
 * - services/ (package.json)
 */

const fs = require('fs');
const path = require('path');

const targetVersion = process.argv[2];

if (!targetVersion) {
  console.error('Error: target version argument is required (e.g. node scripts/sync-versions.js 1.2.7)');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');

const manifestPaths = [
  'package.json',
  'apps/delivery-app/package.json',
  'apps/delivery-app/app.json',
  'packages/database/package.json',
  'services/ondc-lsp-service/package.json'
];

let updatedCount = 0;

for (const relPath of manifestPaths) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${relPath}`);
    continue;
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const json = JSON.parse(raw);

    if (relPath.endsWith('app.json')) {
      if (json.expo) {
        json.expo.version = targetVersion;
      }
    } else {
      json.version = targetVersion;
    }

    fs.writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    updatedCount++;
    console.log(`[SYNC] ${relPath} -> ${targetVersion}`);
  } catch (err) {
    console.error(`[ERROR] Failed to update ${relPath}:`, err.message);
    process.exit(1);
  }
}

console.log(`\nSuccessfully synchronized ${updatedCount} manifests to version ${targetVersion}`);

