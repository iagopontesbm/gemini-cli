import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing @remove command suggestions (simple version)...\n');

// Start the CLI
const cli = spawn('npm', ['start'], {
  cwd: join(__dirname, 'packages/cli'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasStarted = false;
let step = 0;

cli.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  
  if (!hasStarted && text.includes('Welcome to Gemini CLI')) {
    hasStarted = true;
    console.log('CLI started, testing @remove suggestions...\n');
    
    // Add a file to context
    setTimeout(() => {
      console.log('Step 1: Adding package.json to context...');
      cli.stdin.write('@package.json\n');
    }, 1000);
    
    // Wait a bit, then try @remove
    setTimeout(() => {
      console.log('Step 2: Testing @remove suggestions...');
      cli.stdin.write('@remove\n');
    }, 3000);
    
    // Exit after a bit
    setTimeout(() => {
      console.log('Step 3: Exiting...');
      cli.stdin.write('exit\n');
      cli.kill();
    }, 6000);
  }
  
  // Log any debug messages
  if (text.includes('[DEBUG]')) {
    console.log('DEBUG:', text.trim());
  }
  
  // Log any info messages about files
  if (text.includes('Available files for removal') || text.includes('No files in context')) {
    console.log('SUGGESTION OUTPUT:', text.trim());
  }
});

cli.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

cli.on('close', (code) => {
  console.log('\n=== Test Complete ===');
  console.log('Exit code:', code);
}); 