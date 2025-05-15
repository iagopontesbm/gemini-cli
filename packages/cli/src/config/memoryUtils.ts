/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

const GEMINI_CONFIG_DIR = '.gemini';
const GEMINI_MD_FILENAME = 'GEMINI.md';
const MEMORY_SECTION_HEADER = '## Gemini Added Memories';

/**
 * Gets the absolute path to the global GEMINI.md file.
 */
export function getGlobalMemoryFilePath(): string {
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

/**
 * Adds a new memory entry to the global GEMINI.md file under the specified header.
 */
export async function addMemoryEntry(text: string): Promise<void> {
  const filePath = getGlobalMemoryFilePath();
  const newMemoryItem = `- ${text.trim()}`;

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let content = '';
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (_e) {
      // File doesn't exist, will be created with header and item.
    }

    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);

    if (headerIndex === -1) {
      // Header not found, append header and then the entry
      const separator = ensureNewlineSeparation(content);
      content += `${separator}${MEMORY_SECTION_HEADER}\n${newMemoryItem}\n`;
    } else {
      // Header found, find where to insert the new memory entry
      const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
      let endOfSectionIndex = content.indexOf('\n## ', startOfSectionContent);
      if (endOfSectionIndex === -1) {
        endOfSectionIndex = content.length; // End of file
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
    console.error(`Error adding memory entry to ${filePath}:`, error);
    throw new Error(
      `Failed to add memory entry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Deletes the last added memory entry from the "Gemini Added Memories" section.
 */
export async function deleteLastMemoryEntry(): Promise<boolean> {
  const filePath = getGlobalMemoryFilePath();
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);

    if (headerIndex === -1) return false; // Section not found

    const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
    let endOfSectionIndex = content.indexOf('\n## ', startOfSectionContent);
    if (endOfSectionIndex === -1) {
      endOfSectionIndex = content.length;
    }

    const sectionPart = content.substring(
      startOfSectionContent,
      endOfSectionIndex,
    );
    const lines = sectionPart.split(/\r?\n/).map((line) => line.trimEnd());

    let lastBulletLineIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('- ')) {
        lastBulletLineIndex = i;
        break;
      }
    }

    if (lastBulletLineIndex === -1) return false; // No bullets found in section

    lines.splice(lastBulletLineIndex, 1);

    const newSectionPart = lines
      .filter((line) => line.trim().length > 0)
      .join('\n');

    const beforeHeader = content.substring(0, headerIndex);
    const afterSection = content.substring(endOfSectionIndex);

    if (newSectionPart.trim().length === 0) {
      // If section is now empty (no bullets), remove header too or leave it clean
      // For simplicity, let's leave the header but ensure it has a newline after if content follows
      content = `${beforeHeader}${MEMORY_SECTION_HEADER}\n${afterSection}`
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();
      if (content.length > 0) content += '\n';
    } else {
      content =
        `${beforeHeader}${MEMORY_SECTION_HEADER}\n${newSectionPart}\n${afterSection}`
          .replace(/\n{3,}/g, '\n\n')
          .trimEnd();
      if (content.length > 0) content += '\n';
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    console.error(`Error deleting last memory entry from ${filePath}:`, error);
    throw new Error(
      `Failed to delete last memory entry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Deletes all added memory entries (the entire "Gemini Added Memories" section).
 */
export async function deleteAllAddedMemoryEntries(): Promise<number> {
  const filePath = getGlobalMemoryFilePath();
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);

    if (headerIndex === -1) return 0; // Section not found

    let endOfSectionIndex = content.indexOf(
      '\n## ',
      headerIndex + MEMORY_SECTION_HEADER.length,
    );
    if (endOfSectionIndex === -1) {
      endOfSectionIndex = content.length; // Section goes to EOF
    }

    const sectionContent = content.substring(headerIndex, endOfSectionIndex);
    const bulletCount = (sectionContent.match(/\n- /g) || []).length;

    if (bulletCount === 0 && !sectionContent.includes('- ')) {
      // No bullets found
      // If we only remove if bullets exist, or remove header if no bullets.
      // For now, if header exists but no bullets, consider 0 deleted if we only count bullets.
      // If the goal is to remove the section if it exists, this logic changes.
      // Let's assume we only care about bulleted items for the count.
    }

    // Remove the section including the header
    const beforeHeader = content.substring(0, headerIndex);
    const afterSection = content.substring(endOfSectionIndex);

    content = (
      beforeHeader.trimEnd() +
      (afterSection.length > 0 ? '\n' + afterSection.trimStart() : '')
    ).trim();
    if (content.length > 0) content += '\n';

    await fs.writeFile(filePath, content, 'utf-8');
    return bulletCount; // This counts '\n- ' occurrences, might need refinement for exact bullet count
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return 0;
    }
    console.error(
      `Error deleting all added memory entries from ${filePath}:`,
      error,
    );
    throw new Error(
      `Failed to delete all added memory entries: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
