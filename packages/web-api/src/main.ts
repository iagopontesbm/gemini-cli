import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // It's good practice to enable CORS if the frontend will be on a different port/domain
  app.enableCors();

  // Add global pipes for validation if using class-validator DTOs
  // import { ValidationPipe } from '@nestjs/common';
  // app.useGlobalPipes(new ValidationPipe());

  const port = process.env.PORT || 3001; // Default port for the API
  await app.listen(port);
  console.log(`Web API server running on port ${port}`);
}
bootstrap();
