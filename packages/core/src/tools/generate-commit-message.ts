/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  BaseTool, 
  ToolResult, 
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolConfirmationOutcome 
} from './tools.js';
import { Config, ApprovalMode } from '../config/config.js';
import { GeminiClient } from '../core/client.js';
import { spawn } from 'child_process';
import { getResponseText } from '../utils/generateContentResponseUtilities.js';

interface CommitAnalysis {
  changedFiles: string[];
  changeType: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'perf' | 'test' | 'build' | 'ci' | 'chore' | 'revert';
  scope?: string;
  purpose: string;
  impact: string;
  hasSensitiveInfo: boolean;
}

interface CommitMessageParts {
  header: string;
  body?: string;
  footer?: string;
}

interface AICommitResponse {
  analysis: CommitAnalysis;
  commitMessage: CommitMessageParts;
}

const COMMIT_ANALYSIS_PROMPT = `You are an expert software engineer specializing in writing concise and meaningful git commit messages following the Conventional Commits format.

Your task is to analyze git changes and generate commit messages that follow this specific workflow:

# Analysis Process
1. List the files that have been changed or added
2. Summarize the nature of the changes (new feature, enhancement, bug fix, refactoring, test, docs, etc.)
3. Determine the purpose or motivation behind these changes
4. Assess the impact of these changes on the overall project
5. Check for any sensitive information that shouldn't be committed
6. Draft a concise commit message that focuses on the "why" rather than the "what"

# Commit Message Format
- **Header**: \`type(scope): subject\` (lowercase)
- **Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- **Body**: Optional. Explain the "what" and "why" using imperative, present tense
- **Footer**: Optional. For BREAKING CHANGES and issue references

# Requirements
- Message must be clear, concise, and to the point
- Must accurately reflect the changes and their purpose
- Avoid generic words like "Update" or "Fix" without context
- Focus on the motivation and impact, not just the implementation details

# Output Format
You MUST respond with a valid JSON object in the following format:
{
  "analysis": {
    "changedFiles": ["list of files"],
    "changeType": "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert",
    "scope": "optional scope string",
    "purpose": "description of why these changes were made",
    "impact": "description of the impact on the project",
    "hasSensitiveInfo": false
  },
  "commitMessage": {
    "header": "type(scope): subject",
    "body": "optional body text",
    "footer": "optional footer text"
  }
}

# Git Status
\`\`\`
{{status}}
\`\`\`

# Git Diff
\`\`\`diff
{{diff}}
\`\`\`

# Recent Commit Messages (for reference)
\`\`\`
{{log}}
\`\`\``;

export class GenerateCommitMessageTool extends BaseTool<undefined, ToolResult> {
  static readonly Name = 'generate_commit_message';
  private readonly client: GeminiClient;
  private readonly config: Config;
  
  // Cache generated commit message to avoid regeneration
  private cachedCommitData: {
    statusOutput: string;
    diffOutput: string;
    logOutput: string;
    commitMessage: string;
    finalCommitMessage: string;
    timestamp: number;
    commitMode: 'staged-only' | 'all-changes';
    indexHash: string;
  } | null = null;

  constructor(config: Config) {
    super(
      GenerateCommitMessageTool.Name,
      'Generate Commit Message',
      'Executes a git commit workflow: analyzes changes, generates commit message, and creates commit.',
      {
        properties: {},
        required: [],
        type: 'object',
      },
    );
    this.client = config.getGeminiClient();
    this.config = config;
  }

  validateToolParams(_params: undefined): string | null {
    return null;
  }

  getDescription(_params: undefined): string {
    return 'Analyze git changes and create commit.';
  }

  async shouldConfirmExecute(
    _params: undefined,
    signal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Check if auto-commit is enabled
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }

