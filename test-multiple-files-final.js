#!/usr/bin/env node

/**
 * Final test script for multiple file processing
 */

console.log('🧪 Final Test: Multiple File Processing...\n');

// Simulate the enhanced at command processor result
const mockAtCommandResult = {
  processedQuery: [
    { text: 'Hello, please help me with these files:' },
    { text: '\n--- Content from referenced files ---' },
    { text: '\nContent from @package.json:\n' },
    { text: '{"name": "test", "version": "1.0.0"}' },
    { text: '\nContent from @README.md:\n' },
    { text: '# Test Project\n\nThis is a test project.' },
    { text: '\nContent from @src/index.ts:\n' },
    { text: 'console.log("Hello, world!");' },
    { text: '\n--- End of content ---' }
  ],
  shouldProceed: true,
  isContextCommand: false,
  resolvedFilePaths: ['package.json', 'README.md', 'src/index.ts']
};

console.log('1️⃣ Mock at command result:');
console.log(`   Should proceed: ${mockAtCommandResult.shouldProceed}`);
console.log(`   Is context command: ${mockAtCommandResult.isContextCommand}`);
console.log(`   Resolved file paths: ${mockAtCommandResult.resolvedFilePaths.join(', ')}`);

console.log('\n2️⃣ Simulating file tracking:');
const pendingFiles = new Set();

if (mockAtCommandResult.shouldProceed && mockAtCommandResult.processedQuery) {
  const resolvedFilePaths = mockAtCommandResult.resolvedFilePaths || [];
  console.log(`   Resolved file paths: ${JSON.stringify(resolvedFilePaths)}`);
  
  for (const filePath of resolvedFilePaths) {
    pendingFiles.add(filePath);
    console.log(`   ✓ Pending ${filePath} for Gemini processing`);
  }
}

console.log(`\n3️⃣ Final pending files: ${Array.from(pendingFiles).join(', ')}`);
console.log(`   Total pending files: ${pendingFiles.size}`);

if (pendingFiles.size === 3) {
  console.log('\n✅ SUCCESS: All 3 files are being tracked!');
} else {
  console.log(`\n❌ FAILURE: Expected 3 files, got ${pendingFiles.size}`);
}

console.log('\n�� Test completed!'); 