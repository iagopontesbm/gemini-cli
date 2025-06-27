import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing @remove command suggestions...\n');

// Start the CLI
const cli = spawn('npm', ['start'], {
  cwd: join(__dirname, 'packages/cli'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasStarted = false;

cli.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  
  if (!hasStarted && text.includes('Welcome to Gemini CLI')) {
    hasStarted = true;
    console.log('CLI started, testing @remove suggestions...\n');
    
    // Add some files to context first
    setTimeout(() => {
      cli.stdin.write('@package.json\n');
    }, 1000);
    
    setTimeout(() => {
      cli.stdin.write('@README.md\n');
    }, 2000);
    
    setTimeout(() => {
      cli.stdin.write('@remove\n');
    }, 3000);
    
    setTimeout(() => {
      cli.stdin.write('exit\n');
      cli.kill();
    }, 5000);
  }
});

cli.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

cli.on('close', (code) => {
  console.log('\n=== Full Output ===');
  console.log(output);
  console.log('\n=== Test Complete ===');
  console.log('Exit code:', code);
}); 