/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { BaseTool, ToolResult } from './tools.js';
import memoryToolSchemaData from './memoryTool.json' with { type: 'json' };

const GEMINI_CONFIG_DIR = '.gemini';
const GEMINI_MD_FILENAME = 'GEMINI.md';
const MEMORY_SECTION_HEADER = '## Gemini Added Memories';

interface SaveMemoryParams {
  fact: string;
}

function getGlobalMemoryFilePath(): string {
  return path.join(homedir(), GEMINI_CONFIG_DIR, GEMINI_MD_FILENAME);
}

/**
 * Ensures proper newline separation before appending content.
 */
function ensureNewlineSeparation(currentContent: string): string {
  if (currentContent.length === 0) return '';
  if (currentContent.endsWith('\n\n') || currentContent.endsWith('\r\n\r\n'))
    return '';
  if (currentContent.endsWith('\n') || currentContent.endsWith('\r\n'))
    return '\n';
  return '\n\n';
}

async function addEntryToGlobalMemory(text: string): Promise<void> {
  const filePath = getGlobalMemoryFilePath();
  const newMemoryItem = `- ${text.trim()}`;

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (_e) {
      // File doesn't exist, will be created.
    }

    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);

    if (headerIndex === -1) {
      const separator = ensureNewlineSeparation(content);
      content += `${separator}${MEMORY_SECTION_HEADER}\n${newMemoryItem}\n`;
    } else {
      const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
      let endOfSectionIndex = content.indexOf('\n## ', startOfSectionContent);
      if (endOfSectionIndex === -1) {
        endOfSectionIndex = content.length;
      }
      const beforeSectionMarker = content
        .substring(0, startOfSectionContent)
        .trimEnd();
      let sectionContent = content
        .substring(startOfSectionContent, endOfSectionIndex)
        .trimEnd();
      const afterSectionMarker = content.substring(endOfSectionIndex);

      sectionContent += `\n${newMemoryItem}`;
      content =
        `${beforeSectionMarker}\n${sectionContent.trimStart()}\n${afterSectionMarker}`.trimEnd() +
        '\n';
    }
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(
      `[MemoryTool] Error adding memory entry to ${filePath}:`,
      error,
    );
    throw new Error(
      `[MemoryTool] Failed to add memory entry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export class MemoryTool extends BaseTool<SaveMemoryParams, ToolResult> {
  constructor() {
    super(
      memoryToolSchemaData.name,
      'Save Memory', // displayName
      memoryToolSchemaData.description,
      memoryToolSchemaData.parameters as Record<string, unknown>,
    );
  }

  // Optional: Override validateToolParams if specific validation is needed beyond JSON schema
  // validateToolParams(params: SaveMemoryParams): string | null {
  //   if (!params.fact || typeof params.fact !== 'string' || params.fact.trim() === '') {
  //     return 'Parameter "fact" must be a non-empty string.';
  //   }
  //   return null; // All good
  // }

  // Optional: Override getDescription for a custom pre-execution message
  // getDescription(params: SaveMemoryParams): string {
  //   return `Will attempt to save the fact: "${params.fact}" to long-term memory.`;
  // }

  async execute(
    params: SaveMemoryParams,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    const { fact } = params;

    // Validation can be done here or rely on BaseTool's schema validation if it's implemented
    // For now, direct check, though schema should handle 'required'.
    if (!fact || typeof fact !== 'string' || fact.trim() === '') {
      const errorMessage = 'Parameter "fact" must be a non-empty string.';
      return {
        llmContent: JSON.stringify({ success: false, error: errorMessage }),
        returnDisplay: `Error: ${errorMessage}`,
      };
    }

    try {
      await addEntryToGlobalMemory(fact);
      const successMessage = `Okay, I've remembered that: "${fact}"`;
      return {
        llmContent: JSON.stringify({ success: true, message: successMessage }),
        returnDisplay: successMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[MemoryTool] Error executing saveMemory for fact "${fact}": ${errorMessage}`,
      );
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to save memory. Detail: ${errorMessage}`,
        }),
        returnDisplay: `Error saving memory: ${errorMessage}`,
      };
    }
  }
}
