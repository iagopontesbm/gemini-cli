/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { HistoryItem } from '../types.js';

type PendingHistoryItem = HistoryItem | undefined;
type History = {
  items: HistoryItem[];
  pendingItem: PendingHistoryItem;
};

// Type for the updater function passed to setPendingItem
type PendingItemUpdater = (prevItem: PendingHistoryItem) => PendingHistoryItem;

const EMPTY_HISTORY: History = { items: [], pendingItem: undefined };

export interface UseHistoryManagerReturn {
  items: HistoryItem[];
  pendingItem?: HistoryItem;
  addItem: (
    itemData: Omit<HistoryItem, 'id'>,
    baseTimestamp?: number,
  ) => HistoryItem['id'];
  setPendingItem: {
    (nextPendingItem: Omit<HistoryItem, 'id'>): void;
    (updater: PendingItemUpdater): void;
  };
  commitPendingItem: () => HistoryItem['id'];
  clear: () => void;
}

/**
 * Custom hook to manage the chat history state, including a pending item.
 *
 * Encapsulates the history array, a pending item, message ID generation,
 * adding items directly to history, setting/updating the pending item,
 * committing the pending item to history, and clearing the history.
 */
export function useHistory(): UseHistoryManagerReturn {
  const [{ items, pendingItem }, setHistory] = useState<History>(EMPTY_HISTORY);
  const messageIdCounterRef = useRef(0);

  // Generates a unique message ID based on a timestamp and a counter.
  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  // Adds a new item directly to the history state with a unique ID.
  const addItem = useCallback(
    (
      itemData: Omit<HistoryItem, 'id'>,
      baseTimestamp: number = Date.now(),
    ): number => {
      const id = getNextMessageId(baseTimestamp);
      const newItem: HistoryItem = { ...itemData, id } as HistoryItem;
      setHistory((prev) => ({
        items: [...prev.items, newItem],
        pendingItem: prev.pendingItem,
      }));
      return id;
    },
    [getNextMessageId],
  );

  // Sets a new pending item or updates the existing one.
  const setPendingItem = useCallback(
    (
      nextPendingItem:
        | Omit<HistoryItem, 'id'>
        | ((
            prevPendingItem: HistoryItem | undefined,
          ) => HistoryItem | undefined),
    ): void =>
      setHistory((prev) => ({
        items: prev.items,
        pendingItem:
          typeof nextPendingItem === 'function'
            ? nextPendingItem(prev.pendingItem)
            : ({ id: 0, ...nextPendingItem } as HistoryItem),
      })),
    [],
  );

  // Commits the current pending item to the history.
  const commitPendingItem = useCallback(() => {
    const id = getNextMessageId(Date.now());
    setHistory((prev) => {
      if (!prev.pendingItem) {
        return prev; // No pending item to commit
      }
      const nextItem: HistoryItem = {
        ...prev.pendingItem,
        id,
      };
      return {
        items: [...prev.items, nextItem],
        pendingItem: undefined,
      };
    });
    return id;
  }, [getNextMessageId, setHistory]);

  // Clears the entire history state (both committed and pending) and resets the ID counter.
  const clear = useCallback(() => {
    setHistory(EMPTY_HISTORY);
    messageIdCounterRef.current = 0;
  }, []);

  return {
    items,
    pendingItem,
    addItem,
    setPendingItem,
    commitPendingItem,
    clear,
  };
}
