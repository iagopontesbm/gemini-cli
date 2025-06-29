/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-env node */
/* global console */

import { sanitizeParameters } from './packages/core/src/tools/mcp-client.js';

// Simulate the problematic schema that was causing the error
const problematicSchema = {
  type: 'object',
  properties: {
    validParam: {
      type: 'string',
      description: 'A valid parameter'
    },
    anotherValidParam: {
      type: 'number',
      description: 'Another valid parameter'
    }
  },
  required: ['validParam', 'connectionConfig', 'anotherValidParam', 'undefinedParam']
};

console.log('Before sanitization:');
console.log('Required properties:', problematicSchema.required);
console.log('Defined properties:', Object.keys(problematicSchema.properties));

// Apply the fix
sanitizeParameters(problematicSchema);

console.log('\nAfter sanitization:');
console.log('Required properties:', problematicSchema.required);
console.log('\nThe connectionConfig error should now be resolved!');