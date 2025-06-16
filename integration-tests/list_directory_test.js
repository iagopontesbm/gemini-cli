
import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';
import * as fs from 'fs';
import * as path from 'path';

test('should be able to list a directory', async () => {
  const testRun = new TestRun();
  try {
    fs.writeFileSync(path.join(testRun.testDirectory, 'file1.txt'), 'file 1 content');
    fs.mkdirSync(path.join(testRun.testDirectory, 'subdir'));
    const prompt = 'Can you list the files in the current directory';
    const result = await testRun.run(prompt);
    expect(result.stdout).toContain('file1.txt');
    expect(result.stdout).toContain('subdir');
  } finally {
    testRun.cleanUp();
  }
});
