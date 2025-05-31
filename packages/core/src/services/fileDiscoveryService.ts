/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitIgnoreParser, GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'path';

export interface FileDiscoveryOptions {
  respectGitIgnore?: boolean;
  includeBuildArtifacts?: boolean;
  customIgnorePatterns?: string[];
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private projectRoot: string;
  private isGitRepo: boolean = false;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  async initialize(options: FileDiscoveryOptions = {}): Promise<void> {
    this.isGitRepo = isGitRepository(this.projectRoot);
    
    if (options.respectGitIgnore !== false && this.isGitRepo) {
      const parser = new GitIgnoreParser(this.projectRoot);
      await parser.initialize();
      this.gitIgnoreFilter = parser;
    }
  }

  /**
   * Filters a list of file paths based on git ignore rules and options
   */
  filterFiles(filePaths: string[], options: FileDiscoveryOptions = {}): string[] {
    return filePaths.filter(filePath => {
      // Always respect git ignore unless explicitly disabled
      if (options.respectGitIgnore !== false && this.gitIgnoreFilter) {
        if (this.gitIgnoreFilter.isIgnored(filePath)) {
          return false;
        }
      }

      // Apply custom ignore patterns
      if (options.customIgnorePatterns) {
        const relativePath = path.relative(this.projectRoot, filePath);
        for (const pattern of options.customIgnorePatterns) {
          // Check if the path starts with the pattern (for directory matching)
          // or if any directory component matches the pattern
          const pathParts = relativePath.split(path.sep);
          if (relativePath.startsWith(pattern + '/') || 
              relativePath === pattern || 
              pathParts.some(part => part === pattern)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Gets patterns that would be ignored for debugging/transparency
   */
  getIgnoreInfo(): { gitIgnored: string[], customIgnored: string[] } {
    return {
      gitIgnored: this.gitIgnoreFilter?.getIgnoredPatterns() || [],
      customIgnored: [], // Can be extended later
    };
  }

  /**
   * Checks if a single file should be ignored
   */
  shouldIgnoreFile(filePath: string, options: FileDiscoveryOptions = {}): boolean {
    if (options.respectGitIgnore !== false && this.isGitRepo && this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Returns whether the project is a git repository
   */
  isGitRepository(): boolean {
    return this.isGitRepo;
  }
}