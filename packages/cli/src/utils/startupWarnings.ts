/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join as pathJoin } from 'node:path';
import { getErrorMessage } from '@gemini-code/core';
import * as path from 'path';

const warningsFilePath = pathJoin(tmpdir(), 'gemini-code-cli-warnings.txt');

interface Job {
    id: string;
    description: string;
    status: 'in_progress' | 'completed' | 'paused' | 'failed';
    tasks: Task[];
    comments: string[];
    createdAt: string;
}

interface Task {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: 'high' | 'medium' | 'low';
    comments: string[];
    createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _checkIncompleteJobs(): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const jobsFilePath = path.join(homedir(), '.gemini', 'jobs.json');
    const data = await fs.readFile(jobsFilePath, 'utf-8');
    const jobs = JSON.parse(data) as Job[];
    
    // Filter incomplete jobs
    const incompleteJobs = jobs.filter(job => job.status === 'in_progress' || job.status === 'paused');
    
    if (incompleteJobs.length > 0) {
      warnings.push(`You have ${incompleteJobs.length} incomplete job${incompleteJobs.length > 1 ? 's' : ''}:`);
      incompleteJobs.forEach(job => {
        const incompleteTasks = job.tasks.filter(task => 
          task.status === 'pending' || task.status === 'in_progress'
        ).length;
        warnings.push(`  - Job "${job.description}" (${job.status}) with ${incompleteTasks} incomplete task${incompleteTasks !== 1 ? 's' : ''}`);
      });
      warnings.push('Ask me to show your jobs or check the status of a specific job.');
    }
  } catch (err: unknown) {
    // If file doesn't exist or there's an error reading it, silently ignore
    // as the user may not have created any jobs yet
    if (err instanceof Error && 'code' in err && err.code !== 'ENOENT') {
      // Only log non-ENOENT errors
      console.error('Error checking jobs:', getErrorMessage(err));
    }
  }
  return warnings;
}

export async function getStartupWarnings(): Promise<string[]> {
  const warnings: string[] = [];
  
  // Check for system warnings file
  try {
    await fs.access(warningsFilePath); // Check if file exists
    const warningsContent = await fs.readFile(warningsFilePath, 'utf-8');
    const fileWarnings = warningsContent
      .split('\n')
      .filter((line) => line.trim() !== '');
    warnings.push(...fileWarnings);
    try {
      await fs.unlink(warningsFilePath);
    } catch {
      warnings.push('Warning: Could not delete temporary warnings file.');
    }
  } catch (err: unknown) {
    // If fs.access throws, it means the file doesn't exist or is not accessible.
    // This is not an error in the context of fetching warnings, so return empty.
    // Only return an error message if it's not a "file not found" type error.
    // However, the original logic returned an error message for any fs.existsSync failure.
    // To maintain closer parity while making it async, we'll check the error code.
    // ENOENT is "Error NO ENTry" (file not found).
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      // File not found, no warnings to return.
    } else {
      // For other errors (permissions, etc.), return the error message.
      warnings.push(`Error checking/reading warnings file: ${getErrorMessage(err)}`);
    }
  }
  
  // Check for incomplete jobs - disabled as we now use /jobs command
  // const jobWarnings = await checkIncompleteJobs();
  // warnings.push(...jobWarnings);
  
  return warnings;
}
