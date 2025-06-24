/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Testing utilities for simulating 429 errors and other API failures
 */

let requestCounter = 0;
let simulate429Enabled = false;
let simulate429AfterRequests = 0;
let simulate429ForAuthType: string | undefined;
let fallbackOccurred = false;

/**
 * Initialize 429 simulation based on environment variables
 */
export function initializeTestSimulation(): void {
  simulate429Enabled = process.env.GEMINI_CLI_SIMULATE_429 === 'true';
  simulate429AfterRequests = parseInt(
    process.env.SIMULATE_429_AFTER_N_REQUESTS || '0',
    10,
  );
  simulate429ForAuthType = process.env.SIMULATE_429_FOR_AUTH_TYPE;

  if (simulate429Enabled && process.env.DEBUG_FALLBACK_FLOW === 'true') {
    console.log('[DEBUG] 429 simulation enabled:', {
      afterRequests: simulate429AfterRequests,
      forAuthType: simulate429ForAuthType,
    });
  }
}

/**
 * Check if we should simulate a 429 error for the current request
 */
export function shouldSimulate429(authType?: string): boolean {
  if (!simulate429Enabled || fallbackOccurred) {
    return false;
  }

  // If auth type filter is set, only simulate for that auth type
  if (simulate429ForAuthType && authType !== simulate429ForAuthType) {
    return false;
  }

  requestCounter++;

  // If afterRequests is set, only simulate after that many requests
  if (simulate429AfterRequests > 0) {
    return requestCounter > simulate429AfterRequests;
  }

  // Otherwise, simulate for every request
  return true;
}

/**
 * Reset the request counter (useful for tests)
 */
export function resetRequestCounter(): void {
  requestCounter = 0;
}

/**
 * Disable 429 simulation after successful fallback
 */
export function disableSimulationAfterFallback(): void {
  fallbackOccurred = true;
  if (process.env.DEBUG_FALLBACK_FLOW === 'true') {
    console.log('[DEBUG] 429 simulation disabled after successful fallback');
  }
}

/**
 * Create a simulated 429 error response
 */
export function createSimulated429Error(): Error {
  const error = new Error('Rate limit exceeded (simulated)') as Error & {
    status: number;
  };
  error.status = 429;
  return error;
}

/**
 * Reset simulation state when switching auth methods
 */
export function resetSimulationState(): void {
  fallbackOccurred = false;
  resetRequestCounter();
  if (process.env.DEBUG_FALLBACK_FLOW === 'true') {
    console.log('[DEBUG] Simulation state reset for auth method switch');
  }
}

/**
 * Enable/disable 429 simulation programmatically (for tests)
 */
export function setSimulate429(enabled: boolean, afterRequests = 0): void {
  simulate429Enabled = enabled;
  simulate429AfterRequests = afterRequests;
  fallbackOccurred = false; // Reset fallback state when simulation is re-enabled
  resetRequestCounter();
}

// Initialize on module load
initializeTestSimulation();
