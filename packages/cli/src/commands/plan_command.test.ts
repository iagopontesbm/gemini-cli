// packages/cli/src/commands/plan_command.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePlanCommand } from './plan_command';
import type { Config } from '@google/gemini-cli-core';

// Mock dependencies
const mockReadFile = vi.fn();
vi.mock('node:fs/promises', async (importOriginal) => {
    const actualFs = await importOriginal();
    return {
        ...actualFs, // Spread actualFs to ensure all exports are present
        readFile: mockReadFile,
    };
});

const mockLoadSession = vi.fn();
vi.mock('../session/session_manager.js', () => ({
  loadSession: mockLoadSession,
  // saveSession and clearSession are not used by plan_command
}));

// Mock Config - plan_command uses it minimally, if at all directly.
const mockConfig = {} as unknown as Config;

const sampleSpecContent = "This is the specification content.";
const sampleTasksContent = {
  epics: [{ title: 'Epic A', tasks: [{ title: 'Task A1', description: 'First task', status: 'pending' }] }],
};

describe('handlePlanCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mocks
    mockLoadSession.mockResolvedValue({ currentSpecFile: 'custom_spec.md', currentTasksFile: 'custom_tasks.json' });
    mockReadFile.mockImplementation(async (filePath: string) => {
      // Resolve path for consistent matching, as process.cwd() might vary
      const resolvedPath = await import('node:path').then(path => path.resolve(filePath));
      if (resolvedPath.endsWith('custom_spec.md') || resolvedPath.endsWith('spec.md')) return sampleSpecContent;
      if (resolvedPath.endsWith('custom_tasks.json') || resolvedPath.endsWith('tasks.json')) return JSON.stringify(sampleTasksContent);
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should display spec and tasks content when both files exist (from session)', async () => {
    await handlePlanCommand(mockConfig);
    expect(mockLoadSession).toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('custom_spec.md'), 'utf-8');
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('custom_tasks.json'), 'utf-8');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Specification (custom_spec.md) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith(sampleSpecContent);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Project Tasks (from custom_tasks.json) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Epic A'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[ ] Task A1 (pending)'));
  });

  it('should display spec and tasks content using default names if no session', async () => {
    mockLoadSession.mockResolvedValue(undefined); // No session
    await handlePlanCommand(mockConfig);
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('spec.md'), 'utf-8');
    expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('tasks.json'), 'utf-8');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Specification (spec.md) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Project Tasks (from tasks.json) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith("No active session found (.gemini-session.json). Displaying content from default file paths ('spec.md', 'tasks.json') if they exist.");
  });

  it('should show "spec not found" message if spec file does not exist', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      const resolvedPath = await import('node:path').then(path => path.resolve(filePath));
      if (resolvedPath.endsWith('custom_spec.md')) {
        const error = new Error('ENOENT'); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
      }
      if (resolvedPath.endsWith('custom_tasks.json')) return JSON.stringify(sampleTasksContent);
      return '';
    });
    await handlePlanCommand(mockConfig);
    expect(consoleLogSpy).toHaveBeenCalledWith("Specification file 'custom_spec.md' not found.");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Project Tasks (from custom_tasks.json) ---'));
  });

  it('should show "tasks not found" message if tasks file does not exist', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      const resolvedPath = await import('node:path').then(path => path.resolve(filePath));
      if (resolvedPath.endsWith('custom_spec.md')) return sampleSpecContent;
      if (resolvedPath.endsWith('custom_tasks.json')) {
         const error = new Error('ENOENT'); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
      }
      return '';
    });
    await handlePlanCommand(mockConfig);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Specification (custom_spec.md) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith("Tasks file 'custom_tasks.json' not found.");
  });

  it('should show both "not found" messages if neither file exists', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
        const error = new Error('ENOENT'); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
    });
    await handlePlanCommand(mockConfig);
    expect(consoleLogSpy).toHaveBeenCalledWith("Specification file 'custom_spec.md' not found.");
    expect(consoleLogSpy).toHaveBeenCalledWith("Tasks file 'custom_tasks.json' not found.");
  });

  it('should log error if reading spec file fails with non-ENOENT error', async () => {
    const specReadError = new Error('Permission denied');
    mockReadFile.mockImplementation(async (filePath: string) => {
      const resolvedPath = await import('node:path').then(path => path.resolve(filePath));
      if (resolvedPath.endsWith('custom_spec.md')) throw specReadError;
      if (resolvedPath.endsWith('custom_tasks.json')) return JSON.stringify(sampleTasksContent);
      return '';
    });
    await handlePlanCommand(mockConfig);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error reading specification file 'custom_spec.md':", "Permission denied");
  });

  it('should log error if reading/parsing tasks file fails with non-ENOENT error (e.g. bad JSON)', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      const resolvedPath = await import('node:path').then(path => path.resolve(filePath));
      if (resolvedPath.endsWith('custom_spec.md')) return sampleSpecContent;
      if (resolvedPath.endsWith('custom_tasks.json')) return "this is not json"; // Invalid JSON
      return '';
    });
    await handlePlanCommand(mockConfig);
    // Check for the specific error message related to JSON parsing.
    // The exact error message might vary slightly based on the Node.js version's JSON.parse.
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error reading or parsing tasks file 'custom_tasks.json':"), expect.stringMatching(/Unexpected token|JSON/i));
  });
});
