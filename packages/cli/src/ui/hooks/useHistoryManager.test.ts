/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistoryManager.js';
import { HistoryItem, HistoryItemUser } from '../types.js';

describe('useHistoryManager', () => {
  it('should initialize with an empty history and no pending item', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
    expect(result.current.pendingItem).toBeUndefined();
  });

  it('should add an item directly to history with a unique ID using addItem', () => {
    const { result } = renderHook(() => useHistory());
    const timestamp = Date.now();
    const itemData: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'Hello from addItem',
    };

    let itemId!: number;
    act(() => {
      itemId = result.current.addItem(itemData, timestamp);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(
      expect.objectContaining({
        ...itemData,
        id: itemId,
      }),
    );
    expect(result.current.pendingItem).toBeUndefined(); // addItem should not affect pendingItem
    expect(itemId).toBeGreaterThanOrEqual(timestamp);
  });

  it('should generate unique IDs for items added with the same base timestamp via addItem', () => {
    const { result } = renderHook(() => useHistory());
    const timestamp = Date.now();
    const itemData1: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'First',
    };
    const itemData2: Omit<HistoryItemUser, 'id'> = {
      type: 'user', // Changed to user for simplicity, can be any valid type
      text: 'Second',
    };

    let id1!: number;
    let id2!: number;

    act(() => {
      id1 = result.current.addItem(itemData1, timestamp);
      id2 = result.current.addItem(itemData2, timestamp);
    });

    expect(result.current.items).toHaveLength(2);
    expect(id1).not.toEqual(id2);
    expect(result.current.items[0].id).toEqual(id1);
    expect(result.current.items[1].id).toEqual(id2);
    expect(id2).toBeGreaterThan(id1);
  });

  it('should set a new pending item with a temporary ID', () => {
    const { result } = renderHook(() => useHistory());
    const itemData: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'Pending item',
    };

    act(() => {
      result.current.setPendingItem(itemData);
    });

    expect(result.current.pendingItem).toEqual(
      expect.objectContaining({
        ...itemData,
        id: 0, // Pending items have a temporary ID of 0
      }),
    );
    expect(result.current.items).toEqual([]); // History should not be affected
  });

  it('should update an existing pending item using the updater function', () => {
    const { result } = renderHook(() => useHistory());
    const initialPendingItem: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'Initial pending',
    };

    act(() => {
      result.current.setPendingItem(initialPendingItem);
    });

    const updatedText = 'Updated pending text';
    act(() => {
      result.current.setPendingItem((prev) => {
        if (!prev) return undefined; // Return undefined instead of null
        return { ...prev, text: updatedText } as HistoryItem; // Cast if necessary for specific subtypes
      });
    });

    expect(result.current.pendingItem).toEqual(
      expect.objectContaining({
        ...initialPendingItem,
        id: 0, // Pending items have a temporary ID of 0
        text: updatedText,
      }),
    );
    expect(result.current.items).toEqual([]);
  });

  it('should clear pending item if updater function returns undefined', () => {
    // Changed from null to undefined
    const { result } = renderHook(() => useHistory());
    const itemData: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'To be cleared',
    };

    act(() => {
      result.current.setPendingItem(itemData);
    });
    expect(result.current.pendingItem).not.toBeUndefined(); // Check against undefined

    act(() => {
      result.current.setPendingItem(() => undefined); // Return undefined
    });

    expect(result.current.pendingItem).toBeUndefined(); // Expect undefined
  });

  it('should commit a pending item to history and return its new ID', () => {
    const { result } = renderHook(() => useHistory());
    const pendingData: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'Committing this',
    };

    act(() => {
      result.current.setPendingItem(pendingData);
    });

    expect(result.current.pendingItem).not.toBeUndefined();
    expect(result.current.pendingItem?.id).toBe(0);
    expect(result.current.items).toEqual([]);

    let committedId!: number;
    act(() => {
      committedId = result.current.commitPendingItem();
    });

    expect(result.current.pendingItem).toBeUndefined();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(
      expect.objectContaining({
        ...pendingData,
        id: committedId,
      }),
    );
    expect(committedId).toBeGreaterThanOrEqual(Date.now()); // Or a more precise check if needed
  });

  it('commitPendingItem should do nothing if no pending item exists', () => {
    const { result } = renderHook(() => useHistory());

    expect(result.current.pendingItem).toBeUndefined();
    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.commitPendingItem();
    });

    expect(result.current.pendingItem).toBeUndefined();
    expect(result.current.items).toEqual([]);
  });

  it('should clear the history and pending item', () => {
    const { result } = renderHook(() => useHistory());
    const timestamp = Date.now();
    const itemData1: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'First in history',
    };
    const pendingData: Omit<HistoryItemUser, 'id'> = {
      type: 'user',
      text: 'I am pending',
    };

    act(() => {
      result.current.addItem(itemData1, timestamp);
      result.current.setPendingItem(pendingData);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.pendingItem).not.toBeUndefined();

    act(() => {
      result.current.clear();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.pendingItem).toBeUndefined();
  });

  it('ID counter should reset after clearHistory', () => {
    const { result } = renderHook(() => useHistory());
    const timestamp1 = Date.now();
    const item1: Omit<HistoryItemUser, 'id'> = { type: 'user', text: 'item1' };

    let id1!: number;
    act(() => {
      id1 = result.current.addItem(item1, timestamp1);
    });
    expect(result.current.items[0].id).toBe(id1);

    act(() => {
      result.current.clear();
    });

    const timestamp2 = Date.now() + 1000; // Ensure different base
    const item2: Omit<HistoryItemUser, 'id'> = { type: 'user', text: 'item2' };
    let id2!: number;
    act(() => {
      id2 = result.current.addItem(item2, timestamp2);
    });

    // Check if the counter part of the ID reset.
    // If timestamp1 and timestamp2 are very close, id1 and id2 might be similar.
    // A more robust check would be if id2 - timestamp2 is small (e.g., 1 or 2).
    expect(id2 - timestamp2).toBeLessThanOrEqual(id1 - timestamp1 + 1); // +1 because counter starts at 1
    // Or, if we know the counter starts at 1 after reset:
    expect(id2).toBe(timestamp2 + 1);
  });
});
