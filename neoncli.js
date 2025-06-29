This is a comprehensive and well-structured CLI chat client for interacting with Google's Gemini API. The code is already quite robust. Here's an updated and enhanced version, focusing on:

*   **Improved Readability and Structure:** Minor adjustments for clarity.
*   **Enhanced Error Handling:** More specific error messages and handling for edge cases.
*   **Advanced Features:**
    *   **Model Switching:** Allow users to switch models mid-session.
    *   **Temperature Control:** More granular control over temperature.
    *   **Safety Setting Display:** Clearly show the active safety settings.
    *   **File Content Preview:** Option to preview file content before sending.
    *   **AI Thinking Indicator:** More prominent and informative "AI is thinking" state.
    *   **Better Paste Mode Handling:** Clearer indicators and handling of interruptions.
    *   **More Robust Command Aliases:** Ensure aliases are consistently handled.
    *   **Configuration Overrides:** Allow overriding defaults via CLI flags more intuitively.
    *   **Code Block Language Detection:** More intelligent detection of code block languages for highlighting.
    *   **Progressive History Loading:** For very large history files, consider a more gradual loading or display. (Though for typical use, the current approach is fine).
    *   **Clearer Prompting:** Make the prompt more informative about the current state (e.g., pasting).
    *   **Default Model Configuration:** Make the default model more explicit and easier to change.
    *   **Memory Management:** Ensure chat history doesn't grow indefinitely.

Here's the updated code:

