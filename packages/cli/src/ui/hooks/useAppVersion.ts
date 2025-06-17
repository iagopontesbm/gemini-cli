/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getCliVersion } from '../../utils/version.js';

export function useAppVersion(): string {
  const [version, setVersion] = useState('unknown');

  useEffect(() => {
    getCliVersion().then(setVersion);
  }, []);

  return version;
}
