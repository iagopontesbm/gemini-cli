# Multi-Provider Configuration Guide

This guide explains how to configure the Gemini CLI to use multiple AI providers like OpenRouter, DeepSeek, and others alongside or instead of Google Gemini.

## Quick Start

1. **Copy an example configuration:**
   ```bash
   cp providers.example.json .croissant/providers.json
   ```

2. **Edit the configuration:**
   - Replace `YOUR_OPENROUTER_API_KEY` with your actual OpenRouter API key
   - Replace `YOUR_DEEPSEEK_API_KEY` with your actual DeepSeek API key
   - Adjust model names and settings as needed

3. **Start Croissant CLI with multi-provider support:**
   ```bash
   croissant --providers-config .croissant/providers.json --use-multi-provider
   ```

## Configuration Structure

### Provider Configuration
```json
{
  "id": "unique-provider-id",
  "name": "Human Readable Name",
  "type": "openrouter|deepseek|openai-compatible|gemini",
  "baseUrl": "https://api.provider.com/v1",
  "auth": {
    "apiKey": "your-api-key",
    "headers": {
      "Custom-Header": "value"
    }
  },
  "models": {
    "chat": "primary-chat-model",
    "fast": "fast-response-model",
    "embedding": "embedding-model",
    "code": "code-specific-model"
  },
  "settings": {
    "timeout": 30000,
    "maxRetries": 3,
    "rateLimit": {
      "requestsPerMinute": 100,
      "tokensPerMinute": 500000
    },
    "parameters": {
      "temperature": 0.7,
      "max_tokens": 4096
    }
  }
}
```

### Model Routing
You can route different task types to different providers:

```json
{
  "modelRouting": {
    "chat": "provider-for-general-chat",
    "fast": "provider-for-quick-responses", 
    "code": "provider-for-coding-tasks",
    "embedding": "provider-for-embeddings"
  }
}
```

## Supported Provider Types

### OpenRouter (`type: "openrouter"`)
- Access to multiple models through OpenRouter's API
- Requires OpenRouter API key
- Supports custom headers for site identification

**Example Models:**
- `anthropic/claude-3.5-sonnet`
- `anthropic/claude-3.5-haiku`
- `openai/gpt-4`
- `meta-llama/llama-3.1-405b`

### DeepSeek (`type: "deepseek"`)
- DeepSeek's proprietary models
- Requires DeepSeek API key
- Optimized for coding tasks

**Example Models:**
- `deepseek-chat`
- `deepseek-coder`

### OpenAI Compatible (`type: "openai-compatible"`)
- Any provider with OpenAI-compatible API
- Works with OpenAI, Azure OpenAI, local models, etc.

### Gemini (`type: "gemini"`)
- Google Gemini models (fallback compatibility)
- Uses existing Gemini authentication

## Example Configurations

### Basic OpenRouter Setup
Use `providers.openrouter.json` for OpenRouter-only configuration with different models for different tasks.

### Pure DeepSeek Setup  
Use `providers.deepseek.json` for DeepSeek-only configuration.

### Mixed Provider Setup
Use `providers.mixed.json` to combine different providers:
- Claude for general chat
- DeepSeek for coding
- OpenAI for embeddings
- Gemini as backup

### Full Multi-Provider Setup
Use `providers.example.json` for a complete setup with multiple providers and smart routing.

## Environment Variables

You can use environment variables in your configuration:

```bash
export OPENROUTER_API_KEY="your-key"
export DEEPSEEK_API_KEY="your-key"
```

Then in your config:
```json
{
  "auth": {
    "apiKey": "${OPENROUTER_API_KEY}"
  }
}
```

## CLI Usage

### Basic Commands
```bash
# Use multi-provider configuration
croissant --providers-config providers.json --use-multi-provider

# Specify task type for model routing
croissant --providers-config providers.json --use-multi-provider --task-type code

# Override default provider
croissant --providers-config providers.json --use-multi-provider --default-provider deepseek
```

### Runtime Provider Switching
You can switch providers during a session using slash commands:
```
/provider list                    # List available providers
/provider switch openrouter       # Switch to OpenRouter
/provider switch deepseek code    # Switch to DeepSeek for code tasks
/provider current                 # Show current provider
```

## Configuration Locations

The CLI looks for provider configurations in these locations (in order):
1. Path specified by `--providers-config` flag
2. `.croissant/providers.json` in project directory
3. `~/.config/croissant/providers.json` in user config directory

## Model Selection

### Task-Based Routing
Different task types can use different models:
- `chat`: General conversation and Q&A
- `fast`: Quick responses, simple tasks
- `code`: Programming and development tasks  
- `embedding`: Vector embeddings for semantic search

### Model Fallbacks
If a specified model fails:
1. Try the provider's `chat` model
2. Try the default provider's model
3. Fall back to default provider if configured

## Rate Limiting

Each provider can have rate limits configured:
```json
{
  "rateLimit": {
    "requestsPerMinute": 100,
    "tokensPerMinute": 500000
  }
}
```

The CLI will automatically throttle requests to stay within limits.

## Security Notes

- Store API keys securely using environment variables
- Never commit API keys to version control
- Use `.gitignore` to exclude provider configuration files with keys
- Consider using encrypted configuration for sensitive deployments

## Troubleshooting

### Provider Connection Issues
1. Verify API key is correct and has permissions
2. Check base URL is accessible
3. Ensure rate limits aren't exceeded
4. Check provider-specific headers are included

### Model Not Found Errors
1. Verify model name is correct for the provider
2. Check if your API key has access to the model
3. Try using the provider's default model

### Performance Issues
1. Adjust timeout settings for slower providers
2. Configure appropriate rate limits
3. Use faster models for simple tasks via routing

## Advanced Features

### Custom Headers
Add provider-specific headers:
```json
{
  "auth": {
    "headers": {
      "User-Agent": "MyApp/1.0",
      "X-API-Version": "2024-01"
    }
  }
}
```

### Provider-Specific Parameters
Configure model parameters per provider:
```json
{
  "settings": {
    "parameters": {
      "temperature": 0.1,
      "top_p": 0.9,
      "max_tokens": 4096
    }
  }
}
```

### Timeout and Retry Configuration
```json
{
  "settings": {
    "timeout": 60000,
    "maxRetries": 3
  }
}
```