    try {
      // First gather git information
      const [statusOutput, stagedDiff, unstagedDiff, logOutput] = await Promise.all([
        this.executeGitCommand(['status', '--porcelain'], signal),
        this.executeGitCommand(['diff', '--cached'], signal),
        this.executeGitCommand(['diff'], signal),
        this.executeGitCommand(['log', '--oneline', '-10'], signal)
      ]);
      
      const gitState = this.analyzeGitState(statusOutput || '', stagedDiff || '', unstagedDiff || '');
      const commitMode = this.determineCommitStrategy(gitState);

      const diffForAI = commitMode === 'staged-only' ? 
        (stagedDiff || '') : 
[stagedDiff, unstagedDiff].filter(d => d?.trim()).join('\n');

      if (!diffForAI?.trim()) {
        // No changes to confirm
        return false;
      }

      // Generate commit message first and cache it
      const commitMessage = await this.generateCommitMessage(
        statusOutput || '',
        diffForAI,
        logOutput || '',
        signal
      );
      if (!commitMessage?.trim()) {
        throw new Error('The AI failed to generate a valid commit message.');
      }
      const finalCommitMessage = this.addGeminiSignature(commitMessage);
      
      // Get current git index hash for race condition protection
      const indexHash = await this.getGitIndexHash(signal);
      
      // Cache the data for execute method
      this.cachedCommitData = {
        statusOutput: statusOutput || '',
        diffOutput: diffForAI,
        logOutput: logOutput || '',
        commitMessage,
        finalCommitMessage,
        timestamp: Date.now(),
        commitMode,
        indexHash
      };

      // Determine which files will be committed for display
      const filesToCommit = this.parseFilesToBeCommitted(statusOutput || '', commitMode === 'staged-only');
      
      let filesDisplay = '';
      if (filesToCommit.length > 0) {
        filesDisplay = `\n\nFiles to be committed:\n${filesToCommit.map(f => `  - ${f}`).join('\n')}`;
      }

      const confirmationDetails: ToolExecuteConfirmationDetails = {
        type: 'exec',
        title: 'Confirm Git Commit',
        command: `Commit with message:\n\n${finalCommitMessage}${filesDisplay}`,
        rootCommand: 'git-commit',
        onConfirm: async (outcome: ToolConfirmationOutcome) => {
          if (outcome === ToolConfirmationOutcome.ProceedAlways) {
            this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
          }
        },
      };
      return confirmationDetails;
    } catch (error) {
      const errorDetails = this.formatExecutionError(error);
      throw new Error(errorDetails.message);
    }
  }

  async execute(_params: undefined, signal: AbortSignal): Promise<ToolResult> {
    console.debug('[GenerateCommitMessage] Starting git commit workflow...');

    try {
      let finalCommitMessage: string;
      let statusOutput: string;

      // Check if we have cached data from shouldConfirmExecute
      if (this.cachedCommitData && await this.isCacheValid(signal)) {
        console.debug('[GenerateCommitMessage] Using cached commit message from confirmation...');
        
        finalCommitMessage = this.cachedCommitData.finalCommitMessage;
        statusOutput = this.cachedCommitData.statusOutput;
        
        // Keep cache for staging strategy execution - don't clear yet
      } else {
        console.debug('[GenerateCommitMessage] No valid cache, generating fresh commit message...');
        
        // Step 1: Gather git information (parallel execution)
        const [statusOut, stagedDiff, unstagedDiff, logOutput] = await Promise.all([
          this.executeGitCommand(['status', '--porcelain'], signal),
          this.executeGitCommand(['diff', '--cached'], signal),
          this.executeGitCommand(['diff'], signal),
          this.executeGitCommand(['log', '--oneline', '-10'], signal)
        ]);
        
        const gitState = this.analyzeGitState(statusOut || '', stagedDiff || '', unstagedDiff || '');
        const commitMode = this.determineCommitStrategy(gitState);
        
        const diffForAI = commitMode === 'staged-only' ? 
          (stagedDiff || '') : 
[stagedDiff, unstagedDiff].filter(d => d?.trim()).join('\n');

        statusOutput = statusOut || '';

        if (!diffForAI?.trim()) {
          return {
            llmContent: 'No changes detected in the current workspace.',
            returnDisplay: 'No changes detected in the current workspace.',
          };
        }

        // Step 2: Generate commit message using AI analysis
        const commitMessage = await this.generateCommitMessage(
          statusOutput,
          diffForAI,
          logOutput || '',
          signal
        );

        finalCommitMessage = this.addGeminiSignature(commitMessage);
      }

      // Step 3: Handle staging based on cached strategy or current state
      const cachedData = this.cachedCommitData;
      if (cachedData) {
        await this.executeCommitStrategy(cachedData.commitMode, signal);
      } else {
        // Fallback for non-cached execution - determine staging strategy
        const currentStagedDiff = await this.executeGitCommand(['diff', '--cached'], signal);
        const currentUnstagedDiff = await this.executeGitCommand(['diff'], signal);
        const currentGitState = this.analyzeGitState(statusOutput, currentStagedDiff || '', currentUnstagedDiff || '');
        const currentCommitMode = this.determineCommitStrategy(currentGitState);
        
        await this.executeCommitStrategy(currentCommitMode, signal);
      }

      // Step 4: Create commit
      console.debug('[GenerateCommitMessage] Creating commit with message:', finalCommitMessage.substring(0, 100) + '...');
      
      try {
        await this.executeGitCommand(['commit', '-F', '-'], signal, finalCommitMessage);
        
        // Clear cache after successful commit
        this.cachedCommitData = null;
        
        // Step 5: Verify commit was successful
        await this.executeGitCommand(['status', '--porcelain'], signal);
        
        return {
          llmContent: `Commit created successfully!\n\nCommit message:\n${finalCommitMessage}`,
          returnDisplay: `Commit created successfully!\n\nCommit message:\n${finalCommitMessage}`,
        };
      } catch (commitError) {
        // Handle pre-commit hook modifications with comprehensive retry
        if (commitError instanceof Error && 
            (commitError.message.includes('pre-commit') || 
             commitError.message.includes('index.lock') ||
             commitError.message.includes('hook'))) {
          console.debug('[GenerateCommitMessage] Pre-commit hook or staging issue detected, implementing comprehensive retry...');
          
          // Stage all modified files comprehensively
          await this.executeGitCommand(['add', '.'], signal);
          
          try {
            await this.executeGitCommand(['commit', '-F', '-'], signal, finalCommitMessage);
            
            // Clear cache after successful retry commit
            this.cachedCommitData = null;
            
            return {
              llmContent: `Commit created successfully after pre-commit hook modifications!\n\nCommit message:\n${finalCommitMessage}`,
              returnDisplay: `Commit created successfully after pre-commit hook modifications!\n\nCommit message:\n${finalCommitMessage}`,
            };
          } catch (retryError) {
            // If retry fails, provide detailed error information
            const errorDetails = retryError instanceof Error ? retryError.message : String(retryError);
            throw new Error(`Commit failed after pre-commit hook retry. Original error: ${commitError.message}. Retry error: ${errorDetails}`);
          }
        }
        throw commitError;
      }

    } catch (error) {
      console.error('[GenerateCommitMessage] Error during execution:', error);
      const errorDetails = this.formatExecutionError(error);
      return {
        llmContent: `Error during commit workflow: ${errorDetails.message}`,
        returnDisplay: `Error during commit workflow: ${errorDetails.message}`,
      };
    }
  }

  private async executeGitCommand(
    args: string[],
    signal: AbortSignal,
    stdin?: string,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const commandString = `git ${args.join(' ')}`;
      console.debug(`[GenerateCommitMessage] Executing: ${commandString}`);
      
      try {
        const child = spawn('git', args, { signal, stdio: 'pipe' });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // Write stdin if provided
        if (stdin && child.stdin) {
          child.stdin.on('error', (err) => {
            // This can happen if the process exits before we finish writing.
            // The 'close' or 'error' event on the child process will reject the promise.
            console.debug(`[GenerateCommitMessage] stdin write error: ${err.message}`);
          });
          child.stdin.write(stdin);
          child.stdin.end();
        }

        child.on('close', (exitCode) => {
          if (exitCode !== 0) {
            const errorMessage = this.formatGitError(args, exitCode ?? -1, stderr);
            console.error(`[GenerateCommitMessage] Command failed: ${commandString}, Error: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else {
            console.debug(`[GenerateCommitMessage] Command succeeded: ${commandString}`);
            resolve(stdout.trim() || null);
          }
        });

        child.on('error', (err: Error & { code?: string }) => {
          const errorMessage = `Failed to execute git command '${commandString}': ${err.message}`;
          console.error(`[GenerateCommitMessage] Spawn error: ${errorMessage}`);

          // Provide helpful error context
          if (err.code === 'ENOENT') {
            reject(
              new Error(
                `Git is not installed or not found in PATH. Please install Git and try again.`,
              ),
            );
          } else if (err.code === 'EACCES') {
            reject(
              new Error(
                `Permission denied when executing git command. Please check file permissions.`,
              ),
            );
          } else {
            reject(new Error(errorMessage));
          }
        });

        if (signal.aborted) {
          reject(new Error(`Git command '${commandString}' was aborted before starting`));
          return;
        }
        
      } catch (error) {
        const errorMessage = `Failed to spawn git process: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[GenerateCommitMessage] Spawn setup error: ${errorMessage}`);
        reject(new Error(errorMessage));
      }
    });
  }

  private formatGitError(args: string[], exitCode: number, stderr: string): string {
    const command = args.join(' ');
    const baseError = `Git command failed (${command}) with exit code ${exitCode}`;
    
    if (!stderr.trim()) {
      return `${baseError}: No error details available`;
    }

    // Provide more specific error messages for common scenarios
    if (stderr.includes('not a git repository')) {
      return 'This directory is not a Git repository. Please run this command from within a Git repository.';
    } else if (stderr.includes('no changes added to commit')) {
      return 'No changes have been staged for commit. Use "git add" to stage changes first.';
    } else if (stderr.includes('nothing to commit')) {
      return 'No changes detected. There is nothing to commit.';
    } else if (stderr.includes('index.lock')) {
      return 'Git index is locked. Another git process may be running. Please wait and try again.';
    } else if (stderr.includes('refusing to merge unrelated histories')) {
      return 'Cannot merge unrelated Git histories. This may require manual intervention.';
    } else if (stderr.includes('pathspec') && stderr.includes('did not match any files')) {
      return 'No files match the specified path. Please check the file paths and try again.';
    } else if (stderr.includes('fatal: could not read') || stderr.includes('fatal: unable to read')) {
      return 'Unable to read Git repository data. The repository may be corrupted.';
    } else {
      return `${baseError}: ${stderr.trim()}`;
    }
  }

  private parseUntrackedFiles(statusOutput: string): string[] {
    return statusOutput
      .split('\n')
      .filter(line => line.startsWith('??'))
      .map(line => line.substring(3).trim())
      .filter(file => !file.includes('node_modules/') && !file.includes('.git/'));
  }

  private parseFilesToBeCommitted(statusOutput: string, hasStagedChanges: boolean): string[] {
    const lines = statusOutput.split('\n').filter(line => line.trim());
    const files: string[] = [];

    for (const line of lines) {
      if (line.length < 3) continue;
      
      const status = line.substring(0, 2);
      const filename = line.substring(3).trim();
      
      // Skip files in node_modules and .git
      if (filename.includes('node_modules/') || filename.includes('.git/')) continue;
      
      // If we have staged changes, only show staged files
      if (hasStagedChanges) {
        // First character represents staged status
        if (status[0] !== ' ' && status[0] !== '?') {
          files.push(filename);
        }
      } else {
        // If no staged changes, show all modified and untracked files
        if (status[0] !== ' ' || status[1] !== ' ') {
          files.push(filename);
        }
      }
    }

    return files;
  }

  private async generateCommitMessage(
    status: string,
    diff: string,
    log: string,
    signal: AbortSignal,
  ): Promise<string> {
    const prompt = COMMIT_ANALYSIS_PROMPT
      .replace('{{status}}', status)
      .replace('{{diff}}', diff)
      .replace('{{log}}', log);

    console.debug('[GenerateCommitMessage] Calling Gemini API for commit analysis...');

    try {
      const response = await this.client.generateContent(
        [{ role: 'user', parts: [{ text: prompt }] }],
        {},
        signal,
      );

      const generatedText = getResponseText(response) ?? '';
      
      // Parse JSON response with fallback to text parsing
      const parsedResponse = this.parseAIResponse(generatedText);
      
      if (parsedResponse.analysis.hasSensitiveInfo) {
        console.warn('[GenerateCommitMessage] AI detected potentially sensitive information in changes');
        throw new Error('Commit contains potentially sensitive information. Review the changes and try again.');
      }
      
      // Build commit message from structured response
      return this.buildCommitMessage(parsedResponse.commitMessage);
    } catch (error) {
      console.error('[GenerateCommitMessage] Error during Gemini API call:', error);
      throw new Error(`Failed to generate commit message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private addGeminiSignature(commitMessage: string): string {
    // Return the commit message without any signature
    return commitMessage;
  }

  private async getGitIndexHash(signal: AbortSignal): Promise<string> {
    try {
      // Get the git index hash to detect changes
      const indexHash = await this.executeGitCommand(['write-tree'], signal);
      return indexHash || '';
    } catch (error) {
      console.debug('[GenerateCommitMessage] Failed to get git index hash:', error);
      // Re-throw a more specific error. Masking this can lead to incorrect cache validation
      // and misleading error messages for the user (e.g., "index has changed").
      throw new Error(`Failed to read git index state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseAIResponse(generatedText: string): AICommitResponse {
    try {
      // First, try to extract JSON from markdown code blocks
      const codeBlockMatch = generatedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        const jsonResponse = JSON.parse(codeBlockMatch[1]) as AICommitResponse;
        
        // Validate required fields
        if (!jsonResponse.analysis || !jsonResponse.commitMessage) {
          throw new Error('Invalid JSON structure');
        }
        
        return jsonResponse;
      }

      // If no code block, try to find the first complete JSON object
      let braceCount = 0;
      let startIndex = -1;
      let endIndex = -1;

      for (let i = 0; i < generatedText.length; i++) {
        const char = generatedText[i];
        
        if (char === '{') {
          if (braceCount === 0) {
            startIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            endIndex = i;
            break;
          }
        }
      }

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = generatedText.substring(startIndex, endIndex + 1);
        const jsonResponse = JSON.parse(jsonString) as AICommitResponse;
        
        // Validate required fields
        if (!jsonResponse.analysis || !jsonResponse.commitMessage) {
          throw new Error('Invalid JSON structure');
        }
        
        return jsonResponse;
      }
      
      throw new Error('No valid JSON found in response');
    } catch (jsonError) {
      console.debug('[GenerateCommitMessage] JSON parsing failed:', jsonError);
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      throw new Error(`Failed to parse AI response as JSON: ${errorMessage}`);
    }
  }

  private buildCommitMessage(commitParts: CommitMessageParts): string {
    let message = commitParts.header;
    
    if (commitParts.body && commitParts.body.trim()) {
      message += '\n\n' + commitParts.body.trim();
    }
    
    if (commitParts.footer && commitParts.footer.trim()) {
      message += '\n\n' + commitParts.footer.trim();
    }
    
    return message;
  }

  private analyzeGitState(statusOutput: string, stagedDiff: string, unstagedDiff: string) {
    const lines = statusOutput.split('\n').filter(line => line.trim());
    const state = {
      hasStagedChanges: stagedDiff.trim() !== '',
      hasUnstagedChanges: unstagedDiff.trim() !== '',
      hasUntrackedFiles: statusOutput.includes('??'),
      hasDeletedFiles: lines.some(line => line.includes(' D ')),
      hasRenamedFiles: lines.some(line => line.includes(' R ')),
      hasConflicts: lines.some(line => line.includes('UU') || line.includes('AA')),
      modifiedFileCount: lines.filter(line => line.includes(' M ')).length,
      addedFileCount: lines.filter(line => line.includes('A ')).length,
      deletedFileCount: lines.filter(line => line.includes(' D ')).length,
      untrackedFileCount: lines.filter(line => line.includes('??')).length
    };
    
    return state;
  }

  private determineCommitStrategy(gitState: ReturnType<typeof this.analyzeGitState>): 'staged-only' | 'all-changes' {
    // If there are conflicts, we should not proceed with automatic staging
    if (gitState.hasConflicts) {
      throw new Error('Git conflicts detected. Please resolve conflicts before committing.');
    }

    // If there are staged changes, only commit what the user has staged.
    if (gitState.hasStagedChanges) {
      return 'staged-only';
    }

    // If only unstaged or untracked changes exist, stage all of them.
    if (gitState.hasUnstagedChanges || gitState.hasUntrackedFiles) {
      return 'all-changes';
    }

    // Default to staged-only if no changes are detected (will result in a "no changes" message later).
    return 'staged-only';
  }

  private async executeCommitStrategy(commitMode: 'staged-only' | 'all-changes', signal: AbortSignal): Promise<void> {
    if (commitMode === 'all-changes') {
      console.debug('[GenerateCommitMessage] Executing all-changes strategy: staging all files');
      await this.executeGitCommand(['add', '.'], signal);
    } else {
      console.debug('[GenerateCommitMessage] Executing staged-only strategy: committing staged files only');
      // No additional staging needed for staged-only
    }
  }

  private async isCacheValid(signal: AbortSignal): Promise<boolean> {
    if (!this.cachedCommitData) {
      return false;
    }

    try {
      // Check cache age (30 seconds max)
      const cacheAge = Date.now() - this.cachedCommitData.timestamp;
      if (cacheAge > 30000) {
        console.debug('[GenerateCommitMessage] Cache expired (age: %dms)', cacheAge);
        this.cachedCommitData = null;
        return false;
      }

      // Verify git index hasn't changed since confirmation to prevent race conditions
      const currentIndexHash = await this.getGitIndexHash(signal);
      if (currentIndexHash !== this.cachedCommitData.indexHash) {
        console.debug('[GenerateCommitMessage] Cache invalidated due to index change');
        this.cachedCommitData = null;
        throw new Error('Git index has changed since confirmation. Please run the command again to generate an accurate commit message.');
      }

      // Additional validation: verify working directory state hasn't changed significantly
      const currentStatus = await this.executeGitCommand(['status', '--porcelain'], signal);
      const currentStatusLines = (currentStatus || '').split('\n').filter(line => line.trim()).length;
      const cachedStatusLines = this.cachedCommitData.statusOutput.split('\n').filter(line => line.trim()).length;
      
      if (Math.abs(currentStatusLines - cachedStatusLines) > 0) {
        console.debug('[GenerateCommitMessage] Cache invalidated due to status change (lines: %d vs %d)', 
          currentStatusLines, cachedStatusLines);
        this.cachedCommitData = null;
        throw new Error('Working directory status has changed since confirmation. Please run the command again.');
      }

      return true;
    } catch (error) {
      console.debug('[GenerateCommitMessage] Cache validation failed:', error);
      this.cachedCommitData = null;
      throw error;
    }
  }

  private formatExecutionError(error: unknown): { message: string; originalError: Error | null } {
    if (error instanceof Error) {
      // Preserve original error for debugging
      const originalError = error;
      
      // Provide specific guidance based on error type
      if (error.message.includes('Git is not installed')) {
        return {
          message: 'Git is not installed or not found in your system PATH. Please install Git and ensure it\'s accessible from the command line.',
          originalError
        };
      } else if (error.message.includes('not a git repository')) {
        return {
          message: 'This directory is not a Git repository. Please navigate to a Git repository or run "git init" to initialize one.',
          originalError
        };
      } else if (error.message.includes('no changes added to commit')) {
        return {
          message: 'No changes have been staged for commit. Make some changes to your files first, or use "git add" to stage existing changes.',
          originalError
        };
      } else if (error.message.includes('nothing to commit')) {
        return {
          message: 'No changes detected in your working directory. Make some changes to your files before creating a commit.',
          originalError
        };
      } else if (error.message.includes('index.lock')) {
        return {
          message: 'Git index is locked by another process. Please wait for the other Git operation to complete and try again.',
          originalError
        };
      } else if (error.message.includes('Git index has changed')) {
        return {
          message: 'Changes were detected in your Git repository after confirmation. This prevents committing unexpected changes. Please run the command again.',
          originalError
        };
      } else if (error.message.includes('Failed to generate commit message')) {
        return {
          message: 'Unable to generate commit message using AI. Please check your internet connection and API configuration.',
          originalError
        };
      } else {
        return {
          message: `${error.message}`,
          originalError
        };
      }
    } else {
      return {
        message: `Unexpected error occurred: ${String(error)}`,
        originalError: null
      };
    }
  }
}
