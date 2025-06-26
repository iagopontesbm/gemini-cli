# Example MCP Resource Server

This is a simple example of an MCP server that exposes resources for the Gemini CLI to access.

## Features

This example server demonstrates:
- Static resources with fixed content
- Resource templates for dynamic content access
- Different resource types (text, JSON, markdown)

## Resources Exposed

1. **Project README** (`project://readme`)
   - The README.md file from the current project
   
2. **Configuration Files** (`config://package.json`, `config://tsconfig.json`)
   - Common configuration files
   
3. **Dynamic File Access** (template: `file:///{path}`)
   - Template for accessing any file by path

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure in your `.gemini/settings.json`:
   ```json
   {
     "mcpServers": {
       "example-resources": {
         "command": "node",
         "args": ["path/to/examples/mcp-resource-server/server.js"]
       }
     }
   }
   ```

3. Start Gemini CLI and use the resources:
   ```bash
   # List available resources
   Ask Gemini: "List available MCP resources"
   
   # Read a specific resource
   Ask Gemini: "Read the project://readme resource"
   ```

## Implementation

The server implements the MCP protocol with:
- `listResources()` - Returns available static resources
- `listResourceTemplates()` - Returns resource templates for dynamic access
- `readResource()` - Reads and returns resource content

See `server.js` for the full implementation.