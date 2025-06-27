// Content from the typescript block above
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Config } from '@google/gemini-cli-core';
import { loadSession } from '../session/session_manager.js';
// Assuming TasksFile and displayTasks can be imported or types redefined if necessary.
// For now, let's copy the displayTasks logic or a simplified version.

interface Task {
  title: string;
  status: 'pending' | 'in progress' | 'done';
}

interface Epic {
  title: string;
  tasks: Task[];
}

interface TasksFile {
  epics: Epic[];
}

// Copied/adapted from tasks_command.ts for now. Could be refactored into a shared util.
function displayTasksFromFile(tasksData: TasksFile, tasksFilePath: string): void {
  if (!tasksData.epics || tasksData.epics.length === 0) {
    console.log(`No epics or tasks found in ${tasksFilePath}.`);
    return;
  }

  console.log(`\n--- Project Tasks (from ${tasksFilePath}) ---`);
  tasksData.epics.forEach((epic, index) => {
    console.log(`\nEpic ${index + 1}: ${epic.title}`);
    if (epic.tasks && epic.tasks.length > 0) {
      epic.tasks.forEach(task => {
        let statusMarker = ' ';
        if (task.status === 'in progress') statusMarker = '>';
        if (task.status === 'done') statusMarker = 'X';
        console.log(`  [${statusMarker}] ${task.title} (${task.status})`);
      });
    } else {
      console.log('  (No tasks for this epic)');
    }
  });
  console.log('\n------------------------------------------');
}


export async function handlePlanCommand(config: Config): Promise<void> {
  console.log("\nDisplaying current project plan...\n");

  const session = await loadSession();
  // Use relative paths from CWD for file operations, but display the basename from session for clarity
  const specFileName = session?.currentSpecFile || 'spec.md';
  const tasksFileName = session?.currentTasksFile || 'tasks.json';

  const specFilePathFull = path.join(process.cwd(), specFileName);
  const tasksFilePathFull = path.join(process.cwd(), tasksFileName);


  // Display Spec
  try {
    const specContent = await fs.readFile(specFilePathFull, 'utf-8');
    console.log(`--- Specification (${specFileName}) ---`);
    console.log(specContent);
    console.log('-----------------------------------\n');
    console.log(`To edit the specification, please open '${specFileName}' in your preferred text editor.`);
    console.log(`If you modify it, you may want to regenerate tasks using: gemini tasks --generate\n`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Specification file '${specFileName}' not found.`);
      console.log("You can generate one using: gemini spec \"<your project idea>\"\n");
    } else {
      console.error(`Error reading specification file '${specFileName}':`, error.message);
    }
  }

  // Display Tasks
  try {
    const tasksFileContent = await fs.readFile(tasksFilePathFull, 'utf-8');
    const tasksData = JSON.parse(tasksFileContent) as TasksFile;
    displayTasksFromFile(tasksData, tasksFileName);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Tasks file '${tasksFileName}' not found.`);
      console.log("You can generate one from a spec.md using: gemini tasks --generate\n");
    } else {
      console.error(`Error reading or parsing tasks file '${tasksFileName}':`, error.message);
    }
  }

  if (!session) {
    console.log("No active session found (.gemini-session.json). Displaying content from default file paths ('spec.md', 'tasks.json') if they exist.");
  }
}
