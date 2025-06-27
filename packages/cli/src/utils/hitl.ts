import * as readline from 'node:readline/promises';
import { Config } from '@google/gemini-cli-core'; // Added for analyzeErrorAndSuggestFix signature

export async function confirmProceed(promptMessage: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Ensure prompt ends with [Y/n]: or similar if not already there.
  const fullPrompt = promptMessage.includes('[Y/n]') ? promptMessage : `${promptMessage} [Y/n]: `;
  const answer = await rl.question(fullPrompt);
  rl.close();

  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '';
}


import { AuthType, Content } from '@google/gemini-cli-core'; // Added AuthType and Content

// Actual AI-powered error analysis
async function analyzeErrorAndSuggestFix(
  errorMessage: string,
  commandThatFailed?: string, // Optional: command that led to the error
  config?: Config // Optional: config might not always be available
): Promise<string | null> {
  if (!config) {
    console.warn("AI analysis for error fix might be limited without full config. Using basic heuristics.");
    if (errorMessage.toLowerCase().includes("permission denied") || errorMessage.toLowerCase().includes("eacces")) {
      return "Cause: The operation likely failed due to insufficient file system permissions.\nSuggested Fix: Check file/folder permissions (e.g., using 'ls -l <path>') or try running the command with appropriate privileges (e.g., 'sudo <command>' if applicable and safe).";
    }
    if (errorMessage.toLowerCase().includes("not found") || errorMessage.toLowerCase().includes("enoent")) {
      return "Cause: A file or command was not found.\nSuggested Fix: Verify the file path or command name is correct and that it exists. Check for typos.";
    }
    return `Could not perform full AI analysis for the error: ${errorMessage}.\nSuggested Fix: Check error logs carefully and search online for the error message.`;
  }

  const client = config.getGeminiClient();
  if (!client.isInitialized()) {
    const cgConfig = config.getContentGeneratorConfig();
    if (!cgConfig) {
      let errorMsg = "Content generator configuration not found for error analysis.";
      if (!process.env.GEMINI_API_KEY && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_PERSONAL && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_WORKSPACE) {
          errorMsg += " Hint: If using an API key, ensure GEMINI_API_KEY environment variable is set.";
      }
      console.error(errorMsg);
      return `AI analysis unavailable: ${errorMsg}`;
    }
    await client.initialize(cgConfig);
  }

  let promptText = `The following error occurred:
Error: "${errorMessage}"

`;

  if (commandThatFailed) {
    promptText += `This error happened while trying to execute or process the command: "${commandThatFailed}"\n\n`;
  }

  promptText += `Please analyze this error.
Provide a concise explanation of the likely cause.
Then, suggest a potential fix. The fix could be a shell command to try, a configuration change to a file, or a brief explanation of what code to check if applicable.
If suggesting a command, provide only the command. If suggesting a textual explanation or code, keep it brief and actionable.
Focus on the most probable solution.

Format your response clearly, for example:
Cause: [Brief explanation of cause]
Suggested Fix: [Specific command or action]
`;

  console.log(`Asking AI to analyze error and suggest a fix for: ${errorMessage}`);

  const contents: Content[] = [{ role: 'user', parts: [{ text: promptText }] }];
  // Temperature is slightly higher than task parsing, as some creativity might be needed for fixes.
  const generationConfig = { temperature: 0.4, topP: 1 };
  const abortController = new AbortController();

  try {
    const result = await client.generateContent(contents, generationConfig, abortController.signal);
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      return "AI analysis did not return a suggestion.";
    }
    return responseText.trim();
  } catch (aiError) {
    console.error('Error during AI analysis for fix suggestion:', aiError);
    return `AI analysis failed: ${aiError.message}. Basic suggestion: Check error logs and search online.`;
  }
}

export async function confirmProposedFix(
  errorMessage: string,
  commandThatFailed?: string,
  config?: Config // Make config optional here too, to align with analyzeErrorAndSuggestFix
): Promise<{applyFix: boolean, chosenFix: string | null, originalSuggestion: string | null}> {

  const proposedFixSuggestion = await analyzeErrorAndSuggestFix(errorMessage, commandThatFailed, config);
  const originalSuggestionForReturn = proposedFixSuggestion;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.error("\n--- Error Detected ---");
  if (commandThatFailed) console.error(`Command/Context: ${commandThatFailed}`);
  console.error(`Error: ${errorMessage}`);

  if (!proposedFixSuggestion ||
      proposedFixSuggestion.startsWith("AI analysis unavailable") ||
      proposedFixSuggestion.startsWith("Could not perform full AI analysis") ||
      proposedFixSuggestion.startsWith("AI analysis did not return")) {
    console.log(`\n--- AI Analysis Result ---`);
    console.log(proposedFixSuggestion || "No specific suggestion was generated by AI.");
  } else {
    console.log("\n--- AI Suggested Fix ---");
    console.log(proposedFixSuggestion);
  }

  const answer = await rl.question(`\nApply the AI's suggestion (if any), type your own fix, or skip? (Y/n/type fix/s): `);

  if ((answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '') && proposedFixSuggestion && !proposedFixSuggestion.startsWith("AI analysis unavailable") && !proposedFixSuggestion.startsWith("Could not perform full AI analysis")) {
    rl.close();
    // If user says yes, use the AI's suggestion IF it was valid.
    // We need to parse the "Suggested Fix:" part if the AI followed the format.
    const fixParts = proposedFixSuggestion.split("Suggested Fix:");
    const chosenAISuggestion = fixParts.length > 1 ? fixParts[1].trim() : proposedFixSuggestion; // Fallback to whole suggestion
    return { applyFix: true, chosenFix: chosenAISuggestion, originalSuggestion: originalSuggestionForReturn };
  } else if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no' || answer.toLowerCase() === 's' || answer.toLowerCase() === 'skip') {
    rl.close();
    return { applyFix: false, chosenFix: null, originalSuggestion: originalSuggestionForReturn };
  } else if (answer.trim()) {
    // User typed their own fix and it's not empty
    rl.close();
    return { applyFix: true, chosenFix: answer.trim(), originalSuggestion: originalSuggestionForReturn };
  } else {
    // User hit enter but there was no valid AI suggestion to default to 'Y'
    rl.close();
    return { applyFix: false, chosenFix: null, originalSuggestion: originalSuggestionForReturn };
  }
}


// Example of how confirmProposedFix might be used:
// async function someTaskExecution(config: Config) {
//   try {
//     // some operation that might fail
//     throw new Error("Example error: file not found during operation.");
//   } catch (e) {
//     const error = e as Error;
//     console.log("Attempting to analyze error and suggest fix...");
//     const suggestion = await analyzeErrorAndSuggestFix(error.message, config);
//     const { applyFix, chosenFix } = await confirmProposedFix(error.message, suggestion, config);
//     if (applyFix && chosenFix) {
//       console.log(`User approved fix: ${chosenFix}. Attempting to apply (placeholder)...`);
//       // logic to apply chosenFix
//     } else {
//       console.log("User chose not to apply a fix or no fix was suggested.");
//     }
//   }
// }
