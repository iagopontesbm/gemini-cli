/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

export interface UserTool {
  name: string;
  description: string;
  content: string;
  filePath: string;
  autoSubmit?: boolean;
}

/**
 * Load user tools from both global (~/.gemini/user-tools) and workspace directories
 * Workspace tools take precedence over global tools when names conflict
 */
export function loadMergedUserTools(workspaceDir: string): {
  globalTools: Map<string, UserTool>;
  workspaceTools: Map<string, UserTool>;
  mergedTools: Map<string, UserTool>;
  errors: Array<{ message: string; path: string }>;
} {
  const errors: Array<{ message: string; path: string }> = [];

  // Load global user tools
  let globalTools = new Map<string, UserTool>();
  try {
    const globalLoader = new UserToolsLoader(homedir());
    globalTools = globalLoader.loadUserTools();
  } catch (error: unknown) {
    errors.push({
      message: `Failed to load global user tools: ${error instanceof Error ? error.message : String(error)}`,
      path: path.join(homedir(), '.gemini', 'user-tools'),
    });
  }

  // Load workspace user tools
  let workspaceTools = new Map<string, UserTool>();
  try {
    const workspaceLoader = new UserToolsLoader(workspaceDir);
    workspaceTools = workspaceLoader.loadUserTools();
  } catch (error: unknown) {
    errors.push({
      message: `Failed to load workspace user tools: ${error instanceof Error ? error.message : String(error)}`,
      path: path.join(workspaceDir, '.gemini', 'user-tools'),
    });
  }

  // Merge tools with workspace taking precedence
  const mergedTools = new Map<string, UserTool>();
  for (const [name, tool] of globalTools) {
    mergedTools.set(name, tool);
  }
  for (const [name, tool] of workspaceTools) {
    mergedTools.set(name, tool);
  }

  return { globalTools, workspaceTools, mergedTools, errors };
}

export class UserToolsLoader {
  private userTools: Map<string, UserTool> = new Map();
  private userToolsDir: string;

  constructor(targetDir: string) {
    this.userToolsDir = path.join(targetDir, '.gemini', 'user-tools');
  }

  /**
   * Load all user tools from the .gemini/user-tools directory
   */
  loadUserTools(): Map<string, UserTool> {
    const tools = new Map<string, UserTool>();

    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.userToolsDir)) {
        try {
          fs.mkdirSync(this.userToolsDir, { recursive: true });
        } catch (mkdirError) {
          // In test environments or restricted environments, directory creation might fail
          console.debug('Failed to create user tools directory:', mkdirError);
        }
        return tools;
      }
    } catch (existsError) {
      console.debug('Failed to check user tools directory:', existsError);
      return tools;
    }

    try {
      const files = fs.readdirSync(this.userToolsDir);
      const mdFiles = files.filter((file) => file.endsWith('.md'));

      for (const file of mdFiles) {
        const filePath = path.join(this.userToolsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const toolName = path.basename(file, '.md');

          // Parse the markdown file to extract metadata
          const tool = this.parseUserTool(toolName, content, filePath);
          tools.set(toolName, tool);
        } catch (error) {
          console.error(`Error loading user tool ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error reading user tools directory:', error);
    }

    return tools;
  }

  /**
   * Parse a user tool markdown file
   *
   * Expected frontmatter format:
   * ---
   * description: Brief description of what the tool does
   * autoSubmit: true or false (optional, defaults to false)
   * ---
   */
  private parseUserTool(
    name: string,
    content: string,
    filePath: string,
  ): UserTool {
    const lines = content.split('\n');
    let description = `User-defined tool: ${name}`;
    let autoSubmit = false;
    let contentStartIndex = 0;

    // Parse frontmatter if present
    if (lines[0].trim() === '---') {
      let inFrontmatter = true;
      let i = 1;
      while (i < lines.length && inFrontmatter) {
        const trimmedLine = lines[i].trim();

        if (trimmedLine === '---') {
          inFrontmatter = false;
          contentStartIndex = i + 1;
        } else if (trimmedLine) {
          // Skip empty lines in frontmatter
          const colonIndex = trimmedLine.indexOf(':');
          if (colonIndex === -1) {
            // Skip malformed lines
            console.debug(
              `Skipping malformed frontmatter line: "${trimmedLine}"`,
            );
            i++;
            continue;
          }

          const key = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();

          if (key === 'description') {
            description = value;
          } else if (key === 'autoSubmit') {
            autoSubmit = value.toLowerCase() === 'true';
          }
        }
        i++;
      }
    }

    const actualContent = lines.slice(contentStartIndex).join('\n').trim();

    return {
      name,
      description,
      content: actualContent,
      filePath,
      autoSubmit,
    };
  }

  /**
   * Get a specific user tool by name
   */
  getUserTool(name: string): UserTool | undefined {
    return this.userTools.get(name);
  }

  /**
   * Get all loaded user tools
   */
  getAllUserTools(): UserTool[] {
    return Array.from(this.userTools.values());
  }

  /**
   * Reload user tools from disk
   */
  reloadUserTools(): Map<string, UserTool> {
    return this.loadUserTools();
  }
}
