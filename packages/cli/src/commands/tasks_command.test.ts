// packages/cli/src/commands/tasks_command.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleTasksCommand } from './tasks_command';
import type { Config, Content } from '@google/gemini-cli-core'; // Added Content

// Mock dependencies
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();

vi.mock('node:fs/promises', async (importOriginal) => {
    const actualFs = await importOriginal();
    return {
        ...actualFs,
        writeFile: mockWriteFile,
        readFile: mockReadFile,
    };
});
vi.mock('../utils/hitl.js', () => ({
  confirmProceed: vi.fn(),
}));
vi.mock('../session/session_manager.js', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
  loadSession: vi.fn().mockResolvedValue({ currentSpecFile: 'spec.md', currentTasksFile: 'tasks.json' }),
}));

const mockGenerateContent = vi.fn();
const mockIsInitialized = vi.fn().mockReturnValue(true);
const mockInitialize = vi.fn().mockResolvedValue(undefined);

const mockGetGeminiClient = vi.fn(() => ({
  generateContent: mockGenerateContent,
  isInitialized: mockIsInitialized,
  initialize: mockInitialize,
}));
const mockGetContentGeneratorConfig = vi.fn(() => ({ model: 'gemini-test-model', responseMimeType: "application/json" }));

const mockConfig = {
  getGeminiClient: mockGetGeminiClient,
  getContentGeneratorConfig: mockGetContentGeneratorConfig,
  // Add other relevant methods from Config if your command uses them
} as unknown as Config;

const sampleTasksFileContent = {
  epics: [{ title: 'Epic 1', tasks: [{ title: 'Task 1', description: 'Desc 1', status: 'pending' }] }],
};
const sampleSpecFileContent = "This is a sample spec.";

