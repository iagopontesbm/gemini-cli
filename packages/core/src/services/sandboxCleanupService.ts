/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileDiscoveryService } from './fileDiscoveryService.js';
import fg from 'fast-glob';

export interface CleanupOptions {
  dryRun?: boolean;
  preservePatterns?: string[];
  aggressiveCleanup?: boolean;
}

export interface CleanupResult {
  removedFiles: string[];
  preservedFiles: string[];
  errors: Array<{ file: string; error: string }>;
  dryRun: boolean;
}

export class SandboxCleanupService {
  private fileDiscovery: FileDiscoveryService | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  async initialize(): Promise<void> {
    this.fileDiscovery = new FileDiscoveryService(this.projectRoot);
    await this.fileDiscovery.initialize();
  }

  /**
   * Identifies files that should be removed from sandbox
   * (git-ignored files that aren't backed by version control)
   */
  async identifyFilesToClean(options: CleanupOptions = {}): Promise<string[]> {
    const allFiles = await fg(['**/*'], {
      cwd: this.projectRoot,
      absolute: true,
      onlyFiles: true,
      dot: true,
      ignore: ['.git/**'], // Never touch .git directory
    });

    const filesToRemove: string[] = [];

    for (const file of allFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      
      // Check if file is git-ignored
      if (this.fileDiscovery && this.fileDiscovery.shouldIgnoreFile(relativePath)) {
        // Additional safety checks
        if (await this.isSafeToRemove(file, options)) {
          filesToRemove.push(file);
        }
      }
    }

    return filesToRemove;
  }

  /**
   * Performs the actual cleanup
   */
  async cleanupSandbox(options: CleanupOptions = {}): Promise<CleanupResult> {
    const filesToRemove = await this.identifyFilesToClean(options);
    const result: CleanupResult = {
      removedFiles: [],
      preservedFiles: [],
      errors: [],
      dryRun: options.dryRun ?? false,
    };

    for (const file of filesToRemove) {
      try {
        if (options.dryRun) {
          result.removedFiles.push(file);
        } else {
          await fs.unlink(file);
          result.removedFiles.push(file);
          
          // Clean up empty directories
          await this.cleanupEmptyDirectories(path.dirname(file));
        }
      } catch (error) {
        result.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  private async isSafeToRemove(file: string, options: CleanupOptions): Promise<boolean> {
    const relativePath = path.relative(this.projectRoot, file);

    // Preserve patterns (for user-specified important files)
    if (options.preservePatterns) {
      for (const pattern of options.preservePatterns) {
        if (relativePath.includes(pattern)) {
          return false;
        }
      }
    }

    // Always preserve certain critical files even if git-ignored
    const criticalPatterns = [
      '.env.example',
      '.env.template',
      'README',
      'LICENSE',
      'CHANGELOG',
    ];

    if (!options.aggressiveCleanup) {
      for (const pattern of criticalPatterns) {
        if (relativePath.toLowerCase().includes(pattern.toLowerCase())) {
          return false;
        }
      }
    }

    return true;
  }

  private async cleanupEmptyDirectories(dir: string): Promise<void> {
    try {
      if (dir === this.projectRoot) return;
      
      const entries = await fs.readdir(dir);
      if (entries.length === 0) {
        await fs.rmdir(dir);
        // Recursively clean parent if it becomes empty
        await this.cleanupEmptyDirectories(path.dirname(dir));
      }
    } catch {
      // Ignore errors for directory cleanup
    }
  }
}