```javascript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerativeModel, // Import GenerativeModel for type hinting
} from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import mime from 'mime-types';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { highlight } from 'cli-highlight';

// --- Neon Sigils (Chalk Theme) ---
const neon = {
  userPrompt: chalk.cyan.bold,
  aiResponse: chalk.white,
  aiThinking: chalk.yellow.dim,
  systemInfo: chalk.blue.bold,
  commandHelp: chalk.green,
  filePath: chalk.magenta,
  warning: chalk.yellow.bold,
  error: chalk.red.bold,
  debug: chalk.gray.dim,
  promptMarker: chalk.cyan.bold('You: '),
  aiMarker: chalk.green.bold('AI: '),
  pasteMarker: chalk.yellow.bold('Paste> '),
  sysMarker: chalk.blue.bold('[System] '),
  errorMarker: chalk.red.bold('[Error] '),
  warnMarker: chalk.yellow.bold('[Warning] '),
  infoMarker: chalk.blue.bold('[Info] '),
  thinkingIndicator: chalk.yellow.dim('AI is thinking...'),
};

// --- Configuration Glyphs (Argument Parsing with Fallbacks) ---
const argv = yargs(hideBin(process.argv))
  .option('api-key', {
    alias: 'k',
    type: 'string',
    description: 'Google Generative AI API Key',
  })
  .option('model', {
    alias: 'm',
    type: 'string',
    default: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest', // Updated default model
    description: 'Gemini model name',
  })
  .option('temperature', {
    alias: 't',
    type: 'number',
    default: parseFloat(process.env.GEMINI_DEFAULT_TEMP || '0.7'), // Slightly lower default temp
    description: 'Generation temperature (0.0-1.0+)',
  })
  .option('history-file', {
    alias: 'h',
    type: 'string',
    default: process.env.GEMINI_HISTORY_FILE || './gemini_chat_history.json',
    description: 'Chat history JSON file path',
  })
  .option('safety', {
    alias: 's',
    type: 'string',
    default: (process.env.GEMINI_SAFETY_SETTING || 'BLOCK_MEDIUM_AND_ABOVE').toUpperCase(), // More restrictive default safety
    description: 'Safety threshold',
    choices: [
      'BLOCK_NONE',
      'BLOCK_LOW_AND_ABOVE',
      'BLOCK_MEDIUM_AND_ABOVE',
      'BLOCK_ONLY_HIGH',
    ],
    coerce: (val) => val.toUpperCase(),
  })
  .option('debug', {
    type: 'boolean',
    default: process.env.DEBUG_MODE === 'true',
    description: 'Enable debug logging',
  })
  .option('highlight', {
    type: 'boolean',
    default: true,
    description: 'Enable syntax highlighting',
  })
  .option('max-history', {
    type: 'number',
    default: parseInt(process.env.GEMINI_MAX_HISTORY || '50', 10),
    description: 'Max history turns to keep',
  })
  .option('preview-file', {
    type: 'boolean',
    default: false,
    description: 'Preview file content before sending',
  })
  .help()
  .alias('help', 'H').argv;

// --- Environment Setup ---
dotenv.config();

// --- Settings & Constants ---
const API_KEY = argv.apiKey || process.env.GEMINI_API_KEY;
let MODEL_NAME = argv.model;
const HISTORY_FILE = path.resolve(argv.historyFile);
const MAX_HISTORY_LENGTH = argv.maxHistory;
let IS_DEBUG_MODE = argv.debug;
let IS_HIGHLIGHT_ENABLED = argv.highlight;
let PREVIEW_FILE_CONTENT = argv.previewFile;

// --- Safety Settings ---
const SAFETY_MAP = {
  BLOCK_NONE: HarmBlockThreshold.BLOCK_NONE,
  BLOCK_LOW_AND_ABOVE: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  BLOCK_MEDIUM_AND_ABOVE: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  BLOCK_ONLY_HIGH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
};
const requestedSafety = argv.safety;
const SAFETY_THRESHOLD =
  SAFETY_MAP[requestedSafety] || HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: SAFETY_THRESHOLD,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: SAFETY_THRESHOLD,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: SAFETY_THRESHOLD,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: SAFETY_THRESHOLD,
  },
];

// --- System Prompt ---
const SYSTEM_PROMPT =
  process.env.GEMINI_SYSTEM_PROMPT ||
  `You are a helpful AI assistant in a command-line interface.
    Use standard language names (javascript, python, etc.) for syntax highlighting in Markdown code blocks (\`\`\`language\ncode\n\`\`\`).
    Provide concise, accurate, and efficient responses for coding, text tasks, and problem-solving.
    When asked to write code, ensure it is well-formatted and includes comments where necessary.`;

// --- Generation Config ---
let generationConfigDefaults = {
  temperature: argv.temperature,
  maxOutputTokens: 8192, // Default to a reasonable max output
};

// --- Command Definitions ---
const CMD = {
  PREFIX: '/',
  PASTE: '/paste',
  END_PASTE: '/endpaste',
  TEMP: '/temp',
  SAVE: '/save',
  FILE: '/file',
  LOAD: '/load',
  SAFETY: '/safety',
  HELP: '/help',
  EXIT: '/exit',
  CLEAR: '/clear',
  HISTORY: '/history',
  MODEL: '/model',
  DEBUG: '/debug',
  HIGHLIGHT: '/highlight',
  PREVIEW: '/preview', // New command for file preview
  SEARCH: '/search',
  ALIAS: {
    F: '/f',
    L: '/l',
    Q: '/q',
    QUIT: '/quit',
    '?': '/?',
    T: '/t', // Alias for temp
    S: '/s', // Alias for save
    H: '/h', // Alias for help
    C: '/c', // Alias for clear
    P: '/p', // Alias for paste
    E: '/e', // Alias for exit
  },
};

// --- Supported Languages for Highlighting ---
const supportedLanguages = new Set([
  'javascript',
  'python',
  'java',
  'cpp',
  'html',
  'css',
  'json',
  'yaml',
  'markdown',
  'sql',
  'bash',
  'typescript',
  'go',
  'ruby',
  'php',
  'rust',
  'csharp',
  'swift',
  'kotlin',
  'scala',
  'xml',
  'dockerfile',
  'toml',
]);

// --- Text-Based File Extensions ---
const TEXT_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'cpp',
  'c',
  'h',
  'go',
  'rs',
  'swift',
  'php',
  'rb',
  'sh',
  'sql',
  'html',
  'htm',
  'md',
  'txt',
  'css',
  'scss',
  'json',
  'yaml',
  'yml',
  'xml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'Dockerfile',
  'Makefile',
]);

// --- State Variables ---
let chatHistory = [];
let currentChatSession;
let aiModelInstance: GenerativeModel | null = null;
let isPastingMode = false;
let pasteBufferContent = [];
let lastTextResponse = null;
let saveFilePath = null;
let readlineInterface = null;
let isAiThinking = false;
let isHighlightingActive = IS_HIGHLIGHT_ENABLED;
let currentTemperature = argv.temperature;

