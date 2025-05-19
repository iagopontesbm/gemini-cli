/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, RoleType } from './logger.js';

// Mocks
const mockDb = {
  exec: vi.fn((_sql, callback) => callback?.(null)),
  all: vi.fn((_sql, _params, callback) => callback?.(null, [])),
  run: vi.fn((_sql, _params, callback) => callback?.(null)),
  close: vi.fn((callback) => callback?.(null)),
};
vi.mock('sqlite3', () => ({
  Database: vi.fn(() => mockDb),
  default: {
    Database: vi.fn(() => mockDb),
  },
}));

describe('Logger', () => {
  let logger: Logger;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Get a new instance for each test to ensure isolation,
    // but we need to reset the singleton for this to work as expected.
    Logger.getInstance().close(); // Close any existing instance
    logger = Logger.getInstance();
    // We need to wait for the async initialize to complete
    await logger.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Logger.getInstance().close(); // Close the database connection after each test
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should execute create tables if not exists', async () => {
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE TABLE IF NOT EXISTS messages/),
        expect.any(Function),
      );
    });

    it('should be idempotent', async () => {
      mockDb.exec.mockClear();

      await logger.initialize(); // Second call

      expect(mockDb.exec).not.toHaveBeenCalled();
    });
  });

  describe('logMessage', () => {
    it('should insert a message into the database', async () => {
      const type = RoleType.USER;
      const message = 'Hello, world!';
      await logger.logMessage(type, message);
      expect(mockDb.run).toHaveBeenCalledWith(
        "INSERT INTO messages (session_id, message_id, type, message, timestamp) VALUES (?, ?, ?, ?, datetime('now'))",
        [expect.any(Number), 0, type, message], // sessionId, messageId, type, message
        expect.any(Function),
      );
    });

    it('should increment messageId for subsequent messages', async () => {
      await logger.logMessage(RoleType.USER, 'First message');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        [expect.any(Number), 0, RoleType.USER, 'First message'],
        expect.any(Function),
      );
      await logger.logMessage(RoleType.USER, 'Second message');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        [expect.any(Number), 1, RoleType.USER, 'Second message'], // messageId is now 1
        expect.any(Function),
      );
    });

    it('should handle database not initialized', async () => {
      Logger.getInstance().close();
      const uninitializedLogger = Logger.getInstance();
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await uninitializedLogger.logMessage(RoleType.USER, 'test');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Database not initialized.');
      expect(mockDb.run).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle error during db.run', async () => {
      const error = new Error('db.run failed');
      mockDb.run.mockImplementationOnce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_sql: any, _params: any, callback: any) => callback?.(error),
      );
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(logger.logMessage(RoleType.USER, 'test')).rejects.toThrow(
        'db.run failed',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error inserting message into database:',
        error.message,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getPreviousMessages', () => {
    it('should query the database for messages', async () => {
      mockDb.all.mockImplementationOnce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_sql: any, params: any, callback: any) =>
          callback?.(null, [{ message: 'msg1' }, { message: 'msg2' }]),
      );

      const messages = await logger.getPreviousMessages();

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT message FROM messages/),
        [],
        expect.any(Function),
      );
      expect(messages).toEqual(['msg1', 'msg2']);
    });

    it('should handle database not initialized', async () => {
      Logger.getInstance().close();
      const uninitializedLogger = Logger.getInstance();
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const messages = await uninitializedLogger.getPreviousMessages();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Database not initialized.');
      expect(messages).toEqual([]);
      expect(mockDb.all).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle error during db.all', async () => {
      const error = new Error('db.all failed');
      mockDb.all.mockImplementationOnce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_sql: any, _params: any, callback: any) => callback?.(error, []),
      );
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(logger.getPreviousMessages()).rejects.toThrow(
        'db.all failed',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error querying database:',
        error.message,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      logger.close();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle database not initialized', () => {
      Logger.getInstance().close();
      const uninitializedLogger = Logger.getInstance();

      uninitializedLogger.close();
      expect(() => uninitializedLogger.close()).not.toThrow();
    });

    it('should handle error during db.close', () => {
      const error = new Error('db.close failed');
      mockDb.close.mockImplementationOnce((callback: (error: Error) => void) =>
        callback?.(error),
      );
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      logger.close();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error closing database:',
        error.message,
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
