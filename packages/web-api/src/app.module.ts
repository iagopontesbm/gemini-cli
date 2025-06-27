import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
// Import other modules here (ChatModule, FsModule, ToolsModule) as they are created

@Module({
  imports: [
    ConfigModule,
    // ChatModule,
    // FsModule,
    // ToolsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
