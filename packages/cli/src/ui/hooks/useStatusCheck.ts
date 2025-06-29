/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  type Config,
  AuthType,
  ApprovalMode,
  getAllGeminiMdFilenames,
} from '@google/gemini-cli-core';
import { LoadedSettings } from '../../config/settings.js';
import { getCliVersion } from '../../utils/version.js';
import os from 'node:os';

export type ConnectivityStatus = 'pending' | 'success' | 'error';

export interface StatusInfo {
  // Basic Info
  cliVersion: string;
  osPlatform: string;
  model: string;

  // Connectivity
  connectivity: ConnectivityStatus;
  error: string | null;
  isComplete: boolean;

  // Paths
  projectRoot: string;
  targetDirectory: string;
  settingsFiles: string[];

  // Context & Memory
  contextFiles: string[];
  userMemorySize: number;
  mcpServerCount: number;

  // Key Settings
  authType: string;
  debugMode: boolean;
  approvalMode: ApprovalMode;
  checkpointing: boolean;
}

/**
 * Custom hook to get and manage CLI status, including version, paths,
 * key settings, and connectivity.
 */
export const useStatusCheck = (
  config: Config,
  settings: LoadedSettings,
  enabled: boolean,
): StatusInfo => {
  const [connectivity, setConnectivity] =
    useState<ConnectivityStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [cliVersion, setCliVersion] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    getCliVersion().then(setCliVersion);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnectivity('pending');
      setError(null);
      setIsComplete(false);
      return;
    }

    let isMounted = true;
    const checkConnectivity = async () => {
      try {
        await config.refreshAuth(
          settings.merged.selectedAuthType || AuthType.USE_GEMINI,
        );
        if (isMounted) {
          setConnectivity('success');
        }
      } catch (e) {
        if (isMounted) {
          setConnectivity('error');
          setError(
            e instanceof Error ? e.message : 'An unknown error occurred.',
          );
        }
      } finally {
        if (isMounted) {
          setIsComplete(true);
        }
      }
    };

    checkConnectivity();

    return () => {
      isMounted = false;
    };
  }, [config, settings, enabled]);

  // Gather all the required information.
  const contextFileNames = (() => {
    const fromSettings = settings.merged.contextFileName;
    if (fromSettings) {
      return Array.isArray(fromSettings) ? fromSettings : [fromSettings];
    }
    return getAllGeminiMdFilenames();
  })();

  const loadedSettingsFiles = [];
  if (Object.keys(settings.user.settings).length > 0) {
    loadedSettingsFiles.push(settings.user.path);
  }
  if (Object.keys(settings.workspace.settings).length > 0) {
    loadedSettingsFiles.push(settings.workspace.path);
  }

  return {
    // Basic Info
    cliVersion,
    osPlatform: os.platform(),
    model: config.getModel(),

    // Connectivity
    connectivity,
    error,
    isComplete,

    // Paths
    projectRoot: config.getProjectRoot() || 'N/A',
    targetDirectory: config.getTargetDir(),
    settingsFiles: loadedSettingsFiles,

    // Context & Memory
    contextFiles: contextFileNames,
    userMemorySize: config.getUserMemory().length,
    mcpServerCount: Object.keys(config.getMcpServers() || {}).length,

    // Key Settings
    authType: settings.merged.selectedAuthType || 'Not set',
    debugMode: config.getDebugMode(),
    approvalMode: config.getApprovalMode(),
    checkpointing: config.getCheckpointingEnabled(),
  };
};
