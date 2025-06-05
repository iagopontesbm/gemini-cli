/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';
import { CodeParserTool, CodeParserToolParams } from './code_parser.js';
import { Config } from '../config/config.js';
import fs from 'fs/promises';
import { Stats } from 'fs'; // Added Stats import
import path from 'path';
import os from 'os';
import actualFs from 'fs'; // For actual fs operations in setup

// Mock fs/promises
vi.mock('fs/promises');

// Mock tree-sitter and its language grammars
const mockTreeSitterParse = vi.fn();
const mockSetLanguage = vi.fn();

vi.mock('tree-sitter', () => ({
  default: vi.fn().mockImplementation(() => ({
    setLanguage: mockSetLanguage,
    parse: mockTreeSitterParse,
  })),
}));

const mockPythonGrammar = vi.hoisted(() => ({ name: 'python' }));
const mockJavaGrammar = vi.hoisted(() => ({ name: 'java' }));
const mockGoGrammar = vi.hoisted(() => ({ name: 'go' }));
const mockCSharpGrammar = vi.hoisted(() => ({ name: 'csharp' }));
vi.mock('tree-sitter-python', () => ({ default: mockPythonGrammar }));
vi.mock('tree-sitter-java', () => ({ default: mockJavaGrammar }));
vi.mock('tree-sitter-go', () => ({ default: mockGoGrammar }));
vi.mock('tree-sitter-c-sharp', () => ({ default: mockCSharpGrammar }));

