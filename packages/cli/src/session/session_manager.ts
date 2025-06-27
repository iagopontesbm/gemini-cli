// Content from the typescript block above
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const SESSION_FILE_NAME = '.gemini-session.json';

export interface SessionData {
  version: string;
  currentSpecFile: string;
  currentTasksFile: string;
  lastModified: string;
  // activeTask?: string; // Example for future: if a task execution was interrupted
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const sessionFilePath = path.join(process.cwd(), SESSION_FILE_NAME);
    const fileContent = await fs.readFile(sessionFilePath, 'utf-8');
    const sessionData = JSON.parse(fileContent) as SessionData;
    // TODO: Add version check and potential migration logic if session format changes
    return sessionData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // No session file found, which is normal
    }
    console.error(`Error loading session file (${SESSION_FILE_NAME}):`, error);
    return null; // Or throw, depending on desired strictness
  }
}

export async function saveSession(
  specFilePath: string = 'spec.md',
  tasksFilePath: string = 'tasks.json'
): Promise<SessionData> {
  const sessionFilePath = path.join(process.cwd(), SESSION_FILE_NAME);
  const sessionData: SessionData = {
    version: '1.0',
    currentSpecFile: path.basename(specFilePath), // Store relative path or just name
    currentTasksFile: path.basename(tasksFilePath),
    lastModified: new Date().toISOString(),
  };

  try {
    await fs.writeFile(sessionFilePath, JSON.stringify(sessionData, null, 2));
    console.log(`Session state saved to ${SESSION_FILE_NAME}`);
    return sessionData;
  } catch (error) {
    console.error(`Error saving session file (${SESSION_FILE_NAME}):`, error);
    throw error; // Re-throw to make calling function aware
  }
}

// Task progress will be managed by directly updating tasks.json.
// This session manager primarily tracks which files are active.
// A function to update tasks.json might look like this (simplified):

/*
// This is more for when task execution is implemented
// Assuming Task, Epic, TasksFile types are accessible, e.g., from a shared types file or imported from tasks_command.ts
// For example: import { Task, Epic, TasksFile } from '../commands/tasks_command';

export async function updateTaskStatusInFile(
  taskIdToUpdate: string, // This needs a way to uniquely identify tasks, e.g. "EpicTitle:TaskTitle" or generated IDs
  newStatus: 'pending' | 'in progress' | 'done',
  tasksFilePath?: string
): Promise<boolean> {
  const session = await loadSession();
  const actualTasksFilePath = tasksFilePath || session?.currentTasksFile || 'tasks.json';
  const fullTasksPath = path.join(process.cwd(), actualTasksFilePath);

  try {
    let tasksData: any; // Replace 'any' with TasksFile type once imported/defined
    try {
        const fileContent = await fs.readFile(fullTasksPath, 'utf-8');
        tasksData = JSON.parse(fileContent); // Cast to TasksFile
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.error(`Error: Tasks file ${actualTasksFilePath} not found for updating status.`);
            return false;
        }
        throw e; // Other read/parse errors
    }

    let taskFound = false;
    if (tasksData.epics && Array.isArray(tasksData.epics)) {
        for (const epic of tasksData.epics) {
            if (epic.tasks && Array.isArray(epic.tasks)) {
                const task = epic.tasks.find(t => t.title === taskIdToUpdate); // Simple title match, IDs would be better
                if (task) {
                    task.status = newStatus;
                    taskFound = true;
                    break;
                }
            }
            if (taskFound) break;
        }
    }


    if (taskFound) {
      await fs.writeFile(fullTasksPath, JSON.stringify(tasksData, null, 2));
      console.log(`Task "${taskIdToUpdate}" status updated to "${newStatus}" in ${actualTasksFilePath}`);
      // Update session's lastModified
      const currentSessionData = await loadSession(); // Reload to ensure we have the latest
      if (currentSessionData) {
        currentSessionData.lastModified = new Date().toISOString();
        const sessionFilePath = path.join(process.cwd(), SESSION_FILE_NAME);
        await fs.writeFile(sessionFilePath, JSON.stringify(currentSessionData, null, 2));
      } else {
        // If no session file, create one just to update timestamp (or rely on saveSession to be called elsewhere)
         await saveSession(undefined, actualTasksFilePath);
      }
      return true;
    } else {
      console.warn(`Task "${taskIdToUpdate}" not found in ${actualTasksFilePath}.`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating task status in ${actualTasksFilePath}:`, error);
    return false;
  }
}
*/
