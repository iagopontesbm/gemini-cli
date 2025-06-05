#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env node */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Find cfonts in node_modules
const findCfontsPath = () => {
  const possiblePaths = [
    path.join(__dirname, '../node_modules/cfonts'),
    path.join(__dirname, '../../../node_modules/cfonts'),
    path.join(__dirname, '../../../../node_modules/cfonts'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  throw new Error('Could not find cfonts in node_modules');
};

const cfontsPath = findCfontsPath();
const sourceFontsDir = path.join(cfontsPath, 'fonts');
const targetFontsDir = path.join(__dirname, '../dist/cfonts-fonts');

// Create target directory
if (!fs.existsSync(targetFontsDir)) {
  fs.mkdirSync(targetFontsDir, { recursive: true });
}

// Copy all font files
const fontFiles = fs.readdirSync(sourceFontsDir).filter(file => file.endsWith('.json'));

for (const fontFile of fontFiles) {
  const sourcePath = path.join(sourceFontsDir, fontFile);
  const targetPath = path.join(targetFontsDir, fontFile);
  fs.copyFileSync(sourcePath, targetPath);
}

console.log(`Bundled ${fontFiles.length} cfonts font files to ${targetFontsDir}`);