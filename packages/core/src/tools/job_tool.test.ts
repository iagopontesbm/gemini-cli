/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  JobCreateTool,
  JobUpdateTool,
  JobGetStatusTool,
  TaskCreateTool,
  JobGetTasksTool,
  TaskUpdateTool,
} from './job_tool.js';
import { homedir } from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { describe, it, expect, beforeEach } from 'vitest';

const JOB_TOOLS_DIR = '.gemini';
const JOBS_FILENAME = 'jobs.json';
const jobsFilePath = path.join(homedir(), JOB_TOOLS_DIR, JOBS_FILENAME);

describe('Job Tools', () => {
  beforeEach(async () => {
    // Clear the jobs file before each test
    try {
      await fs.unlink(jobsFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  });

  it('should create a new job with tasks', async () => {
    const jobCreateTool = new JobCreateTool();
    const result = await jobCreateTool.execute({
      description: 'Test job with tasks',
      tasks: [{ content: 'Task 1' }, { content: 'Task 2', priority: 'high' }],
    });
    const { llmContent } = result;
    const { job_id, task_ids } = JSON.parse(llmContent as string);
    expect(job_id).toBeDefined();
    expect(task_ids).toHaveLength(2);
  });

  it('should update a job', async () => {
    const jobCreateTool = new JobCreateTool();
    const createResult = await jobCreateTool.execute({
      description: 'Job to update',
    });
    const { job_id } = JSON.parse(createResult.llmContent as string);

    const jobUpdateTool = new JobUpdateTool();
    await jobUpdateTool.execute({
      job_id,
      description: 'Updated job description',
      status: 'completed',
      comment: 'This job is done.',
    });

    const jobGetStatusTool = new JobGetStatusTool();
    const statusResult = await jobGetStatusTool.execute({ job_id });
    const status = JSON.parse(statusResult.llmContent as string);

    expect(status.description).toBe('Updated job description');
    expect(status.status).toBe('completed');
  });

  it('should get job status', async () => {
    const jobCreateTool = new JobCreateTool();
    const createResult = await jobCreateTool.execute({
      description: 'Job to get status',
    });
    const { job_id } = JSON.parse(createResult.llmContent as string);

    const jobGetStatusTool = new JobGetStatusTool();
    const statusResult = await jobGetStatusTool.execute({ job_id });
    const status = JSON.parse(statusResult.llmContent as string);

    expect(status.job_id).toBe(job_id);
    expect(status.description).toBe('Job to get status');
  });

  it('should create a task', async () => {
    const jobCreateTool = new JobCreateTool();
    const createResult = await jobCreateTool.execute({
      description: 'Job for task',
    });
    const { job_id } = JSON.parse(createResult.llmContent as string);

    const taskCreateTool = new TaskCreateTool();
    const taskResult = await taskCreateTool.execute({
      job_id,
      content: 'New task',
    });
    const { task_id } = JSON.parse(taskResult.llmContent as string);
    expect(task_id).toBeDefined();
  });

  it('should get tasks', async () => {
    const jobCreateTool = new JobCreateTool();
    const createResult = await jobCreateTool.execute({
      description: 'Job to get tasks',
      tasks: [{ content: 'Task 1' }],
    });
    const { job_id } = JSON.parse(createResult.llmContent as string);

    const jobGetTasksTool = new JobGetTasksTool();
    const tasksResult = await jobGetTasksTool.execute({ job_id });
    const tasks = JSON.parse(tasksResult.llmContent as string);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].content).toBe('Task 1');
  });

  it('should update a task', async () => {
    const jobCreateTool = new JobCreateTool();
    const createResult = await jobCreateTool.execute({
      description: 'Job to update task',
      tasks: [{ content: 'Task to update' }],
    });
    const { job_id, task_ids } = JSON.parse(createResult.llmContent as string);
    const task_id = task_ids[0];

    const taskUpdateTool = new TaskUpdateTool();
    await taskUpdateTool.execute({
      task_id,
      content: 'Updated task content',
      status: 'completed',
    });

    const jobGetTasksTool = new JobGetTasksTool();
    const tasksResult = await jobGetTasksTool.execute({ job_id });
    const tasks = JSON.parse(tasksResult.llmContent as string);
    expect(tasks[0].content).toBe('Updated task content');
    expect(tasks[0].status).toBe('completed');
  });
});