describe('handleTasksCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let confirmProceedMock: ReturnType<typeof vi.fn>;


  beforeEach(async () => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);

    const hitl = await import('../utils/hitl.js');
    confirmProceedMock = hitl.confirmProceed as ReturnType<typeof vi.fn>;

    // Default mocks
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === 'tasks.json') return JSON.stringify(sampleTasksFileContent);
      if (filePath === 'spec.md') return sampleSpecFileContent;
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    });
    mockGenerateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: JSON.stringify(sampleTasksFileContent) }] } }],
    });
    confirmProceedMock.mockResolvedValue(true); // Default to "yes" for HITL prompts
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should display existing tasks if tasks.json exists and --generate is false', async () => {
    await handleTasksCommand(mockConfig, false);
    expect(mockReadFile).toHaveBeenCalledWith('tasks.json', 'utf-8');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--- Project Tasks (from tasks.json) ---'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Epic 1'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[ ] Task 1 (pending)'));
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should generate tasks if tasks.json does not exist', async () => {
    const { saveSession } = await import('../session/session_manager.js');
    mockReadFile.mockImplementation(async (filePath: string) => {
      if (filePath === 'spec.md') return sampleSpecFileContent;
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    });

    await handleTasksCommand(mockConfig, false);

    expect(mockReadFile).toHaveBeenCalledWith('spec.md', 'utf-8');
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith('tasks.json', JSON.stringify(sampleTasksFileContent, null, 2));
    expect(saveSession).toHaveBeenCalledWith('spec.md', 'tasks.json');
    expect(consoleLogSpy).toHaveBeenCalledWith('Tasks successfully generated and saved to tasks.json');
  });

  it('should generate tasks if --generate is true, even if tasks.json exists', async () => {
     const { saveSession } = await import('../session/session_manager.js');
    // tasks.json exists (default mockReadFile behavior for it)
    // spec.md exists (default mockReadFile behavior for it)

    await handleTasksCommand(mockConfig, true); // forceGenerate = true

    expect(mockReadFile).toHaveBeenCalledWith('spec.md', 'utf-8');
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith('tasks.json', JSON.stringify(sampleTasksFileContent, null, 2));
    expect(saveSession).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Tasks successfully generated and saved to tasks.json');
  });


  it('should exit if spec.md not found during generation', async () => {
    mockReadFile.mockImplementation(async (filePath: string) => {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    });

    await handleTasksCommand(mockConfig, true);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: spec.md not found.'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle AI error during task parsing', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('AI API Error'));
    mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath === 'spec.md') return sampleSpecFileContent;
        const error = new Error(`ENOENT`); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
    });

    await handleTasksCommand(mockConfig, true);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error parsing spec with AI: AI API Error');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle AI returning non-JSON content for tasks', async () => {
    mockGenerateContent.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: "This is not JSON" }] } }] });
    mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath === 'spec.md') return sampleSpecFileContent;
        const error = new Error(`ENOENT`); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
    });

    await handleTasksCommand(mockConfig, true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("The AI's response was not valid JSON."));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });


  describe('Simulated Task Execution HITL', () => {
    beforeEach(() => {
        mockReadFile.mockImplementation(async (filePath: string) => {
            if (filePath === 'spec.md') return sampleSpecFileContent;
            const error = new Error(`ENOENT`); (error as NodeJS.ErrnoException).code = 'ENOENT'; throw error;
        });
        mockGenerateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: JSON.stringify(sampleTasksFileContent) }] } }] });
    });

    it('should proceed with simulated task if user approves pre-execution prompt but find no pending tasks', async () => {
      confirmProceedMock.mockImplementation((prompt: string) => {
        if (prompt.includes("Proceed with simulated execution")) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      const noPendingTasks = { epics: [{ title: 'Epic 1', tasks: [{ title: 'Task 1', description: 'Desc 1', status: 'done' }] }] };
      mockGenerateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: JSON.stringify(noPendingTasks) }] } }] });


      await handleTasksCommand(mockConfig, true); // Force generation
      expect(confirmProceedMock).toHaveBeenCalledWith(expect.stringContaining("Proceed with simulated execution"), true);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No pending tasks found to simulate execution for"));
    });


    it('should skip simulated execution if user declines pre-execution prompt', async () => {
      confirmProceedMock.mockImplementation((prompt: string) => {
        if (prompt.includes("Proceed with simulated execution")) return Promise.resolve(false);
        return Promise.resolve(true);
      });
      await handleTasksCommand(mockConfig, true); // Force generation
      expect(consoleLogSpy).toHaveBeenCalledWith("Simulated task execution cancelled by user.");
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('simulated error: should propose AI fix and apply if user approves', async () => {
        mockGenerateContent
            .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: JSON.stringify(sampleTasksFileContent) }] } }] })
            .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: "AI's dynamic fix suggestion." }] } }] });

        confirmProceedMock.mockImplementation((prompt: string) => {
            if (prompt.includes("Proceed with simulated execution")) return Promise.resolve(true);
            if (prompt.includes("apply the AI's suggested fix")) return Promise.resolve(true);
            return Promise.resolve(false);
        });

        await handleTasksCommand(mockConfig, true); // Force generation

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Oops! An error occurred"));
        expect(consoleLogSpy).toHaveBeenCalledWith("AI Suggested Fix: AI's dynamic fix suggestion.");
        expect(mockWriteFile).toHaveBeenCalledWith('tasks.json', expect.stringContaining('"status": "done"'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Task 'Task 1' status updated to 'done'"));
    });

    it('simulated error: should not apply fix if user declines', async () => {
        mockGenerateContent
            .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: JSON.stringify(sampleTasksFileContent) }] } }] })
            .mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: "AI's dynamic fix suggestion." }] } }] });

        confirmProceedMock.mockImplementation((prompt: string) => {
            if (prompt.includes("Proceed with simulated execution")) return Promise.resolve(true);
            if (prompt.includes("apply the AI's suggested fix")) return Promise.resolve(false);
            return Promise.resolve(true);
        });

        await handleTasksCommand(mockConfig, true); // Force generation

        expect(consoleLogSpy).toHaveBeenCalledWith("AI Suggested Fix: AI's dynamic fix suggestion.");
        expect(consoleLogSpy).toHaveBeenCalledWith("Fix not applied. Please address the error manually.");

        const writeFileCalls = mockWriteFile.mock.calls;
        const taskJsonWrites = writeFileCalls.filter(call => call[0] === 'tasks.json');
        expect(taskJsonWrites.length).toBe(1);
    });
  });
});
