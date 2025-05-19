/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from './logger.js';
import sqlite3 from 'sqlite3';

// Mocks
vi.mock('sqlite3', () => {
  const mockDb = {
    exec: vi.fn((_sql, callback) => callback?.(null)),
    all: vi.fn((_sql, _params, callback) => callback?.(null, [])),
    run: vi.fn((_sql, _params, callback) => callback?.(null)),
    close: vi.fn((callback) => callback?.(null)),
  };
  return {
    Database: vi.fn(() => mockDb),
    default: {
        Database: vi.fn(() => mockDb),
    }
  };
});


describe('Logger', () => {
  let logger: Logger;
  let mockDbInstance: any;

  beforeEach(async () => {
    // Reset mocks for sqlite3.Database before each test
    // to ensure clean state for constructor and methods
    const actualSqlite3 = await vi.importActual('sqlite3') as any;
    const dbMock = {
        exec: vi.fn((_sql, callback) => {
            // console.log('mockDb.exec called with sql:', _sql);
            callback?.(null);
        }),
        all: vi.fn((_sql, _params, callback) => callback?.(null, [])),
        run: vi.fn((_sql, _params, callback) => {
            // console.log('mockDb.run called with sql:', _sql, _params);
            callback?.(null);
        }),
        close: vi.fn((callback) => callback?.(null) ),
    };
    (sqlite3.Database as any).mockImplementation(() => dbMock);
    mockDbInstance = dbMock;

    // Get a new instance for each test to ensure isolation,
    // but we need to reset the singleton for this to work as expected.
    (Logger as any).instance = undefined; 
    logger = Logger.getInstance();
    // We need to wait for the async initialize to complete
    await logger.initialize(); 
  });

  afterEach(() => {
    vi.clearAllMocks();
    Logger.getInstance().close(); // Close the database connection after each test
    (Logger as any).instance = undefined; // Clean up singleton
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
      expect(mockDbInstance.exec).toHaveBeenCalledWith(
        expect.stringMatching(/CREATE TABLE IF NOT EXISTS messages/),
        expect.any(Function));
    });
    
    it('should be idempotent', async () => {
        mockDbInstance.exec.mockClear();

        await logger.initialize(); // Second call

        expect(mockDbInstance.exec).not.toHaveBeenCalled();
    });
  });

  describe('logMessage', () => {
    it('should insert a message into the database', async () => {
      const type = 'user';
      const message = 'Hello, world!';
      await logger.logMessage(type, message);
      expect(mockDbInstance.run).toHaveBeenCalledWith(
        'INSERT INTO messages (session_id, message_id, type, message, timestamp) VALUES (?, ?, ?, ?, datetime(\'now\'))',
        [expect.any(Number), 0, type, message], // sessionId, messageId, type, message
        expect.any(Function)
      );
    });

    it('should increment messageId for subsequent messages', async () => {
      await logger.logMessage('user', 'First message');
      expect(mockDbInstance.run).toHaveBeenCalledWith(
        expect.any(String),
        [expect.any(Number), 0, 'user', 'First message'],
        expect.any(Function)
      );
      await logger.logMessage('gemini', 'Second message');
      expect(mockDbInstance.run).toHaveBeenCalledWith(
        expect.any(String),
        [expect.any(Number), 1, 'gemini', 'Second message'], // messageId is now 1
        expect.any(Function)
      );
    });

    it('should handle database not initialized', async () => {
      (Logger as any).instance = undefined; // Reset for fresh instance
      const uninitializedLogger = Logger.getInstance(); 
      // Prevent initialize from running or mock db to be null
      (uninitializedLogger as any).db = null;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await uninitializedLogger.logMessage('user', 'test');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Database not initialized.');
      expect(mockDbInstance.run).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle error during db.run', async () => {
        const error = new Error('db.run failed');
        mockDbInstance.run.mockImplementationOnce((_sql: any, _params: any, callback: any) => callback?.(error));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(logger.logMessage('user', 'test')).rejects.toThrow('db.run failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error inserting message into database:', error.message);
        consoleErrorSpy.mockRestore();
    });
  });

  describe('getPreviousMessages', () => {
    it('should query the database for messages', async () => {
      mockDbInstance.all.mockImplementationOnce((_sql: any, params: any, callback: any) => callback?.(null, [{ message: 'msg1' }, { message: 'msg2' }]));
      
      const messages = await logger.getPreviousMessages();
      
      expect(mockDbInstance.all).toHaveBeenCalledWith(
        "SELECT message FROM messages WHERE type = 'user' ORDER BY session_id DESC, message_id DESC",
        [],
        expect.any(Function)
      );
      expect(messages).toEqual(['msg1', 'msg2']);
    });

    it('should handle database not initialized', async () => {
      (Logger as any).instance = undefined; // Reset for fresh instance
      const uninitializedLogger = Logger.getInstance();
      (uninitializedLogger as any).db = null;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const messages = await uninitializedLogger.getPreviousMessages();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Database not initialized.');
      expect(messages).toEqual([]);
      expect(mockDbInstance.all).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle error during db.all', async () => {
        const error = new Error('db.all failed');
        mockDbInstance.all.mockImplementationOnce((_sql: any, _params: any, callback: any) => callback?.(error, []));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(logger.getPreviousMessages()).rejects.toThrow('db.all failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error querying database:', error.message);
        consoleErrorSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      logger.close();
      expect(mockDbInstance.close).toHaveBeenCalled();
    });

    it('should handle database not initialized', () => {
      (Logger as any).instance = undefined; // Reset for fresh instance
      const uninitializedLogger = Logger.getInstance();
      (uninitializedLogger as any).db = null; // Ensure db is null

      uninitializedLogger.close();
      expect(() => uninitializedLogger.close()).not.toThrow();
    });
    
    it('should handle error during db.close', () => {
        const error = new Error('db.close failed');
        mockDbInstance.close.mockImplementationOnce((callback: any) => callback?.(error));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        logger.close();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing database:', error.message);
        consoleErrorSpy.mockRestore();
    });
  });
});
