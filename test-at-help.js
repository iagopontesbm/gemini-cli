#!/usr/bin/env node

/**
 * Test script for @help functionality
 * Run with: node test-at-help.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing @help command functionality...\n');

// Start the CLI
const cli = spawn('npm', ['start'], {
  cwd: join(__dirname, 'packages/cli'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasShownHelp = false;

cli.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text);
  
  // Check if we see the Tips section with @help
  if (text.includes('@help') && text.includes('context management commands')) {
    console.log('\n✅ Found @help in Tips section!');
  }
  
  // Check if we see the help content when @help is typed
  if (text.includes('Context Management Commands:') && text.includes('@list') && text.includes('@status')) {
    console.log('\n✅ @help command is working correctly!');
    hasShownHelp = true;
  }
});

cli.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

cli.on('close', (code) => {
  console.log(`\nCLI process exited with code ${code}`);
  if (hasShownHelp) {
    console.log('✅ @help functionality test completed successfully!');
  } else {
    console.log('❌ @help functionality test failed - help content not found');
  }
});

// Wait a moment for CLI to start, then send @help command
setTimeout(() => {
  console.log('\n📝 Sending @help command...');
  cli.stdin.write('@help\n');
  
  // Wait a bit more, then exit
  setTimeout(() => {
    cli.stdin.write('/quit\n');
  }, 2000);
}, 1000); 