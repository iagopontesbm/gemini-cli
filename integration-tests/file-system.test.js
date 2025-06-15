import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { strict as assert } from 'assert';
import { tmpdir } from 'os';
import { test } from 'node:test';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('reads a file', () => {
  const testDir = mkdtempSync(join(tmpdir(), 'gemini-cli-integration-tests-'));
  const testFile = join(testDir, 'test.txt');
  const bundlePath = join(__dirname, '..', 'bundle/gemini.js');

  try {
    writeFileSync(testFile, 'hello world');

    const output = execSync(`node ${bundlePath} --prompt "read the file name test.txt"`, {
      cwd: testDir,
      encoding: 'utf-8',
    });

    assert.ok(output.includes('hello world'));
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test('writes a file', () => {
    const testDir = mkdtempSync(join(tmpdir(), 'gemini-cli-integration-tests-'));
    const testFile = join(testDir, 'test.txt');
    const bundlePath = join(__dirname, '..', 'bundle/gemini.js');
  
    try {  
      const output = execSync(`node ${bundlePath} --prompt "edit test.txt to have a hello world message" -y`, {
        cwd: testDir,
        encoding: 'utf-8',
      });
  
      const fileContent = readFileSync(testFile, 'utf-8');
      assert.ok(fileContent.includes('hello world'));
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });