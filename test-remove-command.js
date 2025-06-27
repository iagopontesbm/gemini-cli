#!/usr/bin/env node

/**
 * Test script for @remove command parsing
 */

console.log('🧪 Testing @remove Command Parsing...\n');

// Simulate the parsing logic
function parseRemoveCommand(query) {
  console.log(`Testing query: "${query}"`);
  
  const parts = [];
  let currentIndex = 0;
  
  while (currentIndex < query.length) {
    let atIndex = query.indexOf('@', currentIndex);
    if (atIndex === -1) break;
    
    // Find the end of this @ command
    let commandEndIndex = atIndex + 1;
    while (commandEndIndex < query.length) {
      const char = query[commandEndIndex];
      
      if (char === '@') {
        // Always stop at next @
        break;
      } else if (/\s/.test(char)) {
        // For context commands with arguments, continue parsing after whitespace
        const commandContent = query.substring(atIndex + 1, commandEndIndex);
        const contextCommands = ['list', 'show', 'status', 'remove', 'clear', 'clear-all'];
        const isContextCommand = contextCommands.includes(commandContent);
        
        if (isContextCommand && (commandContent === 'remove' || commandContent === 'clear')) {
          // For commands that expect arguments, continue parsing
          commandEndIndex++;
          continue;
        } else {
          // For other commands or file paths, stop at whitespace
          break;
        }
      }
      commandEndIndex++;
    }
    
    const command = query.substring(atIndex, commandEndIndex);
    parts.push(command);
    
    currentIndex = commandEndIndex;
  }
  
  return parts;
}

// Test cases
const testCases = [
  '@remove CONTRIBUTING.md',
  '@remove package.json',
  '@remove',
  '@remove file with spaces.txt',
  '@remove@list',
  '@remove CONTRIBUTING.md@Dockerfile',
  '@list@remove test.txt'
];

console.log('1️⃣ Testing command parsing:');
testCases.forEach((testCase, index) => {
  console.log(`\n   Test ${index + 1}: "${testCase}"`);
  const parts = parseRemoveCommand(testCase);
  console.log(`   Parsed parts: [${parts.join(', ')}]`);
  
  // Extract command and args for @remove
  const removePart = parts.find(part => part.startsWith('@remove'));
  if (removePart) {
    const commandContent = removePart.substring(1); // Remove @
    const commandParts = commandContent.split(' ');
    const command = commandParts[0];
    const args = commandParts.slice(1);
    
    console.log(`   Command: "${command}"`);
    console.log(`   Args: [${args.join(', ')}]`);
    console.log(`   Args length: ${args.length}`);
  }
});

// Test suggestion functionality
console.log('\n2️⃣ Testing suggestion functionality:');
const mockAvailableFiles = ['package.json', 'README.md', 'src/index.ts'];
const mockPendingFiles = ['CONTRIBUTING.md', 'Dockerfile'];

console.log('   Available files:', mockAvailableFiles);
console.log('   Pending files:', mockPendingFiles);

if (mockAvailableFiles.length === 0 && mockPendingFiles.length === 0) {
  console.log('   Message: No files in context to remove.');
} else {
  let message = 'Available files for removal:\n';
  if (mockAvailableFiles.length > 0) {
    message += `\nProcessed files:\n${mockAvailableFiles.map(f => `  - ${f}`).join('\n')}`;
  }
  if (mockPendingFiles.length > 0) {
    message += `\n\nPending files:\n${mockPendingFiles.map(f => `  - ${f}`).join('\n')}`;
  }
  message += '\n\nUsage: @remove <filename> (e.g., @remove package.json)';
  
  console.log('   Message:');
  console.log(message);
}

console.log('\n✅ Test completed!'); 