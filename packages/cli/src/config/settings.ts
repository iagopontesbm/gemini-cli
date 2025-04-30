/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { Config } from '@gemini-code/server';

const USER_SETTINGS_DIR = path.join(homedir(), '.gemini_config');
const USER_SETTINGS_PATH = path.join(USER_SETTINGS_DIR, 'settings.json');

export enum SettingScope {
  User = 'User',
  Workspace = 'Workspace',
}

export class MergedSetting {
  // Private members to hold context needed for updates
  private _loadedSettings: LoadedSettings;
  private _key: keyof SettingProperties<string | undefined>; // Use the base type for keys

  // Public properties representing the merged state
  get value(): string | undefined {
    // Check workspace first
    const workspaceValue =
      this._loadedSettings.workspace?.settings?.[this._key];
    if (workspaceValue !== undefined) {
      // No need for cast if workspaceValue is already string | undefined
      return workspaceValue;
    }

    // Check user next
    const userValue = this._loadedSettings.user?.settings?.[this._key];
    if (userValue !== undefined) {
      // No need for cast if userValue is already string | undefined
      return userValue;
    }

    // Default (undefined)
    return undefined;
  }

  /**
   * Creates an instance of MergedSetting.
   * @param key The key of the setting this instance represents.
   * @param loadedSettings The LoadedSettings instance containing the raw settings data.
   */
  constructor(
    key: keyof SettingProperties<string | undefined>, // Accept the base key type
    loadedSettings: LoadedSettings,
  ) {
    this._key = key;
    this._loadedSettings = loadedSettings;
  }

  /**
   * Sets the value of this setting in the specified scope ('user' or 'workspace')
   * and saves the corresponding settings file.
   * Updates the current MergedSetting instance to reflect the new merged state.
   * @param value The new value for the setting. Use `undefined` to unset.
   * @param scope The configuration scope ('user' or 'workspace') to modify.
   */
  setValue(value: string | undefined, scope: SettingScope): void {
    const settingsForScope = this._loadedSettings.forScope(scope);
    settingsForScope.settings[this._key] = value;
    saveSettings(settingsForScope);
  }
}

export interface SettingProperties<T> {
  theme: T;
  // Add other settings here
}

export interface SettingsFile {
  settings: SettingProperties<string | undefined>;
  path: string;
}

export type MergedSettings = SettingProperties<MergedSetting>;

export class LoadedSettings {
  constructor(user: SettingsFile, workspace: SettingsFile) {
    this.user = user;
    this.workspace = workspace;
    this.merged = { theme: new MergedSetting('theme', this) };
  }

  readonly user: SettingsFile;
  readonly workspace: SettingsFile;
  readonly merged: MergedSettings;

  forScope(scope: SettingScope): SettingsFile {
    switch (scope) {
      case SettingScope.User:
        return this.user;
      case SettingScope.Workspace:
        return this.workspace;
      default:
        throw new Error(`Invalid scope: ${scope}`);
    }
  }
}

/**
 * Loads settings from user and project configuration files.
 * Project settings override user settings.
 */
export function loadSettings(config: Config): LoadedSettings {
  let userSettings: SettingProperties<string | undefined> = {
    theme: undefined,
  };
  let workspaceSettings: SettingProperties<string | undefined> = {
    theme: undefined,
  };

  // Load user settings
  try {
    if (fs.existsSync(USER_SETTINGS_PATH)) {
      const userContent = fs.readFileSync(USER_SETTINGS_PATH, 'utf-8');
      userSettings = JSON.parse(userContent);
    }
  } catch (error) {
    console.error('Error reading user settings file:', error);
  }

  const workspaceSettingsPath = path.join(
    config.getTargetDir(),
    '.gemini_config',
    'settings.json',
  );

  // Load workspace settings
  try {
    if (fs.existsSync(workspaceSettingsPath)) {
      const projectContent = fs.readFileSync(workspaceSettingsPath, 'utf-8');
      workspaceSettings = JSON.parse(projectContent);
    }
  } catch (error) {
    console.error('Error reading workspace settings file:', error);
  }

  return new LoadedSettings(
    { path: USER_SETTINGS_PATH, settings: userSettings },
    { path: workspaceSettingsPath, settings: workspaceSettings },
  );
}

export function saveSettings(settingsFile: SettingsFile): void {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(settingsFile.path);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(
      settingsFile.path,
      JSON.stringify(settingsFile.settings, null, 2),
      'utf-8',
    );
  } catch (error) {
    console.error('Error saving user settings file:', error);
  }
}
