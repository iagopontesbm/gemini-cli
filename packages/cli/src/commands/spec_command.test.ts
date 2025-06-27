// packages/cli/src/commands/spec_command.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSpecCommand } from './spec_command';
import type { Config } from '@google/gemini-cli-core';

// Mock dependencies
vi.mock('node:fs/promises', async (importOriginal) => {
    const actualFs = await importOriginal();
    return {
        ...actualFs,
        writeFile: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
    };
});

vi.mock('../utils/hitl.js', () => ({
  confirmProceed: vi.fn(),
}));

vi.mock('../session/session_manager.js', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
  loadSession: vi.fn().mockResolvedValue({}), // Default mock
}));

vi.mock('../processing/multimodal_processor.js', () => ({
  processImage: vi.fn().mockResolvedValue("Mocked image description.\n\n"),
  processAudio: vi.fn().mockResolvedValue("Mocked audio transcription.\n\n"),
}));

const mockGenerateContent = vi.fn();
const mockIsInitialized = vi.fn().mockReturnValue(true);
const mockInitialize = vi.fn().mockResolvedValue(undefined);

// Mock Config and GeminiClient
const mockGetGeminiClient = vi.fn(() => ({
  generateContent: mockGenerateContent,
  isInitialized: mockIsInitialized,
  initialize: mockInitialize,
}));
const mockGetContentGeneratorConfig = vi.fn(() => ({ model: 'gemini-test-model' }));
const mockGetAuthType = vi.fn();


const mockConfig = {
  getGeminiClient: mockGetGeminiClient,
  getContentGeneratorConfig: mockGetContentGeneratorConfig,
  getAuthType: mockGetAuthType,
  // Add other methods from Config type if needed by the command
} as unknown as Config;


describe('handleSpecCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => { // Made beforeEach async for dynamic import
    vi.clearAllMocks(); // Clear mocks before each test
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Type assertion for process.exit mock
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never);

    // Default mock implementations
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'Generated spec content.' }] } }],
    });
    const { confirmProceed } = await import('../utils/hitl.js');
    (confirmProceed as ReturnType<typeof vi.fn>)
        .mockReset() // Reset ensures fresh state for chained calls
        .mockResolvedValueOnce(false) // Open editor? No (default for most tests)
        .mockResolvedValueOnce(true);  // Approve spec? Yes (default for most tests)
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should successfully generate a spec, save it, and save session on approval', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { saveSession } = await import('../session/session_manager.js');
    const { confirmProceed } = await import('../utils/hitl.js');

    // Explicitly set confirmProceed for this test if defaults are not suitable
    (confirmProceed as ReturnType<typeof vi.fn>)
        .mockReset()
        .mockResolvedValueOnce(false) // Open editor? No
        .mockResolvedValueOnce(true);  // Approve spec? Yes


    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(mockGetGeminiClient().generateContent).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith('spec.md', 'Generated spec content.');
    expect(consoleLogSpy).toHaveBeenCalledWith('Specification successfully generated and saved to spec.md');
    expect(confirmProceed).toHaveBeenCalledTimes(2);
    expect(saveSession).toHaveBeenCalledWith('spec.md', undefined);
    expect(consoleLogSpy).toHaveBeenCalledWith('Specification approved. You can now run "gemini tasks --generate" to create tasks from this spec.');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should handle AI not returning content', async () => {
    mockGenerateContent.mockResolvedValueOnce({ candidates: [{ content: { parts: [{text: null}]}}] }); // No text content

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: AI did not return any content for the spec.');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle AI returning no candidates', async () => {
    mockGenerateContent.mockResolvedValueOnce({ candidates: [] }); // No candidates

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: AI did not return any content for the spec.');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });


  it('should exit if user does not approve specification', async () => {
    const { confirmProceed } = await import('../utils/hitl.js');
    (confirmProceed as ReturnType<typeof vi.fn>)
        .mockReset()
        .mockResolvedValueOnce(false) // Open editor? No
        .mockResolvedValueOnce(false); // Approve spec? No

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(consoleLogSpy).toHaveBeenCalledWith('Specification not approved. Exiting. You can edit spec.md and then run "gemini tasks --generate".');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should correctly include image and audio processed content in the prompt to AI', async () => {
    const { processImage, processAudio } = await import('../processing/multimodal_processor.js');
    (processImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Processed image text.\n\n");
    (processAudio as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Processed audio text.\n\n");

    await handleSpecCommand('Initial prompt.', ['img.png'], ['audio.wav'], mockConfig);

    const expectedCombinedPrompt = `Initial user text prompt:\nInitial prompt.\n\nProcessed image text.\n\nProcessed audio text.\n\n`;
    const finalPromptForAI = `Based on the following user request (which may include text, image descriptions, and audio transcriptions), generate a detailed product specification in Markdown format. The specification should outline the entire application plan, including pages, components, and features.

Combined Input:
---
${expectedCombinedPrompt}---

Markdown Specification:`;

    expect(mockGetGeminiClient().generateContent).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({ text: finalPromptForAI })
          ])
        })
      ]),
      expect.anything(), // generationConfig
      expect.anything(), // abortController.signal
      expect.any(String) // model name
    );
  });

  it('should offer to open editor and proceed if user confirms', async () => {
    const { confirmProceed } = await import('../utils/hitl.js');
    (confirmProceed as ReturnType<typeof vi.fn>)
        .mockReset()
        .mockResolvedValueOnce(true)  // Open editor? Yes
        .mockResolvedValueOnce(true); // Approve spec? Yes

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(consoleLogSpy).toHaveBeenCalledWith('Opening spec.md...');
    expect(consoleLogSpy).toHaveBeenCalledWith('(Simulated: Would have opened spec.md in your default editor.)');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should handle error during image processing', async () => {
    const { processImage } = await import('../processing/multimodal_processor.js');
    (processImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null); // Simulate error or no content from image

    await handleSpecCommand('Test prompt', ['img.png'], [], mockConfig);

    // Check that spec generation still proceeds
    expect(mockGetGeminiClient().generateContent).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Specification successfully generated and saved to spec.md');
  });

  it('should handle error during audio processing', async () => {
    const { processAudio } = await import('../processing/multimodal_processor.js');
    (processAudio as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null); // Simulate error or no content from audio

    await handleSpecCommand('Test prompt', [], ['audio.wav'], mockConfig);

    // Check that spec generation still proceeds
    expect(mockGetGeminiClient().generateContent).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Specification successfully generated and saved to spec.md');
  });

  it('should exit if content generator config is not found', async () => {
    (mockConfig.getContentGeneratorConfig as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Content generator configuration not found. Ensure authentication is set up.');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should initialize client if not already initialized', async () => {
    mockIsInitialized.mockReturnValueOnce(false); // Client is not initialized

    await handleSpecCommand('Test prompt', [], [], mockConfig);

    expect(mockInitialize).toHaveBeenCalledWith(mockGetContentGeneratorConfig());
    expect(mockGetGeminiClient().generateContent).toHaveBeenCalled(); // Ensure generation still happens
  });

});
