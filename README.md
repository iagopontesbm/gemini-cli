# 🥐 Croissant CLI

[![Croissant CLI CI](https://github.com/xiaobocheng/croissant-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/xiaobocheng/croissant-chat/actions/workflows/ci.yml)

![Croissant CLI Screenshot](./docs/assets/croissant-screenshot.png)

This repository contains the Croissant CLI, a flaky command-line AI workflow tool that connects to multiple AI providers, understands your code and accelerates your workflows with buttery smooth interactions.

With the Croissant CLI you can:

- 🧈 **Multi-Provider Support**: Connect to OpenRouter, DeepSeek, Gemini, and any OpenAI-compatible API
- 📝 Query and edit large codebases with intelligent context management  
- 🎨 Generate new apps from PDFs or sketches using multimodal AI capabilities
- ⚡ Automate operational tasks like querying pull requests or handling complex rebases
- 🔧 Use tools and MCP servers to connect new capabilities
- 🔍 Ground your queries with web search and real-time information
- 🥐 Enjoy buttery smooth interactions with your favorite AI models

## Quickstart

1. **Prerequisites:** Ensure you have [Node.js version 18](https://nodejs.org/en/download) or higher installed.
2. **Run the CLI:** Execute the following command in your terminal:

   ```bash
   npx https://github.com/xiaobocheng/croissant-chat
   ```

   Or install it with:

   ```bash
   npm install -g @croissant/cli
   croissant
   ```

3. **Pick a color theme** 🎨
4. **Configure Providers:** Set up your API keys for OpenRouter, DeepSeek, or other providers:

   ```bash
   cp providers.example.json .croissant/providers.json
   # Edit the config with your API keys
   croissant --providers-config .croissant/providers.json --use-multi-provider
   ```

5. **Authenticate:** When using Gemini, sign in with your Google account for up to 60 requests/minute.

You are now ready to enjoy your flaky Croissant CLI! 🥐

### For advanced use or increased limits:

If you need to use a specific model or require a higher request capacity, you can use an API key:

1. Generate a key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as an environment variable in your terminal. Replace `YOUR_API_KEY` with your generated key.

   ```bash
   export GEMINI_API_KEY="YOUR_API_KEY"
   ```

For other authentication methods, including Google Workspace accounts, see the [authentication](./docs/cli/authentication.md) guide.

## Examples

Once the CLI is running, you can start interacting with AI from your shell.

You can start a project from a new directory:

```sh
cd new-project/
croissant
> Write me a Discord bot that answers questions using a FAQ.md file I will provide
```

Or work with an existing project:

```sh
git clone https://github.com/xiaobocheng/croissant-chat
cd croissant-chat/croissant-cli
croissant
> Give me a summary of all of the changes that went in yesterday
```

### Next steps

- Learn how to [contribute to or build from the source](./CONTRIBUTING.md).
- Explore the available **[CLI Commands](./docs/cli/commands.md)**.
- If you encounter any issues, review the **[Troubleshooting guide](./docs/troubleshooting.md)**.
- For more comprehensive documentation, see the [full documentation](./docs/index.md).
- Take a look at some [popular tasks](#popular-tasks) for more inspiration.

### Troubleshooting

Head over to the [troubleshooting](docs/troubleshooting.md) guide if you're
having issues.

## Popular tasks

### Explore a new codebase

Start by `cd`ing into an existing or newly-cloned repository and running `croissant`.

```text
> Describe the main pieces of this system's architecture.
```

```text
> What security mechanisms are in place?
```

### Work with your existing code

```text
> Implement a first draft for GitHub issue #123.
```

```text
> Help me migrate this codebase to the latest version of Java. Start with a plan.
```

### Automate your workflows

Use MCP servers to integrate your local system tools with your enterprise collaboration suite.

```text
> Make me a slide deck showing the git history from the last 7 days, grouped by feature and team member.
```

```text
> Make a full-screen web app for a wall display to show our most interacted-with GitHub issues.
```

### Interact with your system

```text
> Convert all the images in this directory to png, and rename them to use dates from the exif data.
```

```text
> Organise my PDF invoices by month of expenditure.
```

## Multi-Provider AI Support

This project supports multiple AI providers to give you the best experience. For terms of service, please refer to your chosen provider:

### Supported Providers
- **OpenRouter**: Access to Claude, GPT-4, Llama, and more models
- **DeepSeek**: Specialized coding and chat models  
- **Google Gemini**: Original Gemini API support
- **OpenAI Compatible**: Any OpenAI-compatible API

For details on terms of service:

- [OpenRouter Terms](https://openrouter.ai/terms)
- [DeepSeek Terms](https://www.deepseek.com/terms)  
- [Gemini API Terms](https://ai.google.dev/gemini-api/terms)
- [OpenAI Terms](https://openai.com/terms)