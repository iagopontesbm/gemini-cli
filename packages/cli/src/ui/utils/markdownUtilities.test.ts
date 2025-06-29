/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { findLastSafeSplitPoint } from './markdownUtilities.js';

describe('markdownUtilities', () => {
  describe('findLastSafeSplitPoint', () => {
    it('should split at the last double newline if not in a code block', () => {
      const content = 'paragraph1\n\nparagraph2\n\nparagraph3';
      expect(findLastSafeSplitPoint(content)).toBe(24); // After the second \n\n
    });

    it('should return content.length if no safe split point is found', () => {
      const content = 'longstringwithoutanysafesplitpoint';
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });

    it('should prioritize splitting at \n\n over being at the very end of the string if the end is not in a code block', () => {
      const content = 'Some text here.\n\nAnd more text here.';
      expect(findLastSafeSplitPoint(content)).toBe(17); // after the \n\n
    });

    it('should return content.length if the only \n\n is inside a code block and the end of content is not', () => {
      const content = '```\nignore this\n\nnewline\n```KeepThis';
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });

    it('should correctly identify the last \n\n even if it is followed by text not in a code block', () => {
      const content =
        'First part.\n\nSecond part.\n\nThird part, then some more text.';
      // Split should be after "Second part.\n\n"
      // "First part.\n\n" is 13 chars. "Second part.\n\n" is 14 chars. Total 27.
      expect(findLastSafeSplitPoint(content)).toBe(27);
    });

    it('should return content.length if content is empty', () => {
      const content = '';
      expect(findLastSafeSplitPoint(content)).toBe(0);
    });

    it('should return content.length if content has no newlines and no code blocks', () => {
      const content = 'Single line of text';
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });
  });
  describe('findLastSafeSplitPoint with dynamic fences', () => {
    // This is the test you provided, which now passes with the corrected logic.
    it('should return content.length if the only \\n\\n is inside a code block', () => {
      const content = '```\nignore this\n\nnewline\n```KeepThis';
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });

    // Test 1: Tilde Fences
    // Verifies the same logic as the test above, but using tildes instead of backticks.
    it('should return content.length if the only \\n\\n is inside a tilde (~~~) code block', () => {
      const content = '~~~\nignore this\n\nnewline\n~~~KeepThis';
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });

    // Test 2: Nested Code Blocks
    // The content has a large 'markdown' code block which itself contains a 'javascript' block.
    // The function must ignore the \n\n inside the outer block and find the safe one outside.
    it('should find the LAST safe split point when multiple are available after a nested code block', () => {
      const outerBlock =
        '````markdown\n' +
        'Here is an example of a JS block:\n\n' +
        '```javascript\n' +
        'console.log("Hello, World!");\n' +
        '```\n' +
        '````';
      const firstParagraph = '\n\nThis is the real paragraph break.';
      const secondParagraph = '\n\nKeep this last part.';
      const content = outerBlock + firstParagraph + secondParagraph;

      // The function searches backwards, so it should find the LAST safe `\n\n`,
      // which is the one between the two paragraphs. The split point is defined
      // as the index AFTER this newline sequence.
      const expectedSplitPoint = (outerBlock + firstParagraph).length + 2;

      // Let's verify our calculation:
      // outerBlock.length = 101
      // firstParagraph.length = 34
      // 101 + 34 + 2 = 137
      expect(expectedSplitPoint).toBe(137);

      // Now, run the actual test.
      expect(findLastSafeSplitPoint(content)).toBe(expectedSplitPoint);
    });

    // Test 3: Mixed and Complex Nesting
    // This uses a tilde block containing a backtick block. The function must navigate this
    // and find the last valid paragraph break.
    it('should find the last safe split point in a complex mix of tilde and backtick blocks', () => {
      const initialText = 'Some text first.\n\n';
      const tildeBlock =
        '~~~markdown\n' +
        'This tilde block contains an example of a backtick block.\n' +
        '```\nThis is inside the backtick block example.\n```\n' +
        '~~~';
      const firstSafeBreak = '\n\nThis is the safe place to split.';
      const secondSafeBreak = '\n\nAnd this is the final part.';

      const content =
        initialText + tildeBlock + firstSafeBreak + secondSafeBreak;

      // The loop searches backwards, so it should find the split point AFTER the text in `firstSafeBreak`.
      const expectedSplitPoint =
        (initialText + tildeBlock + firstSafeBreak).length + 2;

      expect(findLastSafeSplitPoint(content)).toBe(expectedSplitPoint);
    });

    // Test 4: Unclosed Block at the End
    // If the content ends with an unclosed block, the only safe place to split is right before it starts.
    it('should split before an unclosed code block at the end of the content', () => {
      const safePart = 'Some initial text.\n\n';
      const unclosedBlock =
        '~~~markdown\nThis block is not closed and goes to the end.';
      const content = safePart + unclosedBlock;

      // The end of the content is inside a code block. The function should identify
      // the start of that block as the split point.
      const expectedSplitPoint = safePart.length;

      expect(findLastSafeSplitPoint(content)).toBe(expectedSplitPoint);
    });
  });
  describe('findLastSafeSplitPoint loop boundary conditions', () => {

    /**
     * Test 1: Content starts with a SAFE double newline.
     * This test ensures that when the very last `\n\n` to be found is at index 0,
     * the function correctly identifies it as a valid split point and returns 2.
     * Both `> 0` and `>= 0` versions handle this case correctly.
     */
    it('should correctly split after a double newline at the very start of the content', () => {
      const content = '\n\nThis content starts with a paragraph break.';
      const expectedSplitPoint = 2; // Split right after the initial \n\n

      expect(findLastSafeSplitPoint(content)).toBe(expectedSplitPoint);
    });

    /**
     * Test 2: Content starts with an UNSAFE double newline (inside a code block).
     * This forces the loop to find the `\n\n` at the beginning, discard it as unsafe,
     * and then correctly terminate without finding any other safe splits. The final
     * result should be the full content length. This tests the loop's termination logic.
     */
    it('should not split when the only double newline is at the start and inside a code block', () => {
      const content = '```\n\nThis is an unsafe paragraph break.```';

      // The loop will find the `\n\n` at index 3, see it's inside a block, and continue.
      // The next `searchStartIndex` will be `3 - 1 = 2`. The loop condition `2 > 0` passes.
      // The next `lastIndexOf` call returns -1, the loop breaks, and content.length is returned.
      // This demonstrates the logic correctly progresses and terminates.
      expect(findLastSafeSplitPoint(content)).toBe(content.length);
    });
  })
});
