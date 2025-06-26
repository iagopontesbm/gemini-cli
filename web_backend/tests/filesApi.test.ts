import request from 'supertest';
import express from 'express'; // Import express to type the app
import fs from 'fs/promises';
import path from 'path';

// Import your express app
// IMPORTANT: Adjust the path to where your app is exported
// Assuming your src/server.ts exports the app instance or can be modified to do so.
// For this to work, server.ts might need to export 'app', e.g. `export const app = express();`
// and then conditionally listen if not in test mode.
// Or, have a separate app.ts and server.ts (server.ts imports app from app.ts and starts listening)
// For simplicity, we'll assume `server.ts` can be imported and its `app` can be accessed or it starts a server.
// This often requires refactoring server.ts slightly.

// Placeholder for the app - in a real scenario, this would be your Express app instance
let app: express.Application;
const WORKSPACE_ROOT_TEST = path.resolve(process.cwd(), 'user_workspace_test_files');

// Mock coreConfig to prevent actual core library loading during these specific API tests
jest.mock('../src/coreConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({
    // Mock whatever getConfig is expected to return if its called by file APIs
    // For file APIs, it might not be directly used, but good to have a mock
    getGeminiClient: jest.fn(), // Example mock method
  }),
}));


beforeAll(async () => {
  // Dynamically import the app AFTER jest has mocked coreConfig
  // This is a common pattern to ensure mocks are applied before module load.
  const serverModule = await import('../src/server'); // Adjust if your app export is different
  app = serverModule.app; // Assuming server.ts exports 'app'

  // Setup a test workspace
  await fs.mkdir(WORKSPACE_ROOT_TEST, { recursive: true });
  await fs.writeFile(path.join(WORKSPACE_ROOT_TEST, 'testfile.txt'), 'Hello test world');
  await fs.mkdir(path.join(WORKSPACE_ROOT_TEST, 'test_subdir'), { recursive: true });
  await fs.writeFile(path.join(WORKSPACE_ROOT_TEST, 'test_subdir', 'subfile.txt'), 'Subdir content');
  await fs.writeFile(path.join(WORKSPACE_ROOT_TEST, '.hiddenfile.txt'), 'Hidden content');
  // Create a large file for size limit testing (e.g., 11MB if limit is 10MB)
  // const largeContent = Buffer.alloc(11 * 1024 * 1024, 'a');
  // await fs.writeFile(path.join(WORKSPACE_ROOT_TEST, 'largefile.txt'), largeContent);
});

afterAll(async () => {
  await fs.rm(WORKSPACE_ROOT_TEST, { recursive: true, force: true });
});

describe('File System API Endpoints', () => {
  // Override WORKSPACE_ROOT for tests - this requires server.ts to be adaptable or use an env var
  // For now, this test suite assumes server.ts is using the 'user_workspace' dir.
  // A better way would be to allow WORKSPACE_ROOT to be configured via an env var for tests.
  // Or, the server's file operations are refactored into a service that can be instantiated with a test root.

  describe('GET /api/files/list', () => {
    it('should list files and directories in the workspace root', async () => {
      const response = await request(app).get('/api/files/list?path=.');
      expect(response.status).toBe(200);
      expect(response.body.path).toBe('.');
      expect(response.body.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'testfile.txt', isDirectory: false }),
          expect.objectContaining({ name: 'test_subdir', isDirectory: true }),
          // .hiddenfile.txt should be excluded by default server logic
        ])
      );
      expect(response.body.files.find((f:any) => f.name === '.hiddenfile.txt')).toBeUndefined();
      expect(response.body.breadcrumbs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'user_workspace', path: '.'}) // Adjust if server changes root name logic
        ])
      );
    });

    it('should list files in a subdirectory', async () => {
      const response = await request(app).get('/api/files/list?path=test_subdir');
      expect(response.status).toBe(200);
      expect(response.body.path).toBe('test_subdir');
      expect(response.body.files).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'subfile.txt', isDirectory: false }),
        ])
      );
    });

    it('should return 403 for path traversal attempts', async () => {
      const response = await request(app).get('/api/files/list?path=../..');
      // The actual path resolution in server.ts should prevent this and keep it within WORKSPACE_ROOT
      // If it resolves outside but is caught by startsWith check, it's 403.
      // If resolveUserPath returns null due to normalization leading outside, it's 403.
      expect(response.status).toBe(403);
    });

    it('should return 403 for invalid characters in path', async () => {
        const response = await request(app).get('/api/files/list?path=test_subdir/../../../../etc/passwd');
        expect(response.status).toBe(403); // Due to resolveUserPath returning null
    });

    it('should return 403 for null byte in path', async () => {
        const response = await request(app).get('/api/files/list?path=test%00file.txt');
        expect(response.status).toBe(403);
    });
  });

  describe('GET /api/files/content', () => {
    it('should get content of a file', async () => {
      const response = await request(app).get('/api/files/content?path=testfile.txt');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello test world');
    });

    it('should return 400 if path is a directory', async () => {
      const response = await request(app).get('/api/files/content?path=test_subdir');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Path is a directory, not a file.');
    });

    it('should return 404 for a non-existent file', async () => {
      const response = await request(app).get('/api/files/content?path=nonexistent.txt');
      expect(response.status).toBe(404);
    });

    it('should return 403 for trying to access files outside workspace', async () => {
      const response = await request(app).get('/api/files/content?path=../../../../some_other_file');
      expect(response.status).toBe(403);
    });

    // it('should return 413 if file is too large', async () => {
    //   // This test requires 'largefile.txt' to be created and server's MAX_FILE_SIZE_BYTES to be set appropriately
    //   const response = await request(app).get('/api/files/content?path=largefile.txt');
    //   expect(response.status).toBe(413);
    //   expect(response.body.error).toMatch(/File is too large/);
    // });
  });
});
