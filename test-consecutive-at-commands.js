#!/usr/bin/env node

/**
 * Test script for consecutive @ commands without spaces
 */

console.log('🧪 Testing Consecutive @ Commands Without Spaces...\n');

// Test the regex pattern
function testRegexPattern() {
  const testCases = [
    '@Contrbuting.md@Dockerfile',
    '@package.json@README.md@src/index.ts',
    '@file1.txt @file2.txt @file3.txt',
    '@list@status',
    '@remove file.txt@clear',
    '@file with spaces.txt@another-file.txt'
  ];

  console.log('1️⃣ Testing regex pattern extraction:');
  
  testCases.forEach((testCase, index) => {
    console.log(`\n   Test ${index + 1}: "${testCase}"`);
    
    // Simulate the regex pattern
    const regex = /@([^\s@\\]+(?:\\\s[^\s@\\]+)*)/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(testCase)) !== null) {
      matches.push(match[1]);
    }
    
    console.log(`   Extracted: [${matches.join(', ')}]`);
    console.log(`   Count: ${matches.length}`);
  });
}

// Test the parsing logic
function testParsingLogic() {
  console.log('\n2️⃣ Testing parsing logic:');
  
  const testQuery = '@Contrbuting.md@Dockerfile@esbuild.config.js';
  console.log(`   Query: "${testQuery}"`);
  
  // Simulate the parsing logic
  const parts = [];
  let currentIndex = 0;
  
  while (currentIndex < testQuery.length) {
    let atIndex = testQuery.indexOf('@', currentIndex);
    if (atIndex === -1) break;
    
    // Find the end of this @ command
    let commandEndIndex = atIndex + 1;
    while (commandEndIndex < testQuery.length) {
      const char = testQuery[commandEndIndex];
      if (char === '@' || /\s/.test(char)) {
        break;
      }
      commandEndIndex++;
    }
    
    const command = testQuery.substring(atIndex, commandEndIndex);
    parts.push(command);
    
    currentIndex = commandEndIndex;
  }
  
  console.log(`   Parsed parts: [${parts.join(', ')}]`);
  console.log(`   Total parts: ${parts.length}`);
}

// Test context command detection
function testContextCommandDetection() {
  console.log('\n3️⃣ Testing context command detection:');
  
  const contextCommands = ['list', 'show', 'status', 'remove', 'clear', 'clear-all'];
  const testCommands = [
    '@Contrbuting.md',
    '@list',
    '@status',
    '@remove file.txt',
    '@clear',
    '@Dockerfile'
  ];
  
  testCommands.forEach(cmd => {
    const commandContent = cmd.substring(1); // Remove @
    const isExactContextCommand = contextCommands.includes(commandContent);
    const isContextCommandWithArgs = contextCommands.some(c => 
      commandContent.startsWith(c + ' ')
    );
    const isContextCommand = isExactContextCommand || isContextCommandWithArgs;
    
    console.log(`   "${cmd}": ${isContextCommand ? 'CONTEXT COMMAND' : 'FILE PATH'}`);
  });
}

// Run all tests
testRegexPattern();
testParsingLogic();
testContextCommandDetection();

console.log('\n✅ Test completed!'); 