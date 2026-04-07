#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = path.join(__dirname, '..', 'build-version.json');

function readVersion() {
  const raw = fs.readFileSync(VERSION_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeVersion(version) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(version, null, 2) + '\n');
  const vStr = `v${version.major}.${version.minor}.${version.patch} (Build ${version.build})`;
  console.log(`Version set to ${vStr}`);
}

const command = process.argv[2];

if (!command) {
  console.error('Usage: node scripts/set-version.js <command>');
  console.error('Commands:');
  console.error('  build   - Increment build number');
  console.error('  patch   - Increment patch version, reset build to 0');
  console.error('  minor   - Increment minor version, reset patch and build');
  console.error('  major   - Increment major version, reset minor, patch and build');
  console.error('  show    - Show current version');
  console.error('  set X.Y.Z - Set specific version');
  process.exit(1);
}

const v = readVersion();

switch (command) {
  case 'build':
    v.build++;
    writeVersion(v);
    break;

  case 'patch':
    v.patch++;
    v.build = 0;
    writeVersion(v);
    break;

  case 'minor':
    v.minor++;
    v.patch = 0;
    v.build = 0;
    writeVersion(v);
    break;

  case 'major':
    v.major++;
    v.minor = 0;
    v.patch = 0;
    v.build = 0;
    writeVersion(v);
    break;

  case 'show':
    console.log(`v${v.major}.${v.minor}.${v.patch} (Build ${v.build})`);
    break;

  case 'set': {
    const target = process.argv[3];
    if (!target || !/^\d+\.\d+\.\d+$/.test(target)) {
      console.error('Usage: node scripts/set-version.js set X.Y.Z');
      process.exit(1);
    }
    const [major, minor, patch] = target.split('.').map(Number);
    writeVersion({ major, minor, patch, build: 0 });
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
