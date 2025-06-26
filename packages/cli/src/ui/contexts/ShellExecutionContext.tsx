/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from 'react';

// --- Interface Definitions ---

export interface ShellExecutionState {
  isExecuting: boolean;
  startTime: number | null;
  commandText: string | null;
  abortController: AbortController | null;
  isLongRunning: boolean;
}

interface ShellExecutionContextValue {
  state: ShellExecutionState;
  startExecution: (command: string, abortController: AbortController) => void;
  endExecution: () => void;
  setLongRunning: (isLongRunning: boolean) => void;
  getExecutionTime: () => number;
}

// --- Context Definition ---

const ShellExecutionContext = createContext<
  ShellExecutionContextValue | undefined
>(undefined);

// --- Provider Component ---

export const ShellExecutionContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [state, setState] = useState<ShellExecutionState>({
    isExecuting: false,
    startTime: null,
    commandText: null,
    abortController: null,
    isLongRunning: false,
  });

  const startExecution = useCallback(
    (command: string, abortController: AbortController) => {
      setState({
        isExecuting: true,
        startTime: Date.now(),
        commandText: command,
        abortController,
        isLongRunning: false,
      });
    },
    [],
  );

  const endExecution = useCallback(() => {
    setState({
      isExecuting: false,
      startTime: null,
      commandText: null,
      abortController: null,
      isLongRunning: false,
    });
  }, []);

  const setLongRunning = useCallback((isLongRunning: boolean) => {
    setState((prev) => ({
      ...prev,
      isLongRunning,
    }));
  }, []);

  const getExecutionTime = useCallback(() => {
    if (!state.startTime || !state.isExecuting) {
      return 0;
    }
    return Date.now() - state.startTime;
  }, [state.startTime, state.isExecuting]);

  const value = useMemo(
    () => ({
      state,
      startExecution,
      endExecution,
      setLongRunning,
      getExecutionTime,
    }),
    [state, startExecution, endExecution, setLongRunning, getExecutionTime],
  );

  return (
    <ShellExecutionContext.Provider value={value}>
      {children}
    </ShellExecutionContext.Provider>
  );
};

// --- Consumer Hook ---

export const useShellExecution = () => {
  const context = useContext(ShellExecutionContext);
  if (context === undefined) {
    throw new Error(
      'useShellExecution must be used within a ShellExecutionContextProvider',
    );
  }
  return context;
}; 