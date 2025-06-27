import { Controller, Get, Patch, Body, Param, Post, Delete, Put } from '@nestjs/common';
import { ConfigService, UpdateSystemSettingsDto, CreateMcpServerDto, UpdateMcpServerDto, UpdateLlmSettingsDto } from './config.service';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('system')
  async getSystemSettings() {
    return this.configService.getSystemSettings();
  }

  @Patch('system')
  async updateSystemSettings(@Body() updateDto: UpdateSystemSettingsDto) {
    // Add DTO validation here in a real app using ValidationPipe and class-validator decorators in DTO
    return this.configService.updateSystemSettings(updateDto);
  }

  @Get('mcp-servers')
  async getMcpServers() {
    return this.configService.getMcpServers();
  }

  @Post('mcp-servers')
  async addMcpServer(@Body() createDto: CreateMcpServerDto) {
    return this.configService.addMcpServer(createDto);
  }

  @Get('mcp-servers/:serverId')
  async getMcpServer(@Param('serverId') serverId: string) {
    return this.configService.getMcpServer(serverId);
  }

  @Put('mcp-servers/:serverId')
  async updateMcpServer(@Param('serverId') serverId: string, @Body() updateDto: UpdateMcpServerDto) {
    return this.configService.updateMcpServer(serverId, updateDto);
  }

  @Delete('mcp-servers/:serverId')
  async deleteMcpServer(@Param('serverId') serverId: string) {
    return this.configService.deleteMcpServer(serverId);
  }

  @Get('llm')
  async getLlmSettings() {
    return this.configService.getLlmSettings();
  }

  @Patch('llm')
  async updateLlmSettings(@Body() updateDto: UpdateLlmSettingsDto) {
    return this.configService.updateLlmSettings(updateDto);
  }
}
