/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';

const JOB_TOOLS_DIR = '.gemini';
const JOBS_FILENAME = 'jobs.json';

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

interface JobCreateParams {
    description: string;
    tasks?: { content: string, priority?: 'high' | 'medium' | 'low' }[];
}

interface JobUpdateParams {
    job_id: string;
    description?: string;
    status?: 'in_progress' | 'completed' | 'paused' | 'failed';
    comment?: string;
}

interface JobGetStatusParams {
    job_id: string;
}

interface TaskCreateParams {
    job_id: string;
    content: string;
    priority?: 'high' | 'medium' | 'low';
}

interface JobGetTasksParams {
    job_id: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface TaskUpdateParams {
    task_id: string;
    content?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority?: 'high' | 'medium' | 'low';
    comment?: string;
}


function getJobsFilePath(): string {
    return path.join(homedir(), JOB_TOOLS_DIR, JOBS_FILENAME);
}

async function readJobs(): Promise<Job[]> {
    try {
        const filePath = getJobsFilePath();
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Job[];
    } catch (error) {
        // If the file doesn't exist, return an empty array.
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

async function writeJobs(jobs: Job[]): Promise<void> {
    const filePath = getJobsFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(jobs, null, 2), 'utf-8');
}

async function purgeOldJobs(jobs: Job[]): Promise<Job[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return jobs.filter(job => new Date(job.createdAt) >= thirtyDaysAgo);
}

export class JobCreateTool extends BaseTool<JobCreateParams, ToolResult> {
    static readonly Name = 'JobCreate';

    constructor() {
        super(
            JobCreateTool.Name,
            'Create Job',
            'Creates a new job and optionally populates it with an initial set of tasks.',
            {
                type: 'object',
                properties: {
                    description: {
                        type: 'string',
                        description: 'The high-level description of the job.',
                    },
                    tasks: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                content: {
                                    type: 'string',
                                    description: 'The description of the task.',
                                },
                                priority: {
                                    type: 'string',
                                    enum: ['high', 'medium', 'low'],
                                    description: 'The priority of the task.',
                                },
                            },
                            required: ['content'],
                        },
                    },
                },
                required: ['description'],
            }
        );
    }

    async execute(params: JobCreateParams): Promise<ToolResult> {
        try {
            let jobs = await readJobs();
            jobs = await purgeOldJobs(jobs);

            const newJob: Job = {
                id: `job-${uuidv4()}`,
                description: params.description,
                status: 'in_progress',
                tasks: [],
                comments: [],
                createdAt: new Date().toISOString(),
            };

            const task_ids: string[] = [];

            if (params.tasks) {
                for (const task of params.tasks) {
                    const newTaskId = `task-${uuidv4()}`;
                    newJob.tasks.push({
                        id: newTaskId,
                        content: task.content,
                        status: 'pending',
                        priority: task.priority || 'medium',
                        comments: [],
                        createdAt: new Date().toISOString(),
                    });
                    task_ids.push(newTaskId);
                }
            }

            jobs.push(newJob);
            await writeJobs(jobs);

            return {
                llmContent: JSON.stringify({ job_id: newJob.id, task_ids }),
                returnDisplay: `Created new job "${newJob.description}" with ID: ${newJob.id}`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error creating job: ${errorMessage}`,
            };
        }
    }
}

export class JobUpdateTool extends BaseTool<JobUpdateParams, ToolResult> {
    static readonly Name = 'JobUpdate';

    constructor() {
        super(
            JobUpdateTool.Name,
            'Update Job',
            'Updates the properties of a specific Job and can optionally add a comment to its log.',
            {
                type: 'object',
                properties: {
                    job_id: {
                        type: 'string',
                        description: 'The identifier of the job to update.',
                    },
                    description: {
                        type: 'string',
                        description: 'A new description for the job.',
                    },
                    status: {
                        type: 'string',
                        enum: ['in_progress', 'completed', 'paused', 'failed'],
                        description: 'The new overall status for the job.',
                    },
                    comment: {
                        type: 'string',
                        description: 'A comment to append to the job\'s log.',
                    },
                },
                required: ['job_id'],
            }
        );
    }

    async execute(params: JobUpdateParams): Promise<ToolResult> {
        try {
            const jobs = await readJobs();
            const job = jobs.find(j => j.id === params.job_id);

            if (!job) {
                throw new Error(`Job with ID "${params.job_id}" not found.`);
            }

            if (params.description) {
                job.description = params.description;
            }
            if (params.status) {
                job.status = params.status;
            }
            if (params.comment) {
                job.comments.push(params.comment);
            }

            await writeJobs(jobs);

            return {
                llmContent: JSON.stringify({ success: true, job_id: job.id }),
                returnDisplay: `Successfully updated job "${job.description}".`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error updating job: ${errorMessage}`,
            };
        }
    }
}

export class JobGetStatusTool extends BaseTool<JobGetStatusParams, ToolResult> {
    static readonly Name = 'JobGetStatus';

    constructor() {
        super(
            JobGetStatusTool.Name,
            'Get Job Status',
            'Retrieves a status summary for a specific Job.',
            {
                type: 'object',
                properties: {
                    job_id: {
                        type: 'string',
                        description: 'The identifier of the job to query.',
                    },
                },
                required: ['job_id'],
            }
        );
    }

