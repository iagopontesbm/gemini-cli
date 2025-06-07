# Testing ink-big-text Font Fix Locally

## Quick Test with Script

```bash
# Run the automated test script
./test-npx-locally.sh
```

## Manual Testing Steps

### 1. Build and Pack

```bash
# Build the package
npm run build

# Verify fonts are bundled
ls -la dist/cfonts-fonts/

# Create a tarball
npm pack
```

### 2. Test with npx

```bash
# Test in a temporary directory
mkdir -p /tmp/gemini-test && cd /tmp/gemini-test

# Run with npx using the local tarball
npx file:/path/to/gemini-cli/packages/cli/gemini-code-cli-0.1.0.tgz --help

# Test with custom title
CLI_TITLE="MYAPP" npx file:/path/to/gemini-cli/packages/cli/gemini-code-cli-0.1.0.tgz --help
```

### 3. Verify Different Scenarios

#### Test 1: Direct execution (should show big text)

```bash
node dist/index.js --help
```

#### Test 2: Global install simulation

```bash
npm install -g ./gemini-code-cli-0.1.0.tgz
gemini --help
npm uninstall -g @gemini-code/cli
```

#### Test 3: Check console output

- Look for "Failed to load ink-big-text" error (shouldn't appear with root cause fix)
- Verify big text appears correctly
- Test CLI_TITLE environment variable works

### 4. Compare Branches

To test the difference between fixes:

```bash
# Test fallback fix (PR #760)
git checkout fix-ink-big-text-bundling
npm run build && npm pack
npx file:./gemini-code-cli-0.1.0.tgz --help

# Test root cause fix (PR #761)
git checkout fix-ink-big-text-root-cause
npm run build && npm pack
npx file:./gemini-code-cli-0.1.0.tgz --help
```

## Expected Results

### With Root Cause Fix (PR #761)

- Big text fonts should display properly
- No error messages in console
- CLI_TITLE environment variable should work
- dist/cfonts-fonts/ directory should contain font files

### With Fallback Fix (PR #760)

- ASCII art should display instead of big text
- No crashes or errors
- CLI_TITLE environment variable should work with ASCII art

## Debugging

If fonts don't load, check:

1. Are font files bundled?

   ```bash
   tar -tzf gemini-code-cli-0.1.0.tgz | grep cfonts-fonts
   ```

2. Enable debug logging by adding to Header.tsx:

   ```typescript
   console.log('Looking for fonts in:', __dirname);
   ```

3. Check Module.require patch is working:
   ```typescript
   // In cfonts-loader.ts
   console.log('Intercepted font request:', id);
   ```
