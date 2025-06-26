import request from 'supertest';
import express from 'express'; // For typing the app

// Placeholder for the app - this would be your Express app instance
let app: express.Application;

// Mock the coreConfig and GeminiChat from @google/gemini-cli-core
const mockSendMessage = jest.fn();
const mockGetHistory = jest.fn();

jest.mock('@google/gemini-cli-core', () => {
  const originalModule = jest.requireActual('@google/gemini-cli-core');
  return {
    ...originalModule, // Keep other exports like Turn, ChatConfig if needed by server.ts
    GeminiChat: jest.fn().mockImplementation(() => ({
      sendMessage: mockSendMessage,
      getHistory: mockGetHistory,
    })),
  };
});

jest.mock('../src/coreConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({
    // Mock necessary config properties if any are directly used by the chat endpoint
    // before GeminiChat instantiation, though most interaction should be via GeminiChat mock.
    // For example, if your chat endpoint directly uses coreConfig.someProperty:
    // someProperty: 'mockValue',
  }),
}));


beforeAll(async () => {
  // Dynamically import the app AFTER jest has set up mocks
  const serverModule = await import('../src/server');
  app = serverModule.app;
});

beforeEach(() => {
  // Reset mocks before each test
  mockSendMessage.mockClear();
  mockGetHistory.mockClear();
});

describe('POST /api/chat', () => {
  it('should return a 200 and model reply for a valid message', async () => {
    const userMessage = 'Hello, world!';
    const mockReply = 'Hello to you too!';
    const mockHistory = [{ role: 'user', parts: [{text: userMessage}] }, { role: 'model', parts: [{text: mockReply}] }];

    mockSendMessage.mockResolvedValue({ role: 'model', parts: [{ text: mockReply }] });
    mockGetHistory.mockReturnValue(mockHistory);

    const response = await request(app)
      .post('/api/chat')
      .send({ message: userMessage, history: [{ role: 'user', parts: [{text: userMessage}] }] });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe(mockReply);
    expect(response.body.newHistory).toEqual(mockHistory);
    expect(mockSendMessage).toHaveBeenCalledWith(userMessage);
  });

  it('should handle message with file contexts', async () => {
    const userMessage = 'Summarize this file.';
    const fileContexts = [{ fileName: 'test.txt', content: 'This is a test file.' }];
    const mockReply = 'The file says: This is a test file.';
    const augmentedInput = `\n--- File: ${fileContexts[0].fileName} ---\n${fileContexts[0].content.substring(0,20000)}...\n--- End File: ${fileContexts[0].fileName} ---\n\nUser query based on the files above:\n${userMessage}`;
    const mockHistoryAfter = [
        {role: 'user', parts: [{text: augmentedInput}]}, // or however history is structured with augmented input
        {role: 'model', parts: [{text: mockReply}]}
    ];

    mockSendMessage.mockResolvedValue({ role: 'model', parts: [{ text: mockReply }] });
    mockGetHistory.mockReturnValue(mockHistoryAfter);


    const response = await request(app)
      .post('/api/chat')
      .send({ message: userMessage, fileContexts, history: [] });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe(mockReply);
    expect(mockSendMessage).toHaveBeenCalledWith(augmentedInput);
  });

  it('should allow empty message if file context is provided', async () => {
    const fileContexts = [{ fileName: 'doc.pdf', content: 'Important document content.' }];
    const mockReply = 'This document is important.';
    const augmentedInput = `\n--- File: ${fileContexts[0].fileName} ---\n${fileContexts[0].content.substring(0,20000)}...\n--- End File: ${fileContexts[0].fileName} ---`;
    const mockHistoryAfter = [
        {role: 'user', parts: [{text: augmentedInput}]},
        {role: 'model', parts: [{text: mockReply}]}
    ];
    mockSendMessage.mockResolvedValue({ role: 'model', parts: [{ text: mockReply }] });
    mockGetHistory.mockReturnValue(mockHistoryAfter);

    const response = await request(app)
      .post('/api/chat')
      .send({ fileContexts, history: [] }); // message is undefined

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe(mockReply);
    expect(mockSendMessage).toHaveBeenCalledWith(augmentedInput);
  });


  it('should return 400 if message and fileContexts are missing', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ history: [] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Message or file context is required');
  });

  it('should return 400 for invalid message format', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 123, history: [] }); // message is not a string
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid message format.');
  });

  it('should return 400 for invalid fileContexts format (not an array)', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: "hello", fileContexts: {fileName: "a", content: "b"} , history: [] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid history or fileContexts format.');
  });

  it('should return 400 for invalid item in fileContexts', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({ message: "hello", fileContexts: [{fileName: "a"}] , history: [] }); // missing content
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid fileContext item format.');
  });

  it('should return 413 if fileContext content is too large', async () => {
    const largeContent = "a".repeat(11 * 1024 * 1024); // Assuming MAX_FILE_SIZE_BYTES is 10MB in server
    const response = await request(app)
      .post('/api/chat')
      .send({ message: "hello", fileContexts: [{fileName: "large.txt", content: largeContent}] , history: [] });
    expect(response.status).toBe(413);
    expect(response.body.error).toMatch(/File context for .* is too large/);
  });


  it('should return 500 if GeminiChat.sendMessage fails', async () => {
    mockSendMessage.mockRejectedValue(new Error('Internal AI error'));
    const response = await request(app)
      .post('/api/chat')
      .send({ message: 'This will fail' });
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('An unexpected error occurred on the server.');
    // In development, body.details would contain 'Internal AI error'
  });
});
