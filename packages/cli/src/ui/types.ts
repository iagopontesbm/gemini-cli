/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResultDisplay } from '@gemini-code/server';

export enum ToolCallStatus {
  Pending = 'Pending',
  Invoked = 'Invoked',
  Success = 'Success',
  Error = 'Error',
}

export interface IndividualToolCallDisplay {
  callId: string;
  name: string;
  description: string;
  resultDisplay: ToolResultDisplay | undefined;
  status: ToolCallStatus;
}

export interface HistoryItemBase {
  id: number;
  text?: string; // Text content for user/gemini/info/error messages
}

export type HistoryItem = HistoryItemBase &
  (
    | { type: 'user'; text: string }
    | { type: 'gemini'; text: string }
    | { type: 'info'; text: string }
    | { type: 'error'; text: string }
    | { type: 'tool_group'; tools: IndividualToolCallDisplay[] }
  );
