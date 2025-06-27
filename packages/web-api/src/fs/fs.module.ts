import { Module } from '@nestjs/common';
import { FsController } from './fs.controller';
// import { FsService } from './fs.service'; // If you create a service

@Module({
  controllers: [FsController],
  // providers: [FsService], // If you create a service
})
export class FsModule {}
