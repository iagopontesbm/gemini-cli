/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { Header } from './Header.js';
import { vi } from 'vitest';

// Mock ink-gradient to simplify testing
vi.mock('ink-gradient', () => ({
  default: vi.fn(({ children }) => children),
}));

describe('<Header />', () => {
  it('should render with the default title "GEMINI" when no title prop is provided', () => {
    const { lastFrame } = render(<Header />);
    const output = lastFrame();
    // Should contain either GEMINI text or ASCII art representation
    expect(output).toBeTruthy();
    expect(output?.length).toBeGreaterThan(0);
    // ASCII art contains box drawing characters
    expect(output || '').toMatch(/[█╗╚═╔╝]|GEMINI/);
  });

  it('should render with a custom title when the title prop is provided', () => {
    const customTitle = 'CUSTOM';
    const { lastFrame } = render(<Header title={customTitle} />);
    const output = lastFrame();
    // Should contain the custom title
    expect(output).toContain(customTitle);
  });

  it('should render ASCII art fallback when ink-big-text is not available', () => {
    // Mock require to throw error for ink-big-text
    const originalRequire = require;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).require = vi.fn((module: string) => {
      if (module === 'ink-big-text') {
        throw new Error('Module not found');
      }
      return originalRequire(module);
    });

    const { lastFrame } = render(<Header />);
    const output = lastFrame();
    
    // Should contain ASCII art characters
    expect(output).toMatch(/[█╗╚═╔╝]/);
    
    // Restore original require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).require = originalRequire;
  });
});