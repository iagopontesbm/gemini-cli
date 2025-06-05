/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Module from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Patches the require function for cfonts to load fonts from our bundled location
 * when running from a bundled context (like npx).
 */
export function patchCfontsLoader(): void {
  const originalRequire = Module.prototype.require;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module.prototype as any).require = function (id: string) {
    // Check if this is a cfonts font file request
    if (id.includes('../fonts/') && id.endsWith('.json')) {
      // Extract the font name
      const fontName = path.basename(id);
      
      // Try to load from our bundled location first
      const bundledPaths = [
        path.join(__dirname, '../../cfonts-fonts', fontName),
        path.join(__dirname, '../../../cfonts-fonts', fontName),
        path.join(__dirname, '../../../../cfonts-fonts', fontName),
      ];
      
      for (const bundledPath of bundledPaths) {
        if (fs.existsSync(bundledPath)) {
          const content = fs.readFileSync(bundledPath, 'utf-8');
          return JSON.parse(content);
        }
      }
    }
    
    // Fall back to original require
    // eslint-disable-next-line prefer-rest-params, @typescript-eslint/no-explicit-any
    return originalRequire.apply(this, arguments as any);
  };
}