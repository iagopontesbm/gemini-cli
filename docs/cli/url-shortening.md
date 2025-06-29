# URL Shortening for OAuth Authentication

The Gemini CLI now automatically shortens OAuth authentication URLs to make them easier to copy, click, and share. This is particularly useful for manual Google login (SSH) scenarios where URLs can be extremely long.

## How It Works

When you select "Manual Login with Google (SSH)", the CLI will:

1. **Automatically shorten the authentication URL** using reliable URL shortening services
2. **Display the shortened URL** instead of the full OAuth URL
3. **Provide fallback support** - if shortening fails, the original URL is displayed
4. **Show a clear indication** when a URL has been shortened

## Features

### Multiple Service Support
- **Primary service**: TinyURL (https://tinyurl.com)
- **Fallback service**: is.gd (https://is.gd)
- **Graceful degradation**: If all services fail, original URL is shown

### Security & Validation
- URLs are validated to ensure they come from trusted shortening services
- Invalid or suspicious shortened URLs are rejected
- Original functionality is preserved if shortening fails

### User Experience
- **Loading indicator**: Shows "Shortening authentication URL..." while processing
- **Clear labeling**: Indicates when a URL has been shortened
- **Timeout protection**: Short timeouts prevent hanging
- **Error handling**: Graceful fallback to original URLs

## Example

### Before (Long URL)
```
Authentication URL (click to select and copy):
https://accounts.google.com/o/oauth2/v2/auth?client_id=681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Foauth2callback&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&access_type=offline&state=abc123def456...
```

### After (Shortened URL)
```
Authentication URL (click to select and copy):
https://tinyurl.com/gemini-auth-abc123
(Shortened URL - redirects to Google OAuth)
```

## Technical Details

### Implementation
- **Non-blocking**: URL shortening happens asynchronously
- **Timeout**: 5 seconds for UI, 3 seconds for console output
- **Error handling**: Comprehensive error handling with fallbacks
- **Network-aware**: Works both online and offline (falls back to original URL)

### Services Used
1. **TinyURL API**: `https://tinyurl.com/api-create.php`
2. **is.gd API**: `https://is.gd/create.php`

Both services are free and don't require API keys for basic usage.

## Troubleshooting

### URL Shortening Fails
If you see the original long URL instead of a shortened one:
- **Check internet connection**: URL shortening requires internet access
- **Service availability**: Shortening services may occasionally be unavailable
- **No action needed**: The original URL works exactly the same way

### Shortened URL Doesn't Work
If the shortened URL doesn't redirect properly:
- **Try the original**: Check console logs for the full OAuth URL
- **Service issues**: Shortening services may have temporary issues
- **Copy carefully**: Ensure the entire shortened URL is copied

## Privacy & Security

- **No data collection**: URLs are only shortened, not logged or stored
- **Service policies**: Subject to TinyURL and is.gd privacy policies
- **Validation**: Only trusted shortening domains are accepted
- **Fallback protection**: Always falls back to original OAuth URLs

The shortened URLs redirect to the exact same Google OAuth endpoint - they're just easier to handle! 