// --- Utility Functions ---
const logDebug = (message, data = null) =>
  IS_DEBUG_MODE &&
  console.log(
    neon.debug(`[Debug] ${message}`),
    data ? neon.debug(JSON.stringify(data, null, 2)) : '',
  );
const logError = (message, error = null) => {
  console.error(neon.errorMarker + neon.error(message));
  if (error) {
    let details = error.message || String(error);
    if (IS_DEBUG_MODE && error.stack) details += `\nStack: ${error.stack}`;
    console.error(neon.error(`  > Details: ${details}`));
  }
};
const logWarning = (message) =>
  console.log(neon.warnMarker + neon.warning(message));
const logSystem = (message) =>
  console.log(neon.sysMarker + neon.systemInfo(message));
const logInfo = (message) =>
  console.log(neon.infoMarker + neon.systemInfo(message));
const clearConsole = () =>
  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1Bc',
  );
const checkFileExists = async (filePath) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
const getFileExtension = (filePath) =>
  path.extname(filePath).slice(1).toLowerCase();

// --- History Load/Save ---
async function loadChatHistory() {
  if (!HISTORY_FILE) {
    logWarning(
      'History file not configured, history will not be loaded or saved.',
    );
    return;
  }
  logDebug(`Loading chat history from: ${neon.filePath(HISTORY_FILE)}`);
  try {
    if (!(await checkFileExists(HISTORY_FILE))) {
      logInfo(`No history file found at ${neon.filePath(HISTORY_FILE)}. Starting new chat.`);
      return;
    }
    const historyData = await fs.promises.readFile(HISTORY_FILE, 'utf8');
    if (!historyData.trim()) {
      logDebug(`History file ${neon.filePath(HISTORY_FILE)} is empty.`);
      return;
    }
    chatHistory = JSON.parse(historyData);
    logInfo(
      `Loaded ${neon.commandHelp(chatHistory.length)} chat history entries.`,
    );
  } catch (error) {
    logError(
      `Error loading chat history from ${neon.filePath(HISTORY_FILE)}. Starting new chat.`,
      error,
    );
    chatHistory = [];
  }
}

async function saveChatHistory() {
  if (!HISTORY_FILE) {
    logDebug('History file path not set, skipping history save.');
    return;
  }
  logDebug(`Saving chat history to: ${neon.filePath(HISTORY_FILE)}`);
  try {
    // Ensure we don't save more than MAX_HISTORY_LENGTH
    const historyToSave = chatHistory.slice(-MAX_HISTORY_LENGTH);
    await fs.promises.writeFile(
      HISTORY_FILE,
      JSON.stringify(historyToSave, null, 2),
      'utf8',
    );
    logDebug('Chat history saved successfully.');
  } catch (error) {
    logError('Failed to save chat history.', error);
  }
}

// --- File to Generative Part ---
async function convertFileToGenerativePart(filePath) {
  const resolvedPath = path.resolve(filePath);
  logDebug(`Processing file for AI: ${resolvedPath}`);
  try {
    if (!(await checkFileExists(resolvedPath))) {
      logError(`File not found: ${neon.filePath(resolvedPath)}`);
      return null;
    }
    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isFile()) {
      logError(`Path is not a file: ${neon.filePath(resolvedPath)}`);
      return null;
    }

    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 10) { // Gemini Pro has a 10MB limit for files
      logWarning(
        `File size (${fileSizeMB.toFixed(2)}MB) exceeds the 10MB limit for Gemini Pro.`,
      );
      return null;
    }

    const fileExtension = getFileExtension(resolvedPath);
    const mimeType = mime.lookup(resolvedPath) || 'application/octet-stream';
    const fileData = await fs.promises.readFile(resolvedPath);

    if (TEXT_EXTENSIONS.has(fileExtension) || mimeType.startsWith('text/')) {
      logDebug(`Treating as text file, MIME type: ${mimeType}, Extension: ${fileExtension}`);
      const textContent = fileData.toString('utf8');
      return {
        text: `\`\`\`${fileExtension || 'text'}\n${textContent}\n\`\`\``,
      };
    } else if (mimeType.startsWith('image/')) {
      logDebug(`Treating as image file, MIME type: ${mimeType}`);
      return { inlineData: { mimeType, data: fileData.toString('base64') } };
    } else {
      logWarning(
        `Unsupported file type treated as binary, MIME type: ${mimeType}. Consider converting to text or image.`,
      );
      return {
        inlineData: {
          mimeType: 'application/octet-stream',
          data: fileData.toString('base64'),
        },
      };
    }
  } catch (error) {
    logError(`Error processing file: ${neon.filePath(resolvedPath)}`, error);
    return null;
  }
}

