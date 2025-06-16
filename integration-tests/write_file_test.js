
import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';
import * as fs from 'fs';
import * as path from 'path';

test('should be able to write a file', async () => {
  const testRun = new TestRun();
  try {
    const prompt = 'Can you write a file named "new_file.txt" with the content "new file content"';
    await testRun.run(prompt);
    const newFilePath = path.join(testRun.testDirectory, 'new_file.txt');
    expect(fs.existsSync(newFilePath)).toBe(true);
    const newFileContent = fs.readFileSync(newFilePath, 'utf-8');
    expect(newFileContent).toBe('new file content');
  } finally {
    testRun.cleanUp();
  }
});
