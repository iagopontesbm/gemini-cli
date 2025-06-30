/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

// A type to hold the state for the confirmation promise
interface ConfirmationState {
  model: string;
  resolver: (confirmed: boolean) => void;
}

export const useFallbackDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmationState | null>(null);

  const requestConfirmation = useCallback((fallbackModel: string): Promise<boolean> => new Promise<boolean>((resolve) => {
      setDialogState({ model: fallbackModel, resolver: resolve });
    }), []);

  const handleSelection = useCallback((confirmed: boolean) => {
    if (dialogState) {
      dialogState.resolver(confirmed);
      setDialogState(null); // Close dialog and clear state
    }
  }, [dialogState]);

  return {
    isFallbackDialogOpen: dialogState !== null,
    fallbackModel: dialogState?.model,
    requestFallbackConfirmation: requestConfirmation,
    handleFallbackSelection: handleSelection,
  };
};