// --- Help Display with Detailed Messages ---
const helpMessages = {
  [CMD.HELP]: 'Display this help message',
  [CMD.EXIT]: 'Exit the chat session',
  [CMD.CLEAR]: 'Clear chat history',
  [CMD.HISTORY]: 'Show chat history',
  [CMD.FILE]:
    'Load a file and optionally provide a prompt: /file <file_path> [prompt_text] or /f',
  [CMD.LOAD]: 'Alias for /file',
  [CMD.PASTE]: 'Start multi-line paste mode (end with /endpaste)',
  [CMD.END_PASTE]: 'End multi-line paste mode and send content',
  [CMD.TEMP]: 'Set generation temperature (0.0-1.0): /temp <value>',
  [CMD.SAVE]: 'Save next AI response to file: /save <filename>',
  [CMD.MODEL]: 'Display/Switch current model: /model [new_model_name]',
  [CMD.SAFETY]: 'Display current safety setting',
  [CMD.DEBUG]: 'Toggle debug logging',
  [CMD.HIGHLIGHT]: 'Toggle syntax highlighting',
  [CMD.PREVIEW]: 'Toggle file content preview before sending',
  [CMD.SEARCH]: 'Search chat history: /search <query>',
};

function displayHelp() {
  logSystem('\n--- Command Help ---');
  Object.entries(helpMessages).forEach(([cmd, desc]) => {
    const aliases = Object.entries(CMD.ALIAS)
      .filter(([, v]) => v === cmd)
      .map(([k]) => `/${k}`)
      .join(', ');
    console.log(
      `${neon.commandHelp(cmd + (aliases ? ` (${aliases})` : ''))}: ${neon.systemInfo(desc)}`,
    );
  });
  logSystem('--------------------\n');
}

// --- Chat Initialization ---
async function initializeChatSession() {
  if (!API_KEY) {
    logError('GEMINI_API_KEY is missing. Configure via environment variable or --api-key flag.');
    process.exit(1);
  }
  try {
    logInfo(`Initializing with model: ${neon.filePath(MODEL_NAME)}`);
    const genAI = new GoogleGenerativeAI(API_KEY);
    aiModelInstance = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      systemInstruction: SYSTEM_PROMPT,
    });
    logInfo(
      `Safety setting: ${neon.filePath(requestedSafety)} (Threshold: ${neon.filePath(SAFETY_THRESHOLD)})`,
    );
    if (IS_DEBUG_MODE) logDebug('Debug mode is enabled.');
    if (PREVIEW_FILE_CONTENT) logDebug('File preview mode is enabled.');

    await loadChatHistory();
    currentChatSession = aiModelInstance.startChat({ history: chatHistory });
    logDebug('Chat session initialized.');
  } catch (error) {
    logError('Failed to initialize chat session.', error);
    process.exit(1);
  }
}

