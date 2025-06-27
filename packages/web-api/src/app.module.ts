import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { FsModule } from './fs/fs.module';
import { ChatModule } from './chat/chat.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule,
    FsModule,
    ChatModule,
    ToolsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
