import * as fs from 'node:fs/promises';
// import * as readline from 'node:readline/promises'; // No longer directly used here
import { AuthType, Config, Content } from '@google/gemini-cli-core';
import { confirmProceed } from '../utils/hitl.js';
import { saveSession } from '../session/session_manager.js';
import { processImage, processAudio } from '../processing/multimodal_processor.js';

export async function handleSpecCommand(
  initialTextPrompt: string,
  imagePaths: string[],
  audioPaths: string[],
  config: Config
): Promise<void> {

  let combinedPrompt = initialTextPrompt ? `Initial user text prompt:\n${initialTextPrompt}\n\n` : "";

  console.log("Processing multimedia inputs for spec generation...");

  for (const imagePath of imagePaths) {
    const imageDescription = await processImage(imagePath, config);
    if (imageDescription) {
      combinedPrompt += imageDescription; // Already includes "Image Description (filename):"
    }
  }

  for (const audioPath of audioPaths) {
    const audioTranscription = await processAudio(audioPath, config); // Placeholder
    if (audioTranscription) {
      combinedPrompt += audioTranscription; // Already includes "Audio Content (filename):"
    }
  }

  if (!combinedPrompt.trim()) {
    console.error("Error: No content to generate spec from after processing inputs. Please provide a text prompt or valid multimedia files.");
    process.exit(1);
  }

  console.log(`\nGenerating specification based on combined inputs...`);
  const finalPromptForAI = `Based on the following user request (which may include text, image descriptions, and audio transcriptions), generate a detailed product specification in Markdown format. The specification should outline the entire application plan, including pages, components, and features.

Combined Input:
---
${combinedPrompt}
---

Markdown Specification:`;


  try {
    // Ensure client is initialized if this command runs before regular app flow
    // This might require adjustments based on how `Config` and `GeminiClient` are structured.
    // For now, we assume `config.getGeminiClient()` gives us what we need,
    // or that `config.getContentGenerator()` is the more direct path.

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
        console.error("Error: Content generator configuration not found. Ensure authentication is set up.");
        // Attempt to guide the user if API key is the likely method for this standalone command
        if (!process.env.GEMINI_API_KEY && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_PERSONAL && config.getAuthType() !== AuthType.LOGIN_WITH_GOOGLE_WORKSPACE) {
            console.error("Hint: If using an API key, ensure GEMINI_API_KEY environment variable is set.");
        }
        process.exit(1);
    }

    // The GeminiClient might need to be explicitly initialized if not already done by `loadCliConfig`
    // For now, let's try using the ContentGenerator directly as it's simpler for a single call.
    // This assumes createContentGenerator was called during loadCliConfig or is accessible.
    // The `config.getGeminiClient()` would typically be used for chat sessions.
    // A more direct way for a single generation might be through a method on config or by getting the content generator.

    // Let's assume there's a way to get an initialized ContentGenerator or make a direct call.
    // The `GeminiClient` class has `generateContent` which is ideal.
    // We need to ensure the client is initialized.
    // `config.getGeminiClient()` should return an initialized client if `loadCliConfig` and subsequent steps in `main` set it up.
    // However, our command runs *before* the interactive/non-interactive split where client init usually happens.

    // Simplification: Access ContentGenerator directly if possible for a one-shot generation
    // This is a temporary assumption, might need to call client.initialize() or similar from config.
    const client = config.getGeminiClient(); // This might throw if not initialized.
    if (!client.isInitialized()) { // Assuming an isInitialized method or similar check
        // This is a conceptual fix: the actual initialization might be more complex
        // or might need to happen in `gemini.tsx` before calling `handleSpecCommand`.
        // For now, let's assume `loadCliConfig` has done enough for `getContentGenerator` to work.
        // Or, we rely on `GEMINI_API_KEY` for this specific command path if other auth isn't ready.
        await client.initialize(contentGeneratorConfig);
    }


    console.log('Generating specification from AI...');
    // finalPromptForAI is now the variable holding the complete prompt
    const contents: Content[] = [{ role: 'user', parts: [{ text: finalPromptForAI }] }];
    const generationConfig = { temperature: 0.7, topP: 1 }; // Example config
    const abortController = new AbortController();

    // Using client.generateContent which is a method found on GeminiClient
    const result = await client.generateContent(contents, generationConfig, abortController.signal);

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('Error: AI did not return any content for the spec.');
      process.exit(1);
    }

    const specFilePath = 'spec.md';
    await fs.writeFile(specFilePath, responseText);
    console.log(`Specification successfully generated and saved to ${specFilePath}`);

    const userApproved = await confirmProceed(
      `Please review and edit ${specFilePath} if necessary. \nApprove this specification to proceed (e.g., to task generation)?`
    );

    if (userApproved) {
      await saveSession(specFilePath, undefined); // Save session, tasks.json might not exist yet
      console.log('Specification approved. You can now run "gemini tasks --generate" to create tasks from this spec.');
      // In a more integrated workflow, this could automatically trigger task generation.
    } else {
      console.log('Specification not approved. Exiting. You can edit spec.md and then run "gemini tasks --generate".');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error generating specification:', error);
    process.exit(1);
  }
}