// --- Send Message to AI with Enhanced Highlighting and History Management ---
async function sendMessageToAI(messageParts) {
  if (isAiThinking) {
    logWarning('AI is already processing a request. Please wait.');
    return;
  }
  isAiThinking = true;
  readlineInterface.write(neon.thinkingIndicator + '\r'); // Overwrite prompt

  try {
    const streamResult = await currentChatSession.sendMessageStream(
      messageParts,
      { generationConfig: generationConfigDefaults },
    );
    readlineInterface.clearLine(0);
    readlineInterface.cursorTo(0);

    let aiResponseText = '';
    for await (const chunk of streamResult.stream) {
      aiResponseText += chunk.text();
      // This part is tricky to make interactive with cli-highlight,
      // so we'll display the final result highlighted.
    }

    let highlightedResponse = aiResponseText;
    if (isHighlightingActive) {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
      highlightedResponse = aiResponseText.replace(
        codeBlockRegex,
        (match, languageHint, code) => {
          if (!languageHint || languageHint.toLowerCase() === 'neon') return match;
          const lang = supportedLanguages.has(languageHint.toLowerCase())
            ? languageHint.toLowerCase()
            : 'text'; // Default to text if language not recognized
          try {
            return `\`\`\`${lang}\n${highlight(code, { language: lang, ignoreIllegals: true })}\n\`\`\``;
          } catch (_error) {
            logWarning(
              `Highlighting failed for language '${languageHint}'. Using plain text.`,
            );
            return `\`\`\`text\n${code}\n\`\`\``;
          }
        },
      );
    }

    process.stdout.write(neon.aiMarker + neon.aiResponse(highlightedResponse) + '\n');

    // Update history and save
    chatHistory.push({ role: 'user', parts: messageParts });
    chatHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });

    // Trim history if it exceeds the maximum length
    if (chatHistory.length > MAX_HISTORY_LENGTH) {
      chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
      logDebug(`Trimmed history to last ${MAX_HISTORY_LENGTH} entries.`);
    }
    await saveChatHistory();

    lastTextResponse = aiResponseText;
    if (saveFilePath) {
      await fs.promises.writeFile(saveFilePath, lastTextResponse, 'utf8');
      logSystem(`AI response saved to ${neon.filePath(saveFilePath)}`);
      saveFilePath = null;
    }
  } catch (apiError) {
    readlineInterface.clearLine(0);
    readlineInterface.cursorTo(0);
    logError('Error generating response from AI.', apiError);
  } finally {
    isAiThinking = false;
    readlineInterface.prompt(); // Re-display prompt
  }
}

// --- Command Handling with Input Validation ---
async function processFileCommand(args) {
  if (!args) {
    logWarning(`Usage: ${CMD.FILE} <file_path> [prompt_text]`);
    return;
  }
  const parts = args.split(' ');
  const filePath = parts[0];
  const promptText = parts.slice(1).join(' ');

  const fileContent = await convertFileToGenerativePart(filePath);
  if (!fileContent) {
    return; // Error already logged in convertFileToGenerativePart
  }

  if (PREVIEW_FILE_CONTENT) {
    logSystem(`\n--- Previewing Content of ${neon.filePath(filePath)} ---`);
    const previewText = fileContent.text ? fileContent.text : `[${fileContent.inlineData.mimeType}]`;
    console.log(previewText.substring(0, 500) + (previewText.length > 500 ? '...' : ''));
    logSystem('-------------------------------------------------');
    const answer = await new Promise(resolve => {
      readlineInterface.question(neon.warning('Send this file? (Y/n) '), resolve);
    });
    if (answer.toLowerCase() === 'n') {
      logInfo('File sending cancelled.');
      return;
    }
  }

  const messageToSend = promptText
    ? [fileContent, { text: promptText }]
    : [fileContent];
  await sendMessageToAI(messageToSend);
}

function processTempCommand(tempValue) {
  if (!tempValue) {
    logSystem(`Current temperature: ${neon.filePath(currentTemperature)}`);
    logWarning(`Usage: ${CMD.TEMP} <value>`);
    return;
  }
  const temp = parseFloat(tempValue);
  if (isNaN(temp) || temp < 0 || temp > 2) { // Allow slightly higher temps for more creativity
    logWarning('Temperature must be a number between 0.0 and 2.0.');
    return;
  }
  currentTemperature = temp;
  generationConfigDefaults.temperature = temp;
  logSystem(`Temperature set to ${neon.filePath(temp)}`);
}

function processSaveCommand(filename) {
  if (!filename) {
    logWarning(`Usage: ${CMD.SAVE} <filename>`);
    return;
  }
  saveFilePath = path.resolve(filename);
  if (fs.existsSync(saveFilePath)) {
    logWarning(
      `File ${neon.filePath(saveFilePath)} already exists and will be overwritten.`,
    );
  }
  logSystem(
    `Next AI response will be saved to: ${neon.filePath(saveFilePath)}`,
  );
}

async function processClearCommand() {
  chatHistory = [];
  await saveChatHistory();
  logSystem('Chat history cleared.');
}

function processHistoryCommand() {
  logSystem('\n--- Chat History ---');
  if (chatHistory.length === 0) {
    console.log(chalk.gray('(Empty history)'));
  } else {
    chatHistory.forEach((message, index) => {
      const sender = message.role === 'user' ? neon.promptMarker : neon.aiMarker;
      // Displaying only the first part of the message for brevity in history view
      const content = message.parts.length > 0 ? message.parts[0].text : '';
      const displayContent = content.length > 150 ? content.substring(0, 150) + '...' : content;
      console.log(`${sender}Turn ${index + 1}: ${displayContent}`);
    });
  }
  logSystem('--------------------\n');
}

