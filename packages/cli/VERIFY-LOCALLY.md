# How to Verify the Fix Locally

## Quick Verification Steps

### 1. Test Current Functionality (normal install)

```bash
# Run directly from the built output
node dist/index.js --help
```

You should see the big text "GEMINI" header.

### 2. Verify Fonts are Bundled

```bash
# Check that fonts are included in the build
ls -la dist/cfonts-fonts/
```

You should see 13 font JSON files.

### 3. Simulate npx Execution

```bash
# Install globally from tarball
npm install -g ./gemini-code-cli-0.1.0.tgz

# Run it
gemini --help

# Test with custom title
CLI_TITLE="MYAPP" gemini --help

# Uninstall when done
npm uninstall -g @gemini-code/cli
```

### 4. Check Tarball Contents

```bash
# Verify fonts are in the package
tar -tzf gemini-code-cli-0.1.0.tgz | grep cfonts-fonts
```

You should see all the font files listed.

## Testing Different Branches

### Compare the two fixes:

```bash
# Test fallback-only fix
git checkout fix-ink-big-text-bundling
npm run build
node dist/index.js --help
# Should show ASCII art

# Test root cause fix
git checkout fix-ink-big-text-root-cause
npm run build
node dist/index.js --help
# Should show big text fonts
```

## What to Look For

1. **With Root Cause Fix**: Big stylized "GEMINI" text should appear
2. **With Fallback Fix**: ASCII art version should appear
3. **No Errors**: Check console for any font loading errors
4. **CLI_TITLE Works**: Custom titles should display correctly

## Debug Mode

To see what's happening under the hood, you can add logging:

```javascript
// In src/ui/components/cfonts-loader.ts
console.log('Intercepting font request:', id);
console.log('Looking for bundled font at:', bundledPath);
```

Then rebuild and run again.
