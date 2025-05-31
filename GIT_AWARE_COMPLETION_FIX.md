# Git-Aware @ Command Completion Fix

## Issue Fixed
The @ command auto-completion in the CLI was showing all directories and files, including git-ignored ones like `node_modules/`, `dist/`, `.env`, etc.

## Solution Implemented
Updated the `useCompletion` hook to integrate with the `FileDiscoveryService` for git-aware filtering during completion suggestions.

## Changes Made

### 1. Enhanced `useCompletion` Hook
- Added git-aware filtering to both recursive and directory-specific file completion
- Integrated `FileDiscoveryService` to respect `.gitignore` patterns
- Added fallback behavior when git discovery is not available
- Respects configuration settings for custom ignore patterns

### 2. Updated `InputPrompt` Component
- Passes the full `config` object to `useCompletion` hook
- Enables configuration-driven filtering behavior

### 3. Key Features
- **Respects `.gitignore`**: Files and directories in `.gitignore` are excluded from completions
- **Always ignores `.git/`**: The `.git` directory is never shown in completions
- **Configuration-driven**: Users can customize behavior via `settings.json`
- **Custom patterns**: Additional ignore patterns can be specified
- **Graceful fallback**: Works even if git discovery fails

## Before vs After

### Before (showing git-ignored files):
```
@<TAB>
- src/
- node_modules/     <- Should be hidden
- dist/             <- Should be hidden  
- .env              <- Should be hidden
- README.md
```

### After (git-aware filtering):
```
@<TAB>
- src/
- README.md
```

## Configuration

Users can customize the behavior in `settings.json`:

```json
{
  "fileFiltering": {
    "respectGitIgnore": true,
    "customIgnorePatterns": ["temp/", "*.log"],
    "allowBuildArtifacts": false
  }
}
```

## Testing
Added comprehensive integration tests covering:
- Git-ignored directory filtering
- Recursive search with filtering
- Fallback behavior without config
- Custom ignore pattern support
- Error handling

This fix ensures that @ command completions are now secure, performant, and respect version control boundaries.