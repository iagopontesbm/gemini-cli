#!/usr/bin/env node

/**
 * Test script for multiple file extraction
 */

// Copy of the extractFilePathsFromQuery function
function extractFilePathsFromQuery(query) {
  const filePaths = [];
  const contextCommands = ['list', 'show', 'status', 'remove', 'clear', 'clear-all'];
  
  // First, parse the query to identify context commands vs file paths
  const regex = /@([^\s\\]+(?:\\\s[^\s\\]+)*)/g;
  let match;
  
  while ((match = regex.exec(query)) !== null) {
    const commandContent = match[1].replace(/\\\s/g, ' '); // Unescape spaces
    
    // Check if this is a context command
    const isExactContextCommand = contextCommands.includes(commandContent);
    const isContextCommandWithArgs = contextCommands.some(cmd => 
      commandContent.startsWith(cmd + ' ')
    );
    
    // Only add to file paths if it's not a context command
    if (!isExactContextCommand && !isContextCommandWithArgs) {
      filePaths.push(commandContent);
    }
  }
  
  return filePaths;
}

console.log('🧪 Testing Multiple File Extraction...\n');

// Test cases
const testCases = [
  '@file1.txt @file2.txt @file3.txt',
  '@package.json @README.md @src/index.ts',
  '@file1.txt hello world @file2.txt',
  '@list @file1.txt @file2.txt',
  '@file1.txt @status @file2.txt',
  '@file1.txt @remove file2.txt @file3.txt',
  '@file1.txt @clear @file2.txt',
  '@file1.txt @file2.txt @file3.txt @file4.txt @file5.txt',
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  const files = extractFilePathsFromQuery(testCase);
  console.log(`   Extracted files: [${files.join(', ')}]`);
  console.log(`   Count: ${files.length}`);
  console.log('');
});

console.log('✅ Multiple file extraction test completed!'); 