#!/usr/bin/env node

/**
 * Simple test for @help functionality
 * Run with: node test-at-help-simple.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing @help command with beautiful help display...\n');

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
  
  // Check if we see the beautiful help box
  if (text.includes('╭─') && text.includes('Context Management Commands:') && text.includes('╰─')) {
    console.log('\n✅ SUCCESS: @help command now displays the beautiful help box!');
    hasShownHelp = true;
    
    // Exit after a short delay
    setTimeout(() => {
      cli.kill();
      process.exit(0);
    }, 1000);
  }
});

cli.stderr.on('data', (data) => {
  console.error('stderr:', data.toString());
});

// Send @help command after a short delay
setTimeout(() => {
  console.log('Sending @help command...');
  cli.stdin.write('@help\n');
}, 2000);

// Send /quit command after a longer delay to clean up
setTimeout(() => {
  if (!hasShownHelp) {
    console.log('Sending /quit command...');
    cli.stdin.write('/quit\n');
  }
}, 10000);

// Handle process exit
cli.on('close', (code) => {
  if (!hasShownHelp) {
    console.log('\n❌ FAILED: @help command did not display the beautiful help box');
    console.log('Output received:', output);
  }
  process.exit(hasShownHelp ? 0 : 1);
}); 