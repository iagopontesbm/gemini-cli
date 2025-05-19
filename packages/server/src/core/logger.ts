/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import sqlite3 from 'sqlite3';
import { promises as fs } from 'node:fs';

const GEMINI_DIR = '.gemini';
const DB_NAME = 'logs.db';
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS messages (
    session_id TEXT,
    message_id TEXT,
    timestamp TEXT,
    type TEXT,
    message TEXT
);`;

export class Logger {
  private static instance: Logger;
  private db: sqlite3.Database | null = null;
  private sessionId: number | null = null;
  private messageId: number | null = null;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      Logger.instance.initialize().catch((error) => {
        console.error('Failed to initialize logger:', error);
      });
    }
    return Logger.instance;
  }

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      const DB_DIR = path.resolve(process.cwd(), GEMINI_DIR);
      const DB_PATH = path.join(DB_DIR, DB_NAME);
      await fs.mkdir(DB_DIR, { recursive: true });

      this.sessionId = Math.floor(Date.now() / 1000);
      this.messageId = 0;

      this.db = new sqlite3.Database(DB_PATH, (err: Error | null) => {
        if (err) {
          throw err;
        } 
      });

      // Read and execute the SQL script in create_tables.sql
      this.db.exec(CREATE_TABLE_SQL, (err: Error | null) => {
        if (err) {
          this.db!.close();
          throw err;
        }
      });

    } catch (error) {
      console.error('TLDAEU Error initializing database:', error);
      this.db = null;
      throw error;
    }
  }

  /**
   * Get list of previous user inputs sorted most recent first.
   * @returns list of messages.
   */
  async getPreviousMessages(): Promise<string[]> {
    if (!this.db) {
      console.error('Database not initialized.');
      return [];
    }

    return new Promise((resolve, reject) => {
      // Most recent messages first
      const query = `SELECT message FROM messages 
      WHERE type = 'user'
      ORDER BY session_id DESC, message_id DESC`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.db!.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) {
          console.error('Error querying database:', err.message);
          reject(err);
        } else {
          resolve(rows.map((row) => row.message));
        }
      });
    });
  }

  async logMessage(
    type: string,
    message: string,
  ): Promise<void> {
    if (!this.db) {
      console.error('Database not initialized.');
      return;
    }

    return new Promise((resolve, reject) => {
      const query = `INSERT INTO messages (session_id, message_id, type, message, timestamp) VALUES (?, ?, ?, ?, datetime('now'))`;
      this.messageId = this.messageId! + 1;
      this.db!.run(
        query,
        [this.sessionId || 0, this.messageId - 1, type, message],
        function (err: Error | null) {
          if (err) {
            console.error(
              'Error inserting message into database:',
              err.message,
            );
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  }

  close(): void {
    if (this.db) {
      this.db.close((err: Error | null) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
      });
      this.db = null;
    }
  }
}
