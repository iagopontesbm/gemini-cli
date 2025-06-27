// Content from the block above
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AuthType, Config, Content } from '@google/gemini-cli-core';
import { saveSession, loadSession } from '../session/session_manager.js';
import { confirmProceed } from '../utils/hitl.js';

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

    // --- Refined HITL Checkpoint: Pre-Task-Execution Confirmation ---
    const proceedWithSimulatedExecution = await confirmProceed(
      `Tasks have been generated/loaded. Proceed with simulated execution of tasks?`,
      true // Default to yes
    );

    if (!proceedWithSimulatedExecution) {
      console.log("Simulated task execution cancelled by user.");
      process.exit(0);
    }
    // --- End of Pre-Task-Execution Confirmation ---


    // --- Start of Basic HITL for simulated error (slightly refined) ---
    const firstEpic = tasksData.epics?.[0];
    const firstTask = firstEpic?.tasks?.[0];

    if (firstTask && firstTask.status === 'pending') {
      console.log(`\nSimulating execution of the first task: "${firstTask.title}"...`);
      // Simulate an error condition
      const simulatedErrorOccurred = true; // Change to false to simulate success
      const simulatedErrorMessage = "Error: Simulated task failed due to missing dependency 'foo'.";

      if (simulatedErrorOccurred) {
        console.error(`\nOops! An error occurred during the simulated execution of '${firstTask.title}':`);
        console.error(simulatedErrorMessage); // This is the "captured output"

        console.log("\nAttempting to get a fix suggestion from AI...");
        let proposedFixFromAI = "No specific fix suggested by AI. Please analyze manually."; // Default

        try {
          // Construct prompt for AI
          const errorAnalysisPrompt = `The following error occurred while trying to execute a command:
Error: "${simulatedErrorMessage}"
Task being executed: "${firstTask.title}"
Epic: "${firstEpic?.title || 'Unknown'}"
Based on this error, suggest a single, concise, actionable step (like a command to run or a file to check/edit) to fix it. If unsure, say "Unable to determine a specific fix."`;

          const client = config.getGeminiClient(); // Assume client is available and configured
          if (!client.isInitialized()) {
            const cgConfig = config.getContentGeneratorConfig();
            if (!cgConfig) throw new Error("Content generator config not found for AI error analysis.");
            await client.initialize(cgConfig);
          }

          const contents: Content[] = [{ role: 'user', parts: [{ text: errorAnalysisPrompt }] }];
          // Ensure Content is imported if not already: import { Content } from '@google/gemini-cli-core';
          const generationConfig = { temperature: 0.5, topP: 1, maxOutputTokens: 150 };
          const abortController = new AbortController();

          const result = await client.generateContent(contents, generationConfig, abortController.signal);
          const aiSuggestion = result.candidates?.[0]?.content?.parts?.[0]?.text;

          if (aiSuggestion && !aiSuggestion.toLowerCase().includes("unable to determine")) {
            proposedFixFromAI = aiSuggestion.trim();
          }
        } catch (aiError) {
          console.error("Error while contacting AI for a fix suggestion:", aiError.message);
          // proposedFixFromAI remains the default
        }

        console.log("AI Suggested Fix: " + proposedFixFromAI);

        const userApprovedFix = await confirmProceed(
          `Do you want to attempt to apply the AI's suggested fix?`
        );

        if (userApprovedFix) {
          console.log("Simulating application of the fix... Fix applied (simulated).");
          // Here, actual fix logic would go in a more advanced implementation
          // For this simulation, let's assume the fix makes the task "done"
          const taskToUpdate = tasksData.epics.flatMap(e => e.tasks).find(t => t.title === firstTask.title);
          if (taskToUpdate) {
            taskToUpdate.status = 'done';
            await fs.writeFile(TASKS_FILE_PATH, JSON.stringify(tasksData, null, 2));
            console.log(`Task '${firstTask.title}' status updated to 'done' in ${TASKS_FILE_PATH} (simulated).`);
          }
        } else {
          console.log("Fix not applied. Please address the error manually.");
        }
      } else {
        console.log(`Simulated task '${firstTask.title}' completed successfully.`);
        const taskToUpdate = tasksData.epics.flatMap(e => e.tasks).find(t => t.title === firstTask.title);
        if (taskToUpdate) {
            taskToUpdate.status = 'done'; // Mark as done
            await fs.writeFile(TASKS_FILE_PATH, JSON.stringify(tasksData, null, 2));
            console.log(`Task '${firstTask.title}' status updated to 'done' in ${TASKS_FILE_PATH}.`);
        }
      }
    } else if (proceedWithSimulatedExecution) {
        console.log("\nNo pending tasks found to simulate execution for, or tasks structure is empty.");
    }
    // --- End of Basic HITL for simulated error ---

  } catch (error) {
    // Error already logged in parseSpecToTasksAI or here if tasksData is invalid
    console.error('Failed to generate and save tasks.');
    process.exit(1);
  }
}
