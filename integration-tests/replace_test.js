
import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';
import * as fs from 'fs';
import * as path from 'path';

test('should be able to replace content in a file', async () => {
  const testRun = new TestRun();
  try {
    const filePath = path.join(testRun.testDirectory, 'file_to_replace.txt');
    fs.writeFileSync(filePath, 'original content');
    const prompt = 'Can you replace "original" with "replaced" in the file "file_to_replace.txt"';
    await testRun.run(prompt);
    const newFileContent = fs.readFileSync(filePath, 'utf-8');
    expect(newFileContent).toBe('replaced content');
  } finally {
    testRun.cleanUp();
  }
});
