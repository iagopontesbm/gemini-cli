// Content from the block above
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AuthType, Config, Content } from '@google/gemini-cli-core';
import { saveSession, loadSession } from '../session/session_manager.js';

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

const SPEC_FILE_PATH = 'spec.md';
const TASKS_FILE_PATH = 'tasks.json';

async function ensureSpecFileExists(): Promise<string> {
  try {
    const specContent = await fs.readFile(SPEC_FILE_PATH, 'utf-8');
    return specContent;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(
        `Error: ${SPEC_FILE_PATH} not found. Please generate it using 'gemini spec <prompt>' first.`,
      );
    } else {
      console.error(`Error reading ${SPEC_FILE_PATH}:`, error);
    }
    process.exit(1);
  }
}

async function parseSpecToTasksAI(specContent: string, config: Config): Promise<TasksFile> {
  const prompt = `Parse the following Markdown product specification into a JSON structure of epics and tasks.
The root should be an object with a single key "epics", which is an array.
Each epic in the "epics" array should be an object with a "title" (string) and a "tasks" (array) property.
Each task in the "tasks" array should be an object with a "title" (string) and a "status" (string, always set to "pending" for new tasks).
Ensure the output is a valid JSON object suitable for direct parsing with JSON.parse().

Markdown specification:
---
${specContent}
---

JSON output:`;

  console.log('Asking AI to parse spec.md into tasks...');

  const client = config.getGeminiClient();
  if (!client.isInitialized()) {
    const cgConfig = config.getContentGeneratorConfig();
    if (!cgConfig) {
        let errorMsg = "Content generator configuration not found for task parsing.";
        if (!process.env.GEMINI_API_KEY && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_PERSONAL && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_WORKSPACE) {
            errorMsg += " Hint: If using an API key, ensure GEMINI_API_KEY environment variable is set.";
        }
        throw new Error(errorMsg);
    }
    await client.initialize(cgConfig);
  }

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
  // Requesting JSON output directly if the model/API supports it
  const generationConfig = {
    temperature: 0.1, // Lower temperature for more deterministic JSON output
    topP: 1,
    responseMimeType: "application/json" // Crucial for getting JSON
  };
  const abortController = new AbortController();

  try {
    const result = await client.generateContent(contents, generationConfig, abortController.signal);
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('AI did not return any content for task parsing.');
    }

    // The model should return parseable JSON directly due to responseMimeType.
    // No need to strip markdown backticks if the API behaves as expected.
    return JSON.parse(responseText) as TasksFile;

  } catch (error) {
    let detailedError = `Error parsing spec with AI: ${error.message}`;
    if (error.message.includes("JSON.parse")) {
        detailedError += "\nThe AI's response was not valid JSON. You might need to refine the prompt, check spec.md, or the model's ability to return clean JSON for this request.";
    }
    console.error(detailedError);
    throw new Error(detailedError);
  }
}

function displayTasks(tasksData: TasksFile): void {
  if (!tasksData.epics || tasksData.epics.length === 0) {
    console.log(`No epics or tasks found in ${TASKS_FILE_PATH}.`);
    return;
  }

  console.log(`\n--- Project Tasks (from ${TASKS_FILE_PATH}) ---`);
  tasksData.epics.forEach((epic, index) => {
    console.log(`\nEpic ${index + 1}: ${epic.title}`);
    if (epic.tasks && epic.tasks.length > 0) {
      epic.tasks.forEach(task => {
        // Simple status display, can be enhanced with colors later
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

export async function handleTasksCommand(config: Config, forceGenerate: boolean = false): Promise<void> {
  if (!forceGenerate) {
    try {
      // Try to read and display existing tasks.json
      const tasksFileContent = await fs.readFile(TASKS_FILE_PATH, 'utf-8');
      const tasksData = JSON.parse(tasksFileContent) as TasksFile;
      displayTasks(tasksData);
      console.log(`\nTo regenerate tasks from ${SPEC_FILE_PATH}, run 'gemini tasks --generate'.`);
      return;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`${TASKS_FILE_PATH} not found. Will attempt to generate it from ${SPEC_FILE_PATH}.`);
        // Proceed to generation logic
      } else {
        console.error(`Error reading or parsing ${TASKS_FILE_PATH}:`, error);
        process.exit(1);
      }
    }
  }

  // Generation logic (if forced or tasks.json didn't exist)
  console.log(`Generating tasks from ${SPEC_FILE_PATH}...`);
  const specContent = await ensureSpecFileExists();

  try {
    const tasksData = await parseSpecToTasksAI(specContent, config);
    if (!tasksData || !tasksData.epics) {
        throw new Error("AI parsing returned an invalid or empty structure for tasks.");
    }
    await fs.writeFile(TASKS_FILE_PATH, JSON.stringify(tasksData, null, 2));
    console.log(`Tasks successfully generated and saved to ${TASKS_FILE_PATH}`);

    const session = await loadSession();
    await saveSession(session?.currentSpecFile || SPEC_FILE_PATH, TASKS_FILE_PATH);

    displayTasks(tasksData);
  } catch (error) {
    // Error already logged in parseSpecToTasksAI or here if tasksData is invalid
    console.error('Failed to generate and save tasks.');
    process.exit(1);
  }
}
