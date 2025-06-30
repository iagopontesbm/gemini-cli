/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GenerateCommitMessageTool } from './generate-commit-message.js';
import { Config, ApprovalMode } from '../config/config.js';
import { spawn } from 'child_process';
import { GeminiClient } from '../core/client.js';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('../core/client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateContent: vi.fn(),
  })),
}));

// Helper function to create git command mock
function createGitCommandMock(outputs: { [key: string]: string }) {
  return (_command: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: { on: ReturnType<typeof vi.fn> };
      stderr: { on: ReturnType<typeof vi.fn> };
      stdin?: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
    };

    const argString = args.join(' ');
    if (_command === 'git' && argString.includes('commit')) {
      child.stdin = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      };
    }

    child.stdout = {
      on: vi.fn((event: string, listener: (data: Buffer) => void) => {
        if (event === 'data') {
          for (const [pattern, output] of Object.entries(outputs)) {
            if (argString.includes(pattern)) {
              listener(Buffer.from(output));
              break;
            }
          }
        }
      }),
    };

    child.stderr = { on: vi.fn() };
    process.nextTick(() => child.emit('close', 0));
    return child;
  };
}

describe('GenerateCommitMessageTool', () => {
  let tool: GenerateCommitMessageTool;
  let mockConfig: Config;
  let mockClient: GeminiClient;
  let mockSpawn: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new GeminiClient({} as unknown as Config);
    mockConfig = {
      getGeminiClient: () => mockClient,
      getApprovalMode: () => ApprovalMode.DEFAULT,
      setApprovalMode: vi.fn(),
    } as unknown as Config;
    tool = new GenerateCommitMessageTool(mockConfig);
    mockSpawn = spawn as Mock;
    (mockClient.generateContent as Mock).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  analysis: {
                    changedFiles: ['file.txt'],
                    changeType: 'feat',
                    scope: '',
                    purpose: 'Add new feature',
                    impact: 'Improves functionality',
                    hasSensitiveInfo: false,
                  },
                  commitMessage: {
                    header: 'feat: new feature',
                    body: '',
                    footer: '',
                  },
                }),
              },
            ],
          },
        },
      ],
    });
  });

  it('should return a message when there are no changes', async () => {
    mockSpawn.mockImplementation(createGitCommandMock({
      'status': '',
      'diff --cached': '',
      'diff': '',
      'log': 'abc1234 Previous commit'
    }));

    const result = await tool.execute(undefined, new AbortController().signal);

    expect(result.llmContent).toBe(
      'No changes detected in the current workspace.',
    );
    expect(result.returnDisplay).toBe(
      'No changes detected in the current workspace.',
    );
    expect(mockClient.generateContent).not.toHaveBeenCalled();
  });

  it('should return an error when git command fails', async () => {
    mockSpawn.mockImplementation((_command, _args) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: { on: ReturnType<typeof vi.fn> };
        stderr: { on: ReturnType<typeof vi.fn> };
      };
      child.stdout = { on: vi.fn() };
      child.stderr = { on: vi.fn((event: string, listener: (data: Buffer) => void) => {
        if (event === 'data') listener(Buffer.from('git error'));
      }) };
      process.nextTick(() => child.emit('close', 1));
      return child;
    });

    const result = await tool.execute(undefined, new AbortController().signal);

    expect(result.llmContent).toContain('Error during commit workflow');
    expect(result.returnDisplay).toContain('Error during commit workflow');
    expect(mockClient.generateContent).not.toHaveBeenCalled();
  });

  it('should generate a commit message and create commit when there are staged changes', async () => {
    const diff =
      'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
    const statusOutput = 'M  file.txt';
    const logOutput = 'abc1234 Previous commit message';

    mockSpawn.mockImplementation((command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: { on: ReturnType<typeof vi.fn> };
        stderr: { on: ReturnType<typeof vi.fn> };
        stdin?: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
      };
      const argString = args.join(' ');

      child.stdout = {
        on: vi.fn((event: string, listener: (data: Buffer) => void) => {
          if (event === 'data') {
            if (argString.includes('status'))
              listener(Buffer.from(statusOutput));
            else if (argString.includes('diff --cached'))
              listener(Buffer.from(diff));
            else if (argString.includes('diff') && !args.includes('--cached'))
              listener(Buffer.from(''));
            else if (argString.includes('log'))
              listener(Buffer.from(logOutput));
            else listener(Buffer.from(''));
          }
        }),
      };

      child.stderr = { on: vi.fn() };

      if (command === 'git' && argString === 'commit -F -') {
        child.stdin = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn(),
        };
      }

      process.nextTick(() => child.emit('close', 0));
      return child;
    });

    const controller = new AbortController();
    const result = await tool.execute(undefined, controller.signal);

    expect(result.llmContent).toBe(
      'Commit created successfully!\n\nCommit message:\nfeat: new feature',
    );
    expect(result.returnDisplay).toBe(
      'Commit created successfully!\n\nCommit message:\nfeat: new feature',
    );
    expect(mockClient.generateContent).toHaveBeenCalledWith(
      [
        {
          role: 'user',
          parts: [
            {
              text: expect.stringContaining(diff),
            },
          ],
        },
      ],
      {},
      controller.signal,
    );

    // Verify git commands were called in correct sequence
    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain'],
      expect.any(Object),
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['diff', '--cached'],
      expect.any(Object),
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['commit', '-F', '-'],
      expect.any(Object),
    );
  });

  it('should generate a commit message when there are only unstaged changes', async () => {
    const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
    const statusOutput = ' M file.txt';
    const logOutput = 'abc1234 Previous commit message';

    mockSpawn.mockImplementation(createGitCommandMock({
      'status': statusOutput,
      'diff --cached': '', // No staged changes
      diff,
      'log': logOutput,
      add: '',
      'commit': ''
    }));

    const controller = new AbortController();
    const result = await tool.execute(undefined, controller.signal);

    expect(result.llmContent).toBe('Commit created successfully!\n\nCommit message:\nfeat: new feature');
    expect(result.returnDisplay).toBe('Commit created successfully!\n\nCommit message:\nfeat: new feature');
    expect(mockClient.generateContent).toHaveBeenCalledWith(
      [
        {
          role: 'user',
          parts: [
            {
              text: expect.stringContaining(diff),
            },
          ],
        },
      ],
      {},
      controller.signal,
    );
    
    // Verify staging command was called for unstaged changes
    expect(mockSpawn).toHaveBeenCalledWith('git', ['add', '.'], expect.any(Object));
  });

  it('should handle pre-commit hook modifications and retry', async () => {
    const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
    const statusOutput = 'M  file.txt';
    const logOutput = 'abc1234 Previous commit message';

    let commitCallCount = 0;
    mockSpawn.mockImplementation((_command, args) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: { on: ReturnType<typeof vi.fn> };
        stderr: { on: ReturnType<typeof vi.fn> };
        stdin?: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
      };
      
      child.stdout = { on: vi.fn((event: string, listener: (data: Buffer) => void) => {
        if (event === 'data') {
          const argString = args.join(' ');
          if (argString.includes('status')) {
            listener(Buffer.from(statusOutput));
          } else if (argString.includes('diff --cached')) {
            listener(Buffer.from(diff));
          } else if (argString.includes('diff') && !argString.includes('--cached')) {
            listener(Buffer.from(''));
          } else if (argString.includes('log')) {
            listener(Buffer.from(logOutput));
          } else {
            listener(Buffer.from('')); // Default for add and commit
          }
        }
      }) };
      
      child.stderr = { on: vi.fn((event: string, listener: (data: Buffer) => void) => {
        if (event === 'data' && args.includes('commit') && commitCallCount === 0) {
          listener(Buffer.from('pre-commit hook failed'));
        }
      }) };

      if (args.includes('commit')) {
        child.stdin = {
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn(),
        };
      }
      
      process.nextTick(() => {
        if (args.includes('commit')) {
          commitCallCount++;
          if (commitCallCount === 1) {
            child.emit('close', 1); // First commit fails
          } else {
            child.emit('close', 0); // Second commit succeeds
          }
        } else {
          child.emit('close', 0); // All other commands succeed
        }
      });
      
      return child;
    });

    const controller = new AbortController();
    const result = await tool.execute(undefined, controller.signal);

    expect(result.llmContent).toBe('Commit created successfully after pre-commit hook modifications!\n\nCommit message:\nfeat: new feature');
    expect(result.returnDisplay).toBe('Commit created successfully after pre-commit hook modifications!\n\nCommit message:\nfeat: new feature');
    
    // Verify retry staging was called
    expect(mockSpawn).toHaveBeenCalledWith('git', ['add', '.'], expect.any(Object));
    // Verify both commit attempts were made
    expect(commitCallCount).toBe(2);
  });

  it('should return an error when spawn process fails to start', async () => {
    const mockError = new Error('spawn error');
    mockSpawn.mockImplementationOnce(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: { on: ReturnType<typeof vi.fn> };
        stderr: { on: ReturnType<typeof vi.fn> };
      };
      child.stdout = { on: vi.fn() };
      child.stderr = { on: vi.fn() };
      process.nextTick(() => child.emit('error', mockError));
      return child;
    });

    const result = await tool.execute(undefined, new AbortController().signal);

    expect(result.llmContent).toContain('Error during commit workflow');
    expect(result.returnDisplay).toContain('Error during commit workflow');
    expect(mockClient.generateContent).not.toHaveBeenCalled();
  });

  it('should handle mixed staged and unstaged changes intelligently', async () => {
    const statusOutput = 'MM file.txt\n?? newfile.txt';
    const logOutput = 'abc1234 Previous commit message';

    mockSpawn.mockImplementation(createGitCommandMock({
      'status': statusOutput,
      'diff --cached': 'diff --git a/file.txt b/file.txt\n@@ -1 +1 @@\n-line2\n+line2 modified',
      'diff': 'diff --git a/file.txt b/file.txt\n@@ -2 +2 @@\n+line3 added',
      'log': logOutput,
      add: '',
      'commit': ''
    }));

    (mockClient.generateContent as Mock).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  analysis: {
                    changedFiles: ['file.txt'],
                    changeType: 'feat',
                    scope: '',
                    purpose: 'Add staged changes',
                    impact: 'Improves functionality with staged changes',
                    hasSensitiveInfo: false,
                  },
                  commitMessage: {
                    header: 'feat: staged changes',
                    body: '',
                    footer: '',
                  },
                }),
              },
            ],
          },
        },
      ],
    });

    const controller = new AbortController();
    const result = await tool.execute(undefined, controller.signal);

    expect(result.llmContent).toBe('Commit created successfully!\n\nCommit message:\nfeat: staged changes');
    expect(result.returnDisplay).toBe('Commit created successfully!\n\nCommit message:\nfeat: staged changes');
    
    // With staged changes present, should NOT call git add (only commit staged changes)
    expect(mockSpawn).not.toHaveBeenCalledWith('git', ['add', '.'], expect.any(Object));
  });

  describe('JSON parsing', () => {
    it('should parse JSON from markdown code blocks', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
        'commit': ''
      }));

      const jsonResponse = {
        analysis: {
          changedFiles: ['file.txt'],
          changeType: 'feat' as const,
          scope: '',
          purpose: 'Update file content',
          impact: 'Improves file',
          hasSensitiveInfo: false,
        },
        commitMessage: {
          header: 'feat: update file content',
          body: '',
          footer: '',
        },
      };

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `Here's the analysis:\n\`\`\`json\n${JSON.stringify(jsonResponse, null, 2)}\n\`\`\`\n\nThis is a good commit.`,
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toBe('Commit created successfully!\n\nCommit message:\nfeat: update file content');
    });

    it('should parse JSON without markdown code blocks', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
        'commit': ''
      }));

      const jsonResponse = {
        analysis: {
          changedFiles: ['file.txt'],
          changeType: 'fix' as const,
          scope: '',
          purpose: 'Fix file issue',
          impact: 'Fixes bug',
          hasSensitiveInfo: false,
        },
        commitMessage: {
          header: 'fix: resolve file issue',
          body: '',
          footer: '',
        },
      };

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `Analysis: ${JSON.stringify(jsonResponse)} and some additional text after`,
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toBe('Commit created successfully!\n\nCommit message:\nfix: resolve file issue');
    });

    it('should handle multiple JSON objects and parse the first one', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
        'commit': ''
      }));

      const firstJsonResponse = {
        analysis: {
          changedFiles: ['file.txt'],
          changeType: 'docs' as const,
          scope: '',
          purpose: 'Update documentation',
          impact: 'Improves docs',
          hasSensitiveInfo: false,
        },
        commitMessage: {
          header: 'docs: update documentation',
          body: '',
          footer: '',
        },
      };

      const secondJsonResponse = {
        analysis: {
          changedFiles: ['other.txt'],
          changeType: 'feat' as const,
          scope: '',
          purpose: 'Should not be parsed',
          impact: 'Wrong one',
          hasSensitiveInfo: false,
        },
        commitMessage: {
          header: 'feat: should not be used',
          body: '',
          footer: '',
        },
      };

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `First: ${JSON.stringify(firstJsonResponse)} and second: ${JSON.stringify(secondJsonResponse)}`,
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toBe('Commit created successfully!\n\nCommit message:\ndocs: update documentation');
    });

    it('should handle invalid JSON gracefully', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
      }));

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'This is not JSON at all, just some text response without proper structure.',
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Error during commit workflow');
      expect(result.llmContent).toContain('AI response parsing failed');
    });

    it('should handle malformed JSON structure gracefully', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
      }));

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    analysis: {
                      changedFiles: 'should be array', // Invalid type
                      changeType: 'feat',
                      purpose: 'Test purpose',
                      impact: 'Test impact',
                      hasSensitiveInfo: false,
                    },
                    commitMessage: {
                      header: 'feat: test',
                    },
                  }),
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Error during commit workflow');
      expect(result.llmContent).toContain('AI response parsing failed');
    });
  });

  describe('Git index hash and race condition protection', () => {
    it('should complete commit workflow successfully', async () => {
      const statusOutput = 'M  file.txt';
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
        'commit': ''
      }));

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Commit created successfully!');
      expect(result.llmContent).toContain('feat: new feature');
    });
  });

  describe('Enhanced error handling', () => {
    it('should handle stdin write errors gracefully', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation((_command, args) => {
        const child = new EventEmitter() as EventEmitter & {
          stdout: { on: ReturnType<typeof vi.fn> };
          stderr: { on: ReturnType<typeof vi.fn> };
          stdin?: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };
        };
        
        child.stdout = { on: vi.fn((event: string, listener: (data: Buffer) => void) => {
          if (event === 'data') {
            const argString = args.join(' ');
            if (argString.includes('status')) {
              listener(Buffer.from(statusOutput));
            } else if (argString.includes('diff --cached')) {
              listener(Buffer.from(diff));
            } else if (argString.includes('diff') && !argString.includes('--cached')) {
              listener(Buffer.from(''));
            } else if (argString.includes('log')) {
              listener(Buffer.from(logOutput));
            } else {
              listener(Buffer.from(''));
            }
          }
        }) };
        
        child.stderr = { on: vi.fn() };
        
        if (args.includes('commit')) {
          child.stdin = {
            write: vi.fn(() => {
              throw new Error('EPIPE: broken pipe');
            }),
            end: vi.fn(),
            on: vi.fn(),
          };
        }
        
        process.nextTick(() => child.emit('close', 0));
        return child;
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Error during commit workflow');
      expect(result.llmContent).toContain('Failed to write to git process stdin');
    });

    it('should handle AI API errors with specific messages', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
      }));

      (mockClient.generateContent as Mock).mockRejectedValue(new Error('quota exceeded'));

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Error during commit workflow');
      expect(result.llmContent).toContain('API error during commit message generation');
    });

    it('should detect sensitive information in commits', async () => {
      const diff = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      const statusOutput = 'M  file.txt';
      const logOutput = 'abc1234 Previous commit message';

      mockSpawn.mockImplementation(createGitCommandMock({
        'status': statusOutput,
        'diff --cached': diff,
        'diff': '',
        'log': logOutput,
      }));

      (mockClient.generateContent as Mock).mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    analysis: {
                      changedFiles: ['file.txt'],
                      changeType: 'feat',
                      scope: '',
                      purpose: 'Add API key',
                      impact: 'Adds functionality',
                      hasSensitiveInfo: true, // Sensitive info detected
                    },
                    commitMessage: {
                      header: 'feat: add API integration',
                      body: '',
                      footer: '',
                    },
                  }),
                },
              ],
            },
          },
        ],
      });

      const result = await tool.execute(undefined, new AbortController().signal);

      expect(result.llmContent).toContain('Error during commit workflow');
      expect(result.llmContent).toContain('potentially sensitive information');
    });
  });
});