    async execute(params: JobGetStatusParams): Promise<ToolResult> {
        try {
            const jobs = await readJobs();
            const job = jobs.find(j => j.id === params.job_id);

            if (!job) {
                throw new Error(`Job with ID "${params.job_id}" not found.`);
            }
            
            const status = {
                job_id: job.id,
                description: job.description,
                status: job.status,
                tasks: {
                    total: job.tasks.length,
                    completed: job.tasks.filter(t => t.status === 'completed').length,
                    in_progress: job.tasks.filter(t => t.status === 'in_progress').length,
                    pending: job.tasks.filter(t => t.status === 'pending').length,
                    failed: job.tasks.filter(t => t.status === 'failed').length,
                }
            };

            return {
                llmContent: JSON.stringify(status),
                returnDisplay: JSON.stringify(status, null, 2),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error getting job status: ${errorMessage}`,
            };
        }
    }
}

export class TaskCreateTool extends BaseTool<TaskCreateParams, ToolResult> {
    static readonly Name = 'TaskCreate';

    constructor() {
        super(
            TaskCreateTool.Name,
            'Create Task',
            'Creates a new Task and adds it to an existing Job.',
            {
                type: 'object',
                properties: {
                    job_id: {
                        type: 'string',
                        description: 'The identifier of the job to add the task to.',
                    },
                    content: {
                        type: 'string',
                        description: 'The description of the task.',
                    },
                    priority: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'The priority of the task.',
                    },
                },
                required: ['job_id', 'content'],
            }
        );
    }

    async execute(params: TaskCreateParams): Promise<ToolResult> {
        try {
            const jobs = await readJobs();
            const job = jobs.find(j => j.id === params.job_id);

            if (!job) {
                throw new Error(`Job with ID "${params.job_id}" not found.`);
            }

            const newTaskId = `task-${uuidv4()}`;
            job.tasks.push({
                id: newTaskId,
                content: params.content,
                status: 'pending',
                priority: params.priority || 'medium',
                comments: [],
                createdAt: new Date().toISOString(),
            });

            await writeJobs(jobs);

            return {
                llmContent: JSON.stringify({ success: true, task_id: newTaskId }),
                returnDisplay: `Successfully created new task with ID: ${newTaskId}`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error creating task: ${errorMessage}`,
            };
        }
    }
}

export class JobGetTasksTool extends BaseTool<JobGetTasksParams, ToolResult> {
    static readonly Name = 'JobGetTasks';

    constructor() {
        super(
            JobGetTasksTool.Name,
            'Get Job Tasks',
            'Retrieves a list of tasks for a given Job.',
            {
                type: 'object',
                properties: {
                    job_id: {
                        type: 'string',
                        description: 'The identifier of the job.',
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'failed'],
                        description: 'Filter tasks by status.',
                    },
                },
                required: ['job_id'],
            }
        );
    }

    async execute(params: JobGetTasksParams): Promise<ToolResult> {
        try {
            const jobs = await readJobs();
            const job = jobs.find(j => j.id === params.job_id);

            if (!job) {
                throw new Error(`Job with ID "${params.job_id}" not found.`);
            }

            let tasks = job.tasks;
            if (params.status) {
                tasks = tasks.filter(t => t.status === params.status);
            }

            return {
                llmContent: JSON.stringify(tasks),
                returnDisplay: JSON.stringify(tasks, null, 2),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error getting tasks: ${errorMessage}`,
            };
        }
    }
}

export class TaskUpdateTool extends BaseTool<TaskUpdateParams, ToolResult> {
    static readonly Name = 'TaskUpdate';

    constructor() {
        super(
            TaskUpdateTool.Name,
            'Update Task',
            'Modifies one or more properties of an existing task and optionally adds a comment.',
            {
                type: 'object',
                properties: {
                    task_id: {
                        type: 'string',
                        description: 'The identifier of the task to update.',
                    },
                    content: {
                        type: 'string',
                        description: 'The new task description.',
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'failed'],
                        description: 'The new status.',
                    },
                    priority: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'The new priority.',
                    },
                    comment: {
                        type: 'string',
                        description: 'A comment to append to the task\'s log.',
                    },
                },
                required: ['task_id'],
            }
        );
    }

    async execute(params: TaskUpdateParams): Promise<ToolResult> {
        try {
            const jobs = await readJobs();
            const task = jobs.flatMap(j => j.tasks).find(t => t.id === params.task_id);

            if (!task) {
                throw new Error(`Task with ID "${params.task_id}" not found.`);
            }

            if (params.content) {
                task.content = params.content;
            }
            if (params.status) {
                task.status = params.status;
            }
            if (params.priority) {
                task.priority = params.priority;
            }
            if (params.comment) {
                task.comments.push(params.comment);
            }

            await writeJobs(jobs);

            return {
                llmContent: JSON.stringify({ success: true, task_id: task.id }),
                returnDisplay: `Successfully updated task "${task.content}".`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                llmContent: JSON.stringify({ success: false, error: errorMessage }),
                returnDisplay: `Error updating task: ${errorMessage}`,
            };
        }
    }
}