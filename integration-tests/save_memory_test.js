
import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';

test('should be able to save to memory', async () => {
  const testRun = new TestRun();
  try {
    const prompt = 'remember that my favorite color is blue';
    await testRun.run(prompt);
    const result = await testRun.run('what is my favorite color?');
    expect(result.stdout).toContain('blue');
  } finally {
    testRun.cleanUp();
  }
});