describe('CodeParserTool', () => {
  let tempRootDir: string;
  let tool: CodeParserTool;
  let mockConfig: Config;
  const abortSignal = new AbortController().signal;

  // Use Mocked type for fs/promises
  let mockFs: Mocked<typeof fs>;

  beforeEach(() => {
    // Create a unique temporary root directory for each test run
    // Ensure the path is absolute and normalized for consistent behavior
    const tempDirPrefix = path.join(os.tmpdir(), 'code-parser-tool-root-');
    tempRootDir = actualFs.mkdtempSync(tempDirPrefix);

    // Normalize tempRootDir to avoid issues with path comparisons
    tempRootDir = path.resolve(tempRootDir);

    mockConfig = {
      get: vi.fn(),
    } as unknown as Config;
    tool = new CodeParserTool(tempRootDir, mockConfig);

    // Assign mocked fs/promises
    mockFs = fs as Mocked<typeof fs>;

    // Reset mocks before each test
    mockTreeSitterParse.mockReset();
    mockSetLanguage.mockReset();
    mockFs.stat.mockReset();
    mockFs.readFile.mockReset();
    mockFs.readdir.mockReset();

    // Default mock implementations
    mockTreeSitterParse.mockReturnValue({
      rootNode: { toString: () => '(mock_ast)' },
    });
  });

  afterEach(() => {
    // Clean up the temporary root directory
    if (actualFs.existsSync(tempRootDir)) {
      actualFs.rmSync(tempRootDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('constructor and schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('code_parser');
    });

    it('should have correct schema definition', () => {
      const schema = tool.schema.parameters!; // Added non-null assertion
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('path');
      expect(schema.properties!.path.type).toBe('string');
      expect(schema.properties!.path.description).toContain('absolute path');
      expect(schema.properties).toHaveProperty('ignore');
      expect(schema.properties!.ignore.type).toBe('array');
      expect(schema.properties).toHaveProperty('languages');
      expect(schema.properties!.languages.type).toBe('array');
      expect(schema.properties!.languages.description).toContain('go');
      expect(schema.properties!.languages.description).toContain('csharp'); // Check for new language in description
      expect(schema.required).toEqual(['path']);
    });
  });

  describe('validateToolParams', () => {
    it('should return null for valid absolute path within root', () => {
      const params: CodeParserToolParams = {
        path: path.join(tempRootDir, 'file.py'),
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('should return null for valid path with ignore and languages', () => {
      const params: CodeParserToolParams = {
        path: path.join(tempRootDir, 'dir'),
        ignore: ['*.log'],
        languages: ['python', 'go', 'csharp'],
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('should return error for relative path', () => {
      const params: CodeParserToolParams = { path: 'file.py' };
      expect(tool.validateToolParams(params)).toMatch(/Path must be absolute/);
    });

    it('should return error for path outside root directory', () => {
      // Create a path that is guaranteed to be outside tempRootDir
      const outsidePath = path.resolve(
        os.tmpdir(),
        'some-other-dir',
        'file.py',
      );
      // Ensure outsidePath is not accidentally inside tempRootDir (e.g. if os.tmpdir() is tempRootDir's parent)
      if (outsidePath.startsWith(tempRootDir)) {
        // This case should ideally not happen with standard os.tmpdir() behavior
        console.warn(
          'Skipping outside root test due to overlapping temp/outside paths',
        );
        return;
      }
      const params: CodeParserToolParams = { path: outsidePath };
      expect(tool.validateToolParams(params)).toMatch(
        /Path must be within the root directory/,
      );
    });

    it('should return error if languages is not an array of strings', () => {
      const params = {
        path: path.join(tempRootDir, 'file.py'),
        languages: [123],
      } as unknown as CodeParserToolParams;
      expect(tool.validateToolParams(params)).toBe(
        'Languages parameter must be an array of strings.',
      );
    });

    it('should return error for schema validation failure (e.g., missing path)', () => {
      const params = { ignore: [] } as unknown as CodeParserToolParams;
      expect(tool.validateToolParams(params)).toBe(
        'Parameters failed schema validation.',
      );
    });
  });

  describe('getDescription', () => {
    it('should return "Parse <shortened_relative_path>"', () => {
      const filePath = path.join(tempRootDir, 'src', 'app', 'main.py');
      const params: CodeParserToolParams = { path: filePath };
      // Relative path is src/app/main.py
      expect(tool.getDescription(params)).toBe('Parse src/app/main.py');
    });
  });

  describe('execute', () => {
    // --- Error Handling Tests ---
    it('should return validation error if params are invalid', async () => {
      const params: CodeParserToolParams = { path: 'relative/path.txt' };
      const result = await tool.execute(params, abortSignal);
      expect(result.llmContent).toMatch(
        /Error: Invalid parameters provided. Reason: Path must be absolute/,
      );
      expect(result.returnDisplay).toBe('Error: Failed to execute tool.');
    });

    it('should return error if target path does not exist', async () => {
      const targetPath = path.join(tempRootDir, 'nonexistent.py');
      mockFs.stat.mockRejectedValue({
        code: 'ENOENT',
      } as NodeJS.ErrnoException);
      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);
      expect(result.llmContent).toMatch(
        /Error: Path not found or inaccessible/,
      );
      expect(result.returnDisplay).toMatch(
        /Error: Path not found or inaccessible/,
      );
    });

    it('should return error if target path is not a file or directory', async () => {
      const targetPath = path.join(tempRootDir, 'neither_file_nor_dir');
      // Mock fs.stat to return stats that are neither file nor directory
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => false,
        size: 0,
      } as Stats);
      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);
      expect(result.llmContent).toMatch(
        /Error: Path is not a file or directory/,
      );
      expect(result.returnDisplay).toMatch(
        /Error: Path is not a file or directory/,
      );
    });

    it('should return error if no supported languages are specified or available', async () => {
      const targetPath = path.join(tempRootDir, 'file.py');
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 100,
      } as Stats);
      // Mock getLanguageParser to always return undefined for the specified/default languages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalGetLanguageParser = (tool as any).getLanguageParser;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tool as any).getLanguageParser = vi.fn().mockReturnValue(undefined);

      const params: CodeParserToolParams = {
        path: targetPath,
        languages: ['fantasy-lang'],
      };
      const result = await tool.execute(params, abortSignal);
      expect(result.llmContent).toMatch(
        /Error: No supported languages specified for parsing/,
      );
      expect(result.returnDisplay).toMatch(
        /Error: No supported languages to parse/,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tool as any).getLanguageParser = originalGetLanguageParser; // Restore
    });

    // --- Single File Parsing Tests ---
    it('should parse a single Python file successfully', async () => {
      const targetPath = path.join(tempRootDir, 'test.py');
      const fileContent = 'print("hello")';
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileContent.length,
      } as Stats);
      mockFs.readFile.mockResolvedValue(fileContent);
      mockTreeSitterParse.mockReturnValue({
        rootNode: { toString: () => '(python_ast)' },
      });

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(mockSetLanguage).toHaveBeenCalledWith(mockPythonGrammar);
      expect(mockTreeSitterParse).toHaveBeenCalledWith(fileContent);
      expect(result.llmContent).toBe(
        `Parsed code from ${targetPath}:\n-------------${targetPath}-------------\n(python_ast)\n`,
      );
      expect(result.returnDisplay).toBe('Parsed 1 file(s).');
    });

    it('should parse a single Java file successfully', async () => {
      const targetPath = path.join(tempRootDir, 'Test.java');
      const fileContent = 'class Test {}';
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileContent.length,
      } as Stats);
      mockFs.readFile.mockResolvedValue(fileContent);
      mockTreeSitterParse.mockReturnValue({
        rootNode: { toString: () => '(java_ast)' },
      });

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(mockSetLanguage).toHaveBeenCalledWith(mockJavaGrammar);
      expect(mockTreeSitterParse).toHaveBeenCalledWith(fileContent);
      expect(result.llmContent).toBe(
        `Parsed code from ${targetPath}:\n-------------${targetPath}-------------\n(java_ast)\n`,
      );
      expect(result.returnDisplay).toBe('Parsed 1 file(s).');
    });

    it('should parse a single Go file successfully', async () => {
      const targetPath = path.join(tempRootDir, 'main.go');
      const fileContent = 'package main\nfunc main(){}';
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileContent.length,
      } as Stats);
      mockFs.readFile.mockResolvedValue(fileContent);
      mockTreeSitterParse.mockReturnValue({
        rootNode: { toString: () => '(go_ast)' },
      });

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(mockSetLanguage).toHaveBeenCalledWith(mockGoGrammar);
      expect(mockTreeSitterParse).toHaveBeenCalledWith(fileContent);
      expect(result.llmContent).toBe(
        `Parsed code from ${targetPath}:\n-------------${targetPath}-------------\n(go_ast)\n`,
      );
      expect(result.returnDisplay).toBe('Parsed 1 file(s).');
    });

    it('should parse a single C# file successfully', async () => {
      const targetPath = path.join(tempRootDir, 'Program.cs');
      const fileContent =
        'namespace HelloWorld { class Program { static void Main(string[] args) { System.Console.WriteLine("Hello World!"); } } }';
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileContent.length,
      } as Stats);
      mockFs.readFile.mockResolvedValue(fileContent);
      mockTreeSitterParse.mockReturnValue({
        rootNode: { toString: () => '(csharp_ast)' },
      });

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(mockSetLanguage).toHaveBeenCalledWith(mockCSharpGrammar);
      expect(mockTreeSitterParse).toHaveBeenCalledWith(fileContent);
      expect(result.llmContent).toBe(
        `Parsed code from ${targetPath}:\n-------------${targetPath}-------------\n(csharp_ast)\n`,
      );
      expect(result.returnDisplay).toBe('Parsed 1 file(s).');
    });

    it('should return error for unsupported file type if specified directly', async () => {
      const targetPath = path.join(tempRootDir, 'notes.txt');
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 10,
      } as Stats);

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toMatch(
        /Error: File .* is not of a supported language type/,
      );
      expect(result.returnDisplay).toMatch(
        /Error: Unsupported file type or language/,
      );
    });

    it('should skip file if it exceeds maxFileSize', async () => {
      const targetPath = path.join(tempRootDir, 'large.py');
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024 * 1024 + 1,
      } as Stats); // 1MB + 1 byte

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(result.llmContent).toMatch(
        /Error: Could not parse file .*large.py/,
      );
      expect(result.returnDisplay).toBe('Error: Failed to parse file.');
    });

    it('should return error if parsing a supported file fails internally', async () => {
      const targetPath = path.join(tempRootDir, 'broken.py');
      const fileContent = 'print("hello")';
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: fileContent.length,
      } as Stats);
      mockFs.readFile.mockResolvedValue(fileContent);
      mockTreeSitterParse.mockImplementation(() => {
        throw new Error('TreeSitterCrashed');
      });

      const params: CodeParserToolParams = { path: targetPath };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toMatch(
        /Error: Could not parse file .*broken.py/,
      );
      expect(result.returnDisplay).toMatch(/Error: Failed to parse file./);
    });

    // --- Directory Parsing Tests ---
    it('should parse supported files in a directory (including Go and C#)', async () => {
      const dirPath = path.join(tempRootDir, 'src');
      const files = [
        'main.py',
        'helper.java',
        'service.go',
        'App.cs',
        'config.txt',
      ];
      const pythonContent = 'import os';
      const javaContent = 'public class Helper {}';
      const goContent = 'package main';
      const csharpContent = 'public class App {}';

      mockFs.stat.mockImplementation(async (p) => {
        if (p === dirPath)
          return { isFile: () => false, isDirectory: () => true } as Stats;
        if (p === path.join(dirPath, 'main.py'))
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: pythonContent.length,
          } as Stats;
        if (p === path.join(dirPath, 'helper.java'))
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: javaContent.length,
          } as Stats;
        if (p === path.join(dirPath, 'service.go'))
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: goContent.length,
          } as Stats;
        if (p === path.join(dirPath, 'App.cs'))
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: csharpContent.length,
          } as Stats;
        if (p === path.join(dirPath, 'config.txt'))
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: 10,
          } as Stats;
        throw { code: 'ENOENT' };
      });
      mockFs.readdir.mockResolvedValue(files as string[]);
      mockFs.readFile.mockImplementation(async (p) => {
        if (p === path.join(dirPath, 'main.py')) return pythonContent;
        if (p === path.join(dirPath, 'helper.java')) return javaContent;
        if (p === path.join(dirPath, 'service.go')) return goContent;
        if (p === path.join(dirPath, 'App.cs')) return csharpContent;
        return '';
      });
      mockTreeSitterParse.mockImplementation((content) => {
        if (content === pythonContent)
          return { rootNode: { toString: () => '(py_ast_dir)' } };
        if (content === javaContent)
          return { rootNode: { toString: () => '(java_ast_dir)' } };
        if (content === goContent)
          return { rootNode: { toString: () => '(go_ast_dir)' } };
        if (content === csharpContent)
          return { rootNode: { toString: () => '(csharp_ast_dir)' } };
        return { rootNode: { toString: () => '(other_ast)' } };
      });

      const params: CodeParserToolParams = { path: dirPath };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toContain(
        `-------------${path.join(dirPath, 'main.py')}-------------\n(py_ast_dir)\n`,
      );
      expect(result.llmContent).toContain(
        `-------------${path.join(dirPath, 'helper.java')}-------------\n(java_ast_dir)\n`,
      );
      expect(result.llmContent).toContain(
        `-------------${path.join(dirPath, 'service.go')}-------------\n(go_ast_dir)\n`,
      );
      expect(result.llmContent).toContain(
        `-------------${path.join(dirPath, 'App.cs')}-------------\n(csharp_ast_dir)\n`,
      );
      expect(result.llmContent).not.toContain('config.txt');
      expect(result.returnDisplay).toBe('Parsed 4 file(s).');
    });

    it('should ignore files specified in ignore patterns during directory parsing', async () => {
      const dirPath = path.join(tempRootDir, 'project');
      const files = [
        'app.py',
        'ignore_me.py',
        'data.java',
        'main.go',
        'Util.cs',
      ];
      mockFs.stat.mockImplementation(async (p) => {
        if (p === dirPath)
          return { isFile: () => false, isDirectory: () => true } as Stats;
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: 10,
        } as Stats; // Generic for files
      });
      mockFs.readdir.mockResolvedValue(files as string[]);
      mockFs.readFile.mockResolvedValue('content'); // Generic content

      const params: CodeParserToolParams = {
        path: dirPath,
        ignore: ['ignore_me.py', 'main.go', 'Util.cs'],
      };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toContain(path.join(dirPath, 'app.py'));
      expect(result.llmContent).toContain(path.join(dirPath, 'data.java'));
      expect(result.llmContent).not.toContain(
        path.join(dirPath, 'ignore_me.py'),
      );
      expect(result.llmContent).not.toContain(path.join(dirPath, 'main.go'));
      expect(result.llmContent).not.toContain(path.join(dirPath, 'Util.cs'));
      expect(result.returnDisplay).toBe('Parsed 2 file(s).');
    });

    it('should only parse languages specified in the languages parameter for directory', async () => {
      const dirPath = path.join(tempRootDir, 'mixed_lang_project');
      const files = [
        'script.py',
        'Main.java',
        'another.py',
        'app.go',
        'Logic.cs',
      ];
      mockFs.stat.mockImplementation(async (p) => {
        if (p === dirPath)
          return { isFile: () => false, isDirectory: () => true } as Stats;
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: 10,
        } as Stats;
      });
      mockFs.readdir.mockResolvedValue(files as string[]);
      mockFs.readFile.mockResolvedValue('content');

      const params: CodeParserToolParams = {
        path: dirPath,
        languages: ['java', 'go', 'csharp'],
      };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toContain(path.join(dirPath, 'Main.java'));
      expect(result.llmContent).toContain(path.join(dirPath, 'app.go'));
      expect(result.llmContent).toContain(path.join(dirPath, 'Logic.cs'));
      expect(result.llmContent).not.toContain('script.py');
      expect(result.llmContent).not.toContain('another.py');
      expect(result.returnDisplay).toBe('Parsed 3 file(s).');
    });

    it('should return "Directory is empty" for an empty directory', async () => {
      const dirPath = path.join(tempRootDir, 'empty_dir');
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as Stats);
      mockFs.readdir.mockResolvedValue([]);

      const params: CodeParserToolParams = { path: dirPath };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toBe(`Directory ${dirPath} is empty.`);
      expect(result.returnDisplay).toBe('Directory is empty.');
    });

    it('should return "No files parsed" if directory contains only unsupported or ignored files', async () => {
      const dirPath = path.join(tempRootDir, 'non_code_dir');
      const files = ['readme.md', 'ignored.log'];
      mockFs.stat.mockImplementation(async (p) => {
        if (p === dirPath)
          return { isFile: () => false, isDirectory: () => true } as Stats;
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: 10,
        } as Stats;
      });
      mockFs.readdir.mockResolvedValue(files as string[]);

      const params: CodeParserToolParams = { path: dirPath, ignore: ['*.log'] };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toMatch(/No files were parsed/);
      expect(result.returnDisplay).toBe('No files parsed.');
    });

    it('should handle error if fs.readdir fails', async () => {
      const dirPath = path.join(tempRootDir, 'unreadable_dir');
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as Stats);
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const params: CodeParserToolParams = { path: dirPath };
      const result = await tool.execute(params, abortSignal);

      expect(result.llmContent).toMatch(
        /Error listing or processing directory/,
      );
      expect(result.returnDisplay).toMatch(
        /Error: Failed to process directory./,
      );
    });
  });

  describe('requiresConfirmation', () => {
    it('should return null', async () => {
      const params: CodeParserToolParams = { path: 'anypath' };
      expect(await tool.requiresConfirmation(params)).toBeNull();
    });
  });
});