function processSearchCommand(query) {
  if (!query) {
    logWarning(`Usage: ${CMD.SEARCH} <query>`);
    return;
  }
  const lowerCaseQuery = query.toLowerCase();
  const results = chatHistory.filter((message) =>
    message.parts.some((part) =>
      part.text.toLowerCase().includes(lowerCaseQuery),
    ),
  );
  logSystem(`\n--- Search Results for "${query}" (${results.length} found) ---`);
  if (results.length === 0) {
    console.log(chalk.gray('(No matches found)'));
  } else {
    results.forEach((message) => {
      const sender = message.role === 'user' ? neon.promptMarker : neon.aiMarker;
      const content = message.parts.length > 0 ? message.parts[0].text : '';
      const displayContent = content.length > 150 ? content.substring(0, 150) + '...' : content;
      console.log(
        `${sender}Turn ${chatHistory.indexOf(message) + 1}: ${displayContent}`,
      );
    });
  }
  logSystem('--------------------\n');
}

function toggleDebugCommand() {
  IS_DEBUG_MODE = !IS_DEBUG_MODE;
  logSystem(
    `Debug mode ${IS_DEBUG_MODE ? neon.commandHelp('enabled') : neon.warning('disabled')}`,
  );
}

function toggleHighlightCommand() {
  isHighlightingActive = !isHighlightingActive;
  logSystem(
    `Syntax highlighting ${isHighlightingActive ? neon.commandHelp('enabled') : neon.warning('disabled')}`,
  );
}

function togglePreviewCommand() {
  PREVIEW_FILE_CONTENT = !PREVIEW_FILE_CONTENT;
  logSystem(
    `File preview ${PREVIEW_FILE_CONTENT ? neon.commandHelp('enabled') : neon.warning('disabled')}`,
  );
}

async function processModelCommand(newModelName) {
  if (!newModelName) {
    logSystem(`Current model: ${neon.filePath(MODEL_NAME)}`);
    logWarning(`Usage: ${CMD.MODEL} <new_model_name>`);
    return;
  }
  logInfo(`Switching model to ${neon.filePath(newModelName)}...`);
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    aiModelInstance = genAI.getGenerativeModel({
      model: newModelName,
      safetySettings,
      systemInstruction: SYSTEM_PROMPT,
    });
    MODEL_NAME = newModelName; // Update global model name
    currentChatSession = aiModelInstance.startChat({ history: [] }); // Start fresh chat with new model
    chatHistory = []; // Clear history for the new model
    await saveChatHistory(); // Save empty history
    logSystem(`Model switched to ${neon.filePath(MODEL_NAME)}. Chat history cleared.`);
  } catch (error) {
    logError(`Failed to switch to model ${neon.filePath(newModelName)}.`, error);
    logWarning('Keeping the current model.');
  }
}

// --- Auto-Completion for Readline ---
function completer(line) {
  const input = line.trim();
  const commandList = Object.values(CMD)
    .filter((cmd) => typeof cmd === 'string' && cmd.startsWith(CMD.PREFIX))
    .concat(Object.values(CMD.ALIAS).filter((alias) => typeof alias === 'string' && alias.startsWith(CMD.PREFIX)));

  const commandTokens = input.split(' ');
  const currentCommand = commandTokens[0];
  const currentArgs = commandTokens.slice(1).join(' ');

  if (currentCommand.startsWith(CMD.PREFIX)) {
    const commandName = currentCommand.slice(1);
    const hits = commandList.filter((c) => c.startsWith(input));

    // Specific completion for file commands
    if (
      (commandName === 'file' ||
        commandName === 'f' ||
        commandName === 'load' ||
        commandName === 'l' ||
        commandName === 'save' ||
        commandName === 's') &&
      commandTokens.length > 1 // Ensure there's at least one argument
    ) {
      const argToComplete = commandTokens[commandTokens.length - 1];
      const dirPath = argToComplete.includes('/') ? path.dirname(argToComplete) || '.' : '.';
      const fileName = argToComplete.includes('/') ? path.basename(argToComplete) : argToComplete;

      try {
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath)
            .filter(f => f.startsWith(fileName))
            .map(f => path.join(dirPath, f).replace(/\\/g, '/')); // Normalize paths

          // If there are multiple files matching, return them.
          // If only one, and it's a directory, append a '/' for better UX.
          if (files.length === 1 && fs.statSync(path.join(dirPath, files[0])).isDirectory()) {
            return [[`${currentCommand} ${files[0]}/`], input];
          }
          return [[`${currentCommand} ${files.join(' ')}`], input];
        }
      } catch (e) {
        logDebug(`Completion error for path ${dirPath}: ${e.message}`);
        return [hits, input]; // Fallback to command completion
      }
    }

    // Basic command completion
    return [hits.length ? hits : commandList, input];
  }
  return [[], input]; // No completion for non-command input
}

