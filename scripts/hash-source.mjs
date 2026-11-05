#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

function printUsage() {
  console.error('Usage: node scripts/hash-source.mjs <file-path>');
  console.error('Calculates SHA-256 and file size using Node.js built-in modules without network access.');
}

export async function hashFile(filePath) {
  return new Promise((res, rej) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', rej);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => res(hash.digest('hex')));
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0] === '-h' || args[0] === '--help') {
    printUsage();
    process.exit(1);
  }

  const targetPath = resolve(args[0]);

  if (!existsSync(targetPath)) {
    console.error(`Error: File not found: ${args[0]}`);
    process.exit(1);
  }

  let stats;
  try {
    stats = statSync(targetPath);
  } catch (err) {
    console.error(`Error: Could not stat file: ${err.message}`);
    process.exit(1);
  }

  if (!stats.isFile()) {
    console.error(`Error: Path is not a regular file: ${args[0]}`);
    process.exit(1);
  }

  try {
    const sha256 = await hashFile(targetPath);
    const fileName = basename(targetPath);
    const sizeBytes = stats.size;

    console.log(`File:     ${fileName}`);
    console.log(`Path:     ${targetPath}`);
    console.log(`Size:     ${sizeBytes} bytes`);
    console.log(`SHA-256:  ${sha256}`);
  } catch (err) {
    console.error(`Error hashing file: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main();
}
