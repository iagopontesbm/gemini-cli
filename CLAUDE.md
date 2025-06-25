# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

🥐 **Croissant CLI** - A flaky AI-powered command-line tool with multi-provider support.

## Development Commands

### Build and Quality Checks
- `npm run preflight` - Run full validation suite (build, test, typecheck, lint) before submitting changes
- `npm run build` - Build all packages
- `npm run build:all` - Build CLI and sandbox container
- `npm run clean` - Clean build artifacts

### Testing
- `npm run test` - Run unit tests across all packages
- `npm run test:e2e` - Run end-to-end integration tests
- `npm run test:integration:all` - Run all integration tests (sandbox variants)

### Development
- `npm start` - Start the Gemini CLI from source
- `npm run debug` - Start CLI in debug mode with inspector

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run typecheck` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

### Multi-Provider Usage
- `croissant --providers-config providers.json --use-multi-provider` - Use custom API providers
- `croissant --providers-config providers.json --task-type code` - Specify task type for model routing
- `croissant --default-provider openrouter` - Override default provider

## Architecture Overview

The Croissant CLI is a two-package monorepo that provides AI-powered command-line interactions:

### Core Architecture
- **packages/cli**: Frontend terminal interface using Ink (React for CLI) that handles user interaction, display rendering, theming, and input processing
- **packages/core**: Backend that orchestrates multi-provider AI communication, tool execution, prompt construction, and session management
- **Tools System**: Extensible tools in `packages/core/src/tools/` that enable file system access, shell commands, web fetching, and MCP server integration

### Key Interaction Flow
1. User input captured by CLI package
2. CLI sends request to Core package 
3. Core constructs prompts and communicates with selected AI provider
4. Tools executed based on API response (with user approval for modifying operations)  
5. Results sent back through Core to CLI for display

### Technology Stack
- **Framework**: TypeScript + Node.js with ES modules
- **UI**: Ink (React-based terminal UI)
- **Testing**: Vitest with extensive mocking patterns
- **Sandboxing**: macOS Seatbelt + container-based isolation (Docker/Podman)
- **API Integration**: Google Gemini API with function calling for tools
- **Multi-Provider Support**: OpenRouter, DeepSeek, OpenAI-compatible APIs

### Critical Components
- **Tool Registry**: Central system for registering and executing capabilities
- **Memory System**: Context and conversation state management
- **Authentication**: Google OAuth2 and API key support
- **Telemetry**: OpenTelemetry integration for usage tracking
- **MCP Integration**: Model Context Protocol server support for extensibility
- **Provider System**: Multi-provider API integration with task-based routing

## Development Patterns

### Code Style
- Prefer plain objects with TypeScript interfaces over classes
- Use ES module imports/exports for encapsulation instead of private/public class members  
- Avoid `any` types; prefer `unknown` with type narrowing
- Leverage array operators (map, filter, reduce) for functional programming

### React/Ink Components
- Use functional components with Hooks exclusively
- Keep render functions pure and side-effect-free
- Follow Rules of Hooks (no conditional Hook calls)
- Avoid useEffect for state updates; use for synchronization only
- Don't use manual memoization (useMemo, useCallback) - rely on React Compiler

### Testing with Vitest
- Co-locate test files with source code (*.test.ts/*.test.tsx)
- Mock ES modules with `vi.mock()` using `importOriginal` for selective mocking
- Place critical dependency mocks (fs, os) at top of test files
- Use `vi.hoisted()` for mock functions needed in factory functions
- Mock common modules: Node.js built-ins, @google/genai, @modelcontextprotocol/sdk

### Tool Development
- Tools extend CLI capabilities (file system, shell, web, MCP)
- Modifying operations require user approval; read-only operations may auto-execute
- Register tools in the tool registry system
- Follow existing patterns for error handling and result formatting

## Project Structure

- `packages/cli/` - Terminal interface with themes, components, and user interaction
- `packages/core/` - Backend logic, API client, tools, and session management  
- `packages/core/src/providers/` - Multi-provider API client implementations
- `packages/core/src/config/` - Configuration management including provider configs
- `docs/` - Comprehensive documentation including architecture and guides
- `scripts/` - Build, development, and deployment utilities
- `integration-tests/` - End-to-end testing framework
- `providers.*.json` - Example provider configurations for different setups
- `README.providers.md` - Multi-provider setup and usage guide

## Multi-Provider Configuration

### Setup
1. Copy an example: `cp providers.example.json .croissant/providers.json`
2. Add your API keys to the configuration
3. Run with: `croissant --providers-config .croissant/providers.json --use-multi-provider`

### Supported Providers
- **OpenRouter**: Access to Claude, GPT, Llama models via OpenRouter API
- **DeepSeek**: DeepSeek Chat and Coder models
- **OpenAI Compatible**: Any OpenAI API-compatible service
- **Gemini**: Google Gemini models (fallback compatibility)

### Task-Based Routing
Configure different providers for different tasks:
- `chat`: General conversation
- `fast`: Quick responses  
- `code`: Programming tasks
- `embedding`: Vector embeddings

### Key Files
- `packages/core/src/config/providerConfig.ts` - Provider configuration schema
- `packages/core/src/providers/genericApiClient.ts` - OpenAI-compatible client
- `packages/core/src/core/multiProviderContentGenerator.ts` - Multi-provider wrapper

Always run `npm run preflight` before submitting changes to ensure all quality gates pass.