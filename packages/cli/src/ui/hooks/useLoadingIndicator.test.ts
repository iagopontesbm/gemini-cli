/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLoadingIndicator } from './useLoadingIndicator.js';
import { StreamingState } from '../types.js';
import { WITTY_LOADING_PHRASES } from '../constants.js';

// Define the mock functions before they are used in vi.mock
const mockUseTimerActual = vi.fn();
const mockUsePhraseCyclerActual = vi.fn();

vi.mock('./useTimer.js', () => ({
  useTimer: (...args: unknown[]) => mockUseTimerActual(...args),
}));

vi.mock('./usePhraseCycler.js', () => ({
  usePhraseCycler: (...args: unknown[]) => mockUsePhraseCyclerActual(...args),
}));

describe('useLoadingIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockUseTimerActual.mockReturnValue(0);
    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[0]);
  });

  it('should initialize with default values when Idle', () => {
    const { result } = renderHook(() =>
      useLoadingIndicator(StreamingState.Idle),
    );
    expect(mockUseTimerActual).toHaveBeenCalledWith(false, expect.any(Number));
    expect(mockUsePhraseCyclerActual).toHaveBeenCalledWith(false, false);
    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.currentLoadingPhrase).toBe(WITTY_LOADING_PHRASES[0]);
  });

  it('should reflect values when Responding', () => {
    mockUseTimerActual.mockReturnValue(5);
    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[1]);

    const { result } = renderHook(() =>
      useLoadingIndicator(StreamingState.Responding),
    );

    expect(mockUseTimerActual).toHaveBeenCalledWith(true, expect.any(Number));
    expect(mockUsePhraseCyclerActual).toHaveBeenCalledWith(true, false);
    expect(result.current.elapsedTime).toBe(5);
    expect(result.current.currentLoadingPhrase).toBe(WITTY_LOADING_PHRASES[1]);
  });

  it('should show waiting phrase and retain elapsedTime when WaitingForConfirmation', () => {
    const timerValueForMock = 3; // Initial timer value when responding
    const initialMockResetKey = 0;

    mockUseTimerActual.mockImplementation(
      (/*isActive, resetKey*/) => timerValueForMock,
    );
    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[0]);

    const { result, rerender } = renderHook(
      ({ streamingState }) => useLoadingIndicator(streamingState),
      { initialProps: { streamingState: StreamingState.Responding } },
    );
    expect(result.current.elapsedTime).toBe(3);

    mockUsePhraseCyclerActual.mockReturnValue(
      'Waiting for user confirmation...',
    );
    rerender({ streamingState: StreamingState.WaitingForConfirmation });

    expect(mockUseTimerActual).toHaveBeenCalledWith(false, initialMockResetKey);
    expect(mockUsePhraseCyclerActual).toHaveBeenCalledWith(false, true);
    expect(result.current.currentLoadingPhrase).toBe(
      'Waiting for user confirmation...',
    );
    expect(result.current.elapsedTime).toBe(3);
  });

  it('should reset elapsedTime and use initial phrase when transitioning from WaitingForConfirmation to Responding', () => {
    let timerValueForMock = 5;
    let mockResetKeyForTimerHook = 0; // Mimics the resetKey seen by the useTimer mock

    mockUseTimerActual.mockImplementation((isActive, resetKeyFromHook) => {
      if (resetKeyFromHook !== mockResetKeyForTimerHook) {
        timerValueForMock = 0; // Reset if the key changed
        mockResetKeyForTimerHook = resetKeyFromHook as number;
      }
      return timerValueForMock;
    });
    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[1]);

    const { result, rerender } = renderHook(
      ({ streamingState }) => useLoadingIndicator(streamingState),
      { initialProps: { streamingState: StreamingState.Responding } },
    );
    expect(result.current.elapsedTime).toBe(5);
    const firstCallDetails = mockUseTimerActual.mock.calls[0];
    const initialResetKey = firstCallDetails[1]; // Capture the initial resetKey

    mockUsePhraseCyclerActual.mockReturnValue(
      'Waiting for user confirmation...',
    );
    rerender({ streamingState: StreamingState.WaitingForConfirmation });
    expect(result.current.elapsedTime).toBe(5);
    expect(result.current.currentLoadingPhrase).toBe(
      'Waiting for user confirmation...',
    );
    // Ensure resetKey didn't change for Waiting state
    expect(mockUseTimerActual.mock.calls[1][1]).toBe(initialResetKey);

    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[0]);
    // This rerender will cause useLoadingIndicator to change its internal timerResetKey
    rerender({ streamingState: StreamingState.Responding });

    // Check that the resetKey for useTimer actually changed as expected by useLoadingIndicator
    const lastCallDetails =
      mockUseTimerActual.mock.calls[mockUseTimerActual.mock.calls.length - 1];
    expect(lastCallDetails[1]).not.toBe(initialResetKey);

    expect(mockUsePhraseCyclerActual).toHaveBeenCalledWith(true, false);
    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.currentLoadingPhrase).toBe(WITTY_LOADING_PHRASES[0]);
  });

  it('should reset timer and phrase when streamingState changes from Responding to Idle', () => {
    // timerValueForMock can be const as it's only set by the mock implementation logic based on resetKey
    const initialTimerValue = 10; // Used to set the initial state of the mock
    let timerValueForMock = initialTimerValue;
    let mockResetKeyForTimerHook = 0;

    mockUseTimerActual.mockImplementation((isActive, resetKeyFromHook) => {
      if (resetKeyFromHook !== mockResetKeyForTimerHook) {
        timerValueForMock = 0;
        mockResetKeyForTimerHook = resetKeyFromHook as number;
      }
      return isActive ? timerValueForMock : 0; // Return 0 if inactive for Idle state
    });
    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[2]);

    const { result, rerender } = renderHook(
      ({ streamingState }) => useLoadingIndicator(streamingState),
      { initialProps: { streamingState: StreamingState.Responding } },
    );
    expect(result.current.elapsedTime).toBe(10);
    const initialResetKey = mockUseTimerActual.mock.calls[0][1];

    mockUsePhraseCyclerActual.mockReturnValue(WITTY_LOADING_PHRASES[0]);
    rerender({ streamingState: StreamingState.Idle });

    const lastCallDetails =
      mockUseTimerActual.mock.calls[mockUseTimerActual.mock.calls.length - 1];
    expect(lastCallDetails[1]).not.toBe(initialResetKey); // Reset key should change for Idle

    expect(mockUsePhraseCyclerActual).toHaveBeenCalledWith(false, false);
    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.currentLoadingPhrase).toBe(WITTY_LOADING_PHRASES[0]);
  });
});
