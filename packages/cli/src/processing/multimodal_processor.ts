// Content from the typescript block above
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Config, Content, Part, AuthType } from '@google/gemini-cli-core';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'; // For direct Vision model use

// Helper to convert local file path to a generable part
async function fileToGenerativePart(filePath: string, mimeType: string): Promise<Part> {
  const data = await fs.readFile(filePath);
  return {
    inlineData: {
      data: Buffer.from(data).toString("base64"),
      mimeType
    }
  };
}

export async function processImage(imagePath: string, config: Config): Promise<string | null> {
  console.log(`Processing image: ${imagePath}...`);
  try {
    await fs.access(imagePath); // Check if file exists and is accessible
    const imageMimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png'
                        : path.extname(imagePath).toLowerCase() === '.jpg' ? 'image/jpeg'
                        : path.extname(imagePath).toLowerCase() === '.jpeg' ? 'image/jpeg'
                        : path.extname(imagePath).toLowerCase() === '.heic' ? 'image/heic'
                        : path.extname(imagePath).toLowerCase() === '.heif' ? 'image/heif'
                        : path.extname(imagePath).toLowerCase() === '.webp' ? 'image/webp'
                        : 'image/jpeg'; // Default or throw error for unsupported

    // Using a specific Vision model instance.
    // API key needs to be available. The main config might be for a different model.
    if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not found. Image processing might fail if other auth methods don't cover Vision API or if specific key is needed.");
        // Depending on how @google/gemini-cli-core's AuthType and ContentGenerator are set up,
        // this might still work if the user is authenticated via OAuth and it has Vision scope.
        // For robustness with API keys, the key is often expected.
    }
    const visionModelName = "gemini-1.5-flash-latest"; // general multimodal model

    const generativeVisionModel = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "") // SDK handles API key priority
        .getGenerativeModel({
            model: visionModelName,
            // Safety settings might be relevant for image content
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

    const imagePart = await fileToGenerativePart(imagePath, imageMimeType);
    const promptParts: Part[] = [ // Ensure this is an array of Part objects if the SDK expects that for .generateContent's parts array.
        {text: "Describe this image in detail. If there's any text visible in the image, please extract and include it verbatim."},
        imagePart,
    ];

    console.log(`Sending image ${imagePath} to vision model ${visionModelName}...`);

    const result = await generativeVisionModel.generateContent({ contents: [{ role: "user", parts: promptParts }] });
    const responseText = result.response.text();

    if (responseText) {
      console.log(`Successfully processed image ${imagePath}.`);
      return `Image Content (${path.basename(imagePath)}):\n${responseText.trim()}\n`;
    } else {
      console.warn(`No description returned for image ${imagePath}.`);
      return `Image Content (${path.basename(imagePath)}):\n[No description returned by AI for this image.]\n`;
    }

  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error.message);
    if (error.code === 'ENOENT') {
        return `Image Content (${path.basename(imagePath)}):\n[Error: Image file not found at ${imagePath}]\n`;
    }
    return `Image Content (${path.basename(imagePath)}):\n[Error processing image: ${error.message}]\n`;
  }
}


export async function processAudio(audioPath: string, config: Config): Promise<string | null> {
  console.log(`Processing audio (placeholder): ${audioPath}...`);
  try {
    await fs.access(audioPath); // Check file access
    const placeholderText = `Audio Content (${path.basename(audioPath)}):\n[Audio transcription for '${audioPath}' would be integrated here. This is a placeholder as direct Whisper API access via the current Gemini client is not standard or a specific audio model in Gemini is not being used here. Future implementation could involve a separate Whisper client, a local tool, or a Gemini model fine-tuned for audio transcription if available and configured.]\n`;
    console.log(`Placeholder for audio processing of ${audioPath} completed.`);
    return placeholderText;
  } catch (error) {
     console.error(`Error accessing audio file ${audioPath}:`, error.message);
     if (error.code === 'ENOENT') {
        return `Audio Content (${path.basename(audioPath)}):\n[Error: Audio file not found at ${audioPath}]\n`;
    }
    return `Audio Content (${path.basename(audioPath)}):\n[Error accessing audio file: ${error.message}]\n`;
  }
}
