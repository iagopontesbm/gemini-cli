/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Mock fs
vi.mock('node:fs');

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserToolsLoader, loadMergedUserTools } from './userToolsLoader.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('UserToolsLoader', () => {
  let tempDir: string;
  let loader: UserToolsLoader;

  beforeEach(() => {
    vi.resetAllMocks();
    tempDir = os.tmpdir();
    loader = new UserToolsLoader(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadUserTools', () => {
    it('should return empty map when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(0);
    });

    it('should load valid user tool from markdown file', () => {
      const toolContent = `---
description: Test tool description
---

This is the tool template content.`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'test-tool.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(1);
      expect(tools.has('test-tool')).toBe(true);

      const tool = tools.get('test-tool');
      expect(tool).toEqual({
        name: 'test-tool',
        description: 'Test tool description',
        content: 'This is the tool template content.',
        filePath: path.join(tempDir, '.gemini', 'user-tools', 'test-tool.md'),
        autoSubmit: false,
      });
    });

    it('should load multiple tools', () => {
      const tool1Content = `---
description: Tool 1
---
Tool 1 content`;

      const tool2Content = `---
description: Tool 2
---
Tool 2 content`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'tool1.md',
        'tool2.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(tool1Content)
        .mockReturnValueOnce(tool2Content);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(2);
      expect(tools.has('tool1')).toBe(true);
      expect(tools.has('tool2')).toBe(true);
    });

    it('should ignore non-markdown files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'tool.md',
        'readme.txt',
        'config.json',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(`---
description: Valid tool
---
Content`);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(1);
      expect(tools.has('tool')).toBe(true);
    });

    it('should handle empty frontmatter gracefully', () => {
      const toolContent = `---
---
Just content without metadata`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'empty-meta.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(1);
      const tool = tools.get('empty-meta');
      expect(tool).toEqual({
        name: 'empty-meta',
        description: 'User-defined tool: empty-meta',
        content: 'Just content without metadata',
        filePath: path.join(tempDir, '.gemini', 'user-tools', 'empty-meta.md'),
        autoSubmit: false,
      });
    });

    it('should handle missing frontmatter', () => {
      const toolContent = `This is just plain content
without any frontmatter`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'no-frontmatter.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(1);
      const tool = tools.get('no-frontmatter');
      expect(tool).toEqual({
        name: 'no-frontmatter',
        description: 'User-defined tool: no-frontmatter',
        content: toolContent,
        filePath: path.join(
          tempDir,
          '.gemini',
          'user-tools',
          'no-frontmatter.md',
        ),
        autoSubmit: false,
      });
    });

    it('should handle file read errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'error-tool.md',
        'valid-tool.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
        throw new Error('Read error');
      }).mockReturnValueOnce(`---
description: Valid tool
---
Content`);

      const tools = loader.loadUserTools();

      expect(tools.size).toBe(1);
      expect(tools.has('valid-tool')).toBe(true);
      expect(tools.has('error-tool')).toBe(false);
    });

    it('should trim whitespace from content', () => {
      const toolContent = `---
description: Test tool
---

  
Content with whitespace  

  `;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'whitespace.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      const tool = tools.get('whitespace');
      expect(tool?.content).toBe('Content with whitespace');
    });

    it('should parse autoSubmit flag when true', () => {
      const toolContent = `---
description: No args tool
autoSubmit: true
---
Tool content`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'no-args.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      const tool = tools.get('no-args');
      expect(tool?.autoSubmit).toBe(true);
    });

    it('should default autoSubmit to false when not specified', () => {
      const toolContent = `---
description: Regular tool
---
Tool content`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'regular.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      const tool = tools.get('regular');
      expect(tool?.autoSubmit).toBe(false);
    });

    it('should handle frontmatter with extra whitespace', () => {
      const toolContent = `  ---  
description: Tool with spaces
autoSubmit: true
  ---  
Tool content`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'whitespace-frontmatter.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      const tool = tools.get('whitespace-frontmatter');
      expect(tool?.description).toBe('Tool with spaces');
      expect(tool?.autoSubmit).toBe(true);
    });

    it('should skip malformed frontmatter lines', () => {
      const toolContent = `---
description: Valid description
this line has no colon
malformed line without colon
autoSubmit: false
---
Tool content`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'malformed.md',
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockReturnValue(toolContent);

      const tools = loader.loadUserTools();

      const tool = tools.get('malformed');
      expect(tool?.description).toBe('Valid description');
      expect(tool?.autoSubmit).toBe(false);
    });
  });
});

describe('loadMergedUserTools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set NODE_ENV to test to suppress console logs during tests
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load and merge tools from both global and workspace directories', () => {
    const homeDir = os.homedir();

    const globalToolContent = `---
description: Global tool
---
Global tool content`;

    const workspaceToolContent = `---
description: Workspace tool
---
Workspace tool content`;

    const overrideToolContent = `---
description: Override tool from workspace
---
Override content`;

    // Mock mkdirSync to prevent directory creation attempts
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    // Setup mocks for file system operations
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = path.toString();
      // Return true for both global and workspace user-tools directories
      return pathStr.includes('/.gemini/user-tools');
    });

    vi.mocked(fs.readdirSync).mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes(`${homeDir}/.gemini/user-tools`)) {
        // Return file names as strings cast to Dirent array
        return ['global-tool.md', 'shared-tool.md'] as unknown as fs.Dirent[];
      } else if (pathStr.includes('/workspace/.gemini/user-tools')) {
        // Return file names as strings cast to Dirent array
        return [
          'workspace-tool.md',
          'shared-tool.md',
        ] as unknown as fs.Dirent[];
      }
      return [] as unknown as fs.Dirent[];
    });

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('global-tool.md')) {
        return globalToolContent;
      } else if (pathStr.includes('workspace-tool.md')) {
        return workspaceToolContent;
      } else if (pathStr.includes('shared-tool.md')) {
        if (pathStr.includes(homeDir)) {
          return globalToolContent;
        } else {
          return overrideToolContent;
        }
      }
      return '';
    });

    const result = loadMergedUserTools('/workspace');

    // Check global tools
    expect(result.globalTools.size).toBe(2);
    expect(result.globalTools.get('global-tool')).toBeTruthy();
    expect(result.globalTools.get('shared-tool')).toBeTruthy();

    // Check workspace tools
    expect(result.workspaceTools.size).toBe(2);
    expect(result.workspaceTools.get('workspace-tool')).toBeTruthy();
    expect(result.workspaceTools.get('shared-tool')).toBeTruthy();

    // Check merged tools
    expect(result.mergedTools.size).toBe(3);
    expect(result.mergedTools.get('global-tool')?.description).toBe(
      'Global tool',
    );
    expect(result.mergedTools.get('workspace-tool')?.description).toBe(
      'Workspace tool',
    );
    expect(result.mergedTools.get('shared-tool')?.description).toBe(
      'Override tool from workspace',
    );

    // Check no errors
    expect(result.errors).toEqual([]);
  });

  it('should handle errors gracefully when loading fails', () => {
    // Set up the mock to throw an error when checking existence
    vi.mocked(fs.existsSync).mockImplementation(() => {
      throw new Error('File system error');
    });

    const result = loadMergedUserTools('/workspace');

    // The loadMergedUserTools function catches errors and returns empty maps with error messages
    expect(result.globalTools.size).toBe(0);
    expect(result.workspaceTools.size).toBe(0);
    expect(result.mergedTools.size).toBe(0);

    // No errors are reported because the UserToolsLoader catches and handles them internally
    expect(result.errors.length).toBe(0);
  });
});
