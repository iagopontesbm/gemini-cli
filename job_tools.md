# Job and Task Management Tools: API and Best Practices

## 1. Introduction

This document outlines a powerful, hierarchical system for managing complex user requests through a structured "Job" and "Task" model. This API is designed for clarity, efficiency, and robustness, enabling the agent to plan, execute, and report on multi-step work in a transparent and organized manner.

A **Job** represents a high-level user request (e.g., "build a website"). A **Task** represents a single, concrete action required to complete a Job (e.g., "create the `index.html` file").

## 2. API Reference

### Job Management Tools

#### `job_create`

- **Description**: Creates a new, overarching Job and can optionally populate it with an initial set of tasks in a single batch operation. This should be the first step when receiving a complex request.
- **Parameters**:
  - `description` (string, required): The high-level description of the job.
  - `tasks` (array, optional): An array of task objects to create and associate with the job. Each task object must contain:
    - `content` (string, required): The description of the task.
    - `priority` (string, optional, default: `medium`): The task's priority (`high`, `medium`, `low`).
- **Returns**: An object containing the `job_id` of the new job and a list of the `task_id`s that were created.

#### `job_update`

- **Description**: Updates the properties of a specific Job and can optionally add a comment to its log. This is the primary tool for managing the overall status of a job.
- **Parameters**:
  - `job_id` (string, required): The identifier of the job to update.
  - `description` (string, optional): A new description for the job.
  - `status` (string, optional): The new overall status for the job (e.g., `in_progress`, `completed`, `paused`, `failed`).
  - `comment` (string, optional): A comment to append to the job's log.

#### `job_get_status`

- **Description**: Retrieves a status summary for a specific Job.
- **Parameters**:
  - `job_id` (string, required): The identifier of the job to query.
- **Returns**: An object detailing the job's progress.

### Task Management Tools

#### `task_create`

- **Description**: Creates a new Task and adds it to an _existing_ Job. Use this to add tasks that were not included in the initial `job_create` call.
- **Parameters**:
  - `job_id` (string, required): The identifier of the job to add the task to.
  - `content` (string, required): The description of the task.
  - `priority` (string, optional, default: `medium`): The task's priority.
- **Returns**: The unique `task_id` for the new task.

#### `job_get_tasks`

- **Description**: Retrieves a list of tasks for a given Job.
- **Parameters**:
  - `job_id` (string, required): The identifier of the job.
  - `status` (string, optional): Filter tasks by status (`pending`, `in_progress`, `completed`, `failed`). If omitted, returns all tasks.
- **Returns**: An array of task objects for the specified job.

#### `task_Update`

- **Description**: Modifies one or more properties of an existing task and adds a comment. This is the primary tool for managing the lifecycle of a task.
- **Parameters**:
  - `task_id` (string, required): The identifier of the task to update.
  - `content` (string, optional): The new task description.
  - `status` (string, optional): The new status (`pending`, `in_progress`, `completed`, `failed`).
  - `priority` (string, optional): The new priority.
  - `comment` (string, optional): A comment to append to the task's log. This is crucial for recording outcomes, errors, or other notes.

## 3. Best Practices & Workflow

1.  **Plan First**: When you receive a complex request, start by breaking it down into a series of concrete tasks.
2.  **Create Job and Tasks**: Use `job_create` to create the job and populate it with the tasks you identified. This batch creation is highly efficient.
3.  **Execute Sequentially**:
    - Use `job_get_tasks` to review the plan.
    - Select the highest-priority pending task.
    - Update its status with `task_update({ task_id: '...', status: 'in_progress' })`.
    - Perform the work.
4.  **Record Outcomes in a Single Step**:
    - **On Success**: Update the status and add any relevant notes in one call: `task_update({ task_id: '...', status: 'completed', comment: 'Successfully implemented and tested.' })`.
    - **On Failure**: Update the status and record the error in one call: `task_update({ task_id: '...', status: 'failed', comment: 'API call failed with 500 error: Internal Server Error.' })`. This is crucial for debugging.
5.  **Summarize**: After all tasks are complete, update the job's status and add a final summary using `job_update`.
6.  **Stay Focused**: Only one task should be `in_progress` at a time.

## 4. Example Workflow

**Scenario**: User asks you to "Refactor the authentication service."

1.  **Plan and Create**:
    ```
    job_create({
      description: "Refactor the authentication service",
      tasks: [
        { content: "Add unit tests for the current implementation", priority: "high" },
        { content: "Refactor the main service logic to a new module" },
        { content: "Update dependencies and remove unused code" },
        { content: "Run all tests to ensure no regressions", priority: "high" }
      ]
    })
    ```
2.  **Start the First Task**:
    - `task_update({ task_id: 'task-abc', status: 'in_progress' })`
3.  _(...do the work to add tests...)_
4.  **Complete and Comment on Task**:
    - `Task_update({ task_id: 'task-abc', status: 'completed', comment: 'Added 5 new unit tests covering all major functions.' })`
5.  **Handle a Failure**:
    - `Task_update({ task_id: 'task-def', status: 'in_progress' })`
    - _(...attempt to refactor, but it fails...)_
    - `Task_update({ task_id: 'task-def', status: 'failed', comment: 'Refactoring failed due to a circular dependency introduced in the new module. Will need to rethink the approach.' })`
6.  **Final Job Summary**:
    - `job_update({ job_id: 'job-123', status: 'completed', comment: 'Job completed with one failed task. The core refactoring could not be completed due to a circular dependency issue that needs further investigation.' })`
