import { Controller, Get } from '@nestjs/common';

@Controller('tools')
export class ToolsController {
  constructor() {} // private readonly toolsService: ToolsService

  // Placeholder: Example of how listing available tools might look
  @Get('list')
  async listTools(): Promise<any[]> {
    console.log('[ToolsController] listTools called');
    // In a real implementation, this might fetch tool info from the core package
    return [
      { name: 'file-reader', description: 'Reads files from the file system.', parameters: {} },
      { name: 'file-writer', description: 'Writes files to the file system.', parameters: {} },
      { name: 'shell-command', description: 'Executes shell commands.', parameters: {} },
    ];
  }
}