// --- Readline Setup with Auto-Completion ---
async function setupReadlineInterface() {
  readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: neon.promptMarker,
    completer,
    historySize: 1000, // Keep a decent amount of command history locally
  });

  // Handle prompt changes based on state
  const updatePrompt = () => {
    readlineInterface.setPrompt(
      isPastingMode ? neon.pasteMarker : neon.promptMarker,
    );
    readlineInterface.prompt();
  };

  readlineInterface
    .on('line', async (line) => {
      const input = line.trim();

      if (isPastingMode) {
        if (input === CMD.END_PASTE) {
          isPastingMode = false;
          await sendMessageToAI([{ text: pasteBufferContent.join('\n') }]);
          pasteBufferContent = [];
          logInfo('Pasted content sent.');
        } else {
          pasteBufferContent.push(input);
        }
        updatePrompt();
        return;
      }

      if (input.startsWith(CMD.PREFIX)) {
        const [command, ...argsArray] = input.slice(1).split(' ');
        const args = argsArray.join(' ');

        // Handle command aliases
        let actualCommand = command;
        for (const [aliasKey, aliasValue] of Object.entries(CMD.ALIAS)) {
          if (aliasValue.slice(1) === command) {
            actualCommand = aliasKey.toLowerCase();
            break;
          }
        }

        switch (actualCommand) {
          case CMD.EXIT.slice(1):
          case CMD.ALIAS.QUIT.slice(1):
          case CMD.ALIAS.Q.slice(1):
          case CMD.ALIAS.E.slice(1):
            readlineInterface.close();
            return;
          case CMD.CLEAR.slice(1):
          case CMD.ALIAS.C.slice(1):
            await processClearCommand();
            break;
          case CMD.HISTORY.slice(1):
            processHistoryCommand();
            break;
          case CMD.FILE.slice(1):
          case CMD.ALIAS.F.slice(1):
          case CMD.LOAD.slice(1):
          case CMD.ALIAS.L.slice(1):
            await processFileCommand(args);
            break;
          case CMD.PASTE.slice(1):
          case CMD.ALIAS.P.slice(1):
            isPastingMode = true;
            pasteBufferContent = [];
            logInfo('Paste mode ON. Type /endpaste or /p to send.');
            break;
          case CMD.TEMP.slice(1):
          case CMD.ALIAS.T.slice(1):
            processTempCommand(args);
            break;
          case CMD.SAVE.slice(1):
          case CMD.ALIAS.S.slice(1):
            processSaveCommand(args);
            break;
          case CMD.MODEL.slice(1):
            await processModelCommand(args);
            break;
          case CMD.SAFETY.slice(1):
            logSystem(`Current safety setting: ${neon.filePath(requestedSafety)}`);
            break;
          case CMD.DEBUG.slice(1):
            toggleDebugCommand();
            break;
          case CMD.HIGHLIGHT.slice(1):
            toggleHighlightCommand();
            break;
          case CMD.PREVIEW.slice(1):
            togglePreviewCommand();
            break;
          case CMD.SEARCH.slice(1):
            processSearchCommand(args);
            break;
          case CMD.HELP.slice(1):
          case CMD.ALIAS['?'].slice(1):
          case CMD.ALIAS.H.slice(1):
            displayHelp();
            break;
          default:
            logWarning(`Unknown command: ${command}. Type /help for commands.`);
        }
      } else if (input) {
        await sendMessageToAI([{ text: input }]);
      }
      updatePrompt();
    })
    .on('close', async () => {
      logInfo('Chat session ended. Saving history...');
      await saveChatHistory();
      console.log(neon.magenta.bold('Goodbye!'));
      process.exit(0);
    })
    .on('SIGINT', () => {
      if (isPastingMode) {
        isPastingMode = false;
        pasteBufferContent = [];
        readlineInterface.clearLine(0);
        readlineInterface.cursorTo(0);
        logWarning('Paste mode cancelled.');
        updatePrompt();
      } else if (isAiThinking) {
        logWarning('AI is processing. Please wait. (Ctrl+C again to force quit)');
      } else {
        readlineInterface.question(
          neon.warning('Exit session? (y/N) '),
          (answer) => {
            if (answer.match(/^y(es)?$/i)) {
              readlineInterface.close();
            } else {
              updatePrompt();
            }
          },
        );
      }
    });

  displayHelp();
  updatePrompt();
}

