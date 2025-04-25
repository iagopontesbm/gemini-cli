/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import * as fs from 'fs/promises';
import * as path from 'path';
import { isNodeError } from '@gemini-code/server';

export interface UseCompletionReturn {
  suggestions: string[];
  activeSuggestionIndex: number;
  showSuggestions: boolean;
  isLoadingSuggestions: boolean;
  setActiveSuggestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  resetCompletionState: () => void;
}

export function useCompletion(
  query: string,
  cwd: string,
  isActive: boolean,
): UseCompletionReturn {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] =
    useState<boolean>(false);

  const resetCompletionState = useCallback(() => {
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    setShowSuggestions(false);
    setIsLoadingSuggestions(false);
  }, []);

  useEffect(() => {
    if (!isActive) {
      resetCompletionState();
      return;
    }

    const atIndex = query.lastIndexOf('@');
    if (atIndex === -1) {
      resetCompletionState();
      return;
    }

    const partialPath = query.substring(atIndex + 1);
    const lastSlashIndex = partialPath.lastIndexOf('/');
    const baseDirRelative =
      lastSlashIndex === -1
        ? '.'
        : partialPath.substring(0, lastSlashIndex + 1);
    const prefix =
      lastSlashIndex === -1
        ? partialPath
        : partialPath.substring(lastSlashIndex + 1);
    const baseDirAbsolute = path.resolve(cwd, baseDirRelative);

    let isMounted = true;
    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const entries = await fs.readdir(baseDirAbsolute, {
          withFileTypes: true,
        });
        const filteredSuggestions = entries
          .filter((entry) => entry.name.startsWith(prefix))
          .map((entry) => (entry.isDirectory() ? entry.name + '/' : entry.name))
          .sort((a, b) => {
            // Sort directories first, then alphabetically
            const aIsDir = a.endsWith('/');
            const bIsDir = b.endsWith('/');
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
          });

        if (isMounted) {
          setSuggestions(filteredSuggestions);
          setShowSuggestions(filteredSuggestions.length > 0);
          setActiveSuggestionIndex(-1);
        }
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          // Directory doesn't exist, likely mid-typing, clear suggestions
          if (isMounted) {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } else {
          console.error(
            `Error fetching completion suggestions for ${baseDirAbsolute}:`,
            error,
          );
          if (isMounted) {
            resetCompletionState();
          }
        }
      }
      if (isMounted) {
        setIsLoadingSuggestions(false);
      }
    };

    // Debounce the fetch slightly
    const debounceTimeout = setTimeout(fetchSuggestions, 100);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimeout);
      // Don't reset loading state here, let the next effect handle it or resetCompletionState
    };
  }, [query, cwd, isActive, resetCompletionState]);

  return {
    suggestions,
    activeSuggestionIndex,
    showSuggestions,
    isLoadingSuggestions,
    setActiveSuggestionIndex,
    setShowSuggestions,
    resetCompletionState,
  };
}