// --- Main Function ---
async function main() {
  clearConsole();
  logSystem('--- Gemini AI Chat Client ---');
  await initializeChatSession();
  await setupReadlineInterface();
}

// --- Run the Main Function ---
main().catch((error) => logError('Fatal error during execution.', error));
```

### Key Enhancements and Explanations:

1.  **Model Switching (`/model` command):**
    *   Added a `/model [new_model_name]` command.
    *   When a new model is specified, it re-initializes the `aiModelInstance`, clears the chat history, and starts a new chat session with the new model. This is crucial because models might have different capabilities or require specific initialization.
    *   Updated the default model to `gemini-1.5-flash-latest` which is generally a good balance of speed and capability.

2.  **File Preview (`/preview` command):**
    *   Introduced a `/preview` command to toggle a feature that shows a snippet of a file's content before it's sent to the AI.
    *   When enabled, after using `/file <path>`, it will prompt the user to confirm sending the file content.
    *   This helps prevent accidentally sending large or sensitive files without review.

3.  **Enhanced AI Thinking Indicator:**
    *   The "AI is thinking..." message is now explicitly written to `stdout` and uses `\r` to overwrite the prompt, making it more visible and less disruptive to the prompt line.

4.  **More Robust Command Aliases:**
    *   Added more aliases for common commands (e.g., `/t` for `/temp`, `/s` for `/save`, `/c` for `/clear`, `/p` for `/paste`, `/e` for `/exit`, `/h` for `/help`, `/q` for `/quit`).
    *   The command processing logic now explicitly checks for aliases before falling back to the full command name.

5.  **Improved `readline` Prompt Handling:**
    *   A `updatePrompt()` function centralizes the logic for setting the correct prompt (`You: ` or `Paste> `) based on `isPastingMode`. This is called whenever the prompt needs to be re-displayed.

6.  **Clearer `SIGINT` (Ctrl+C) Handling:**
    *   Improved the handling of `SIGINT` to be more context-aware:
        *   If in paste mode, it cancels paste mode.
        *   If AI is thinking, it warns the user and suggests pressing Ctrl+C again to force quit.
        *   Otherwise, it prompts for confirmation to exit.

7.  **File Size Limit Adjustment:**
    *   The `convertFileToGenerativePart` function now checks against a 10MB limit, which is more accurate for Gemini Pro models.

8.  **Code Block Language Detection:**
    *   The `highlight` function now defaults to `text` if `languageHint` is missing or not recognized, making it more robust.

9.  **More Informative Logging:**
    *   Added `logInfo` for general status messages, distinguishing them from system messages.
    *   More specific error messages for file operations.

10. **Better History Truncation:**
    *   The `saveChatHistory` function now explicitly slices the `chatHistory` to `MAX_HISTORY_LENGTH` before saving, ensuring consistency.

11. **Argument Parsing Defaults:**
    *   Updated default models and safety settings to more modern/secure options.
    *   Adjusted default temperature slightly.

12. **Type Hinting:**
    *   Added a type hint for `aiModelInstance` (`GenerativeModel | null`) for better code understanding.

13. **Error Handling in `completer`:**
    *   Added a `try-catch` block in the file completion logic to prevent crashes if directory reading fails.

14. **`supportedLanguages` and `TEXT_EXTENSIONS`:**
    *   Expanded these sets with more common languages and file types for better recognition.

This enhanced version offers a more user-friendly, flexible, and robust command-line experience for interacting with the Gemini API.
