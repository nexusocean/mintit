import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as nunjucks from 'nunjucks';

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'debug'],
  });

  // Trust exactly one hop's X-Forwarded-For so req.ip
  // reflects the real client instead of Caddy's or mint_web's container IP.
  app.set('trust proxy', 1);

  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('v1', {
    exclude: ['/docs', '/i/:publicId', '/i/:publicId/status'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Payments API')
      .setDescription('REST API for payment processor')
      .setVersion('0.1.0')
      .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'api-key')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    writeFileSync(
      join(process.cwd(), 'docs', 'swagger.json'),
      JSON.stringify(document, null, 2),
    );
  }

  nunjucks.configure(join(__dirname, 'pages'), {
    autoescape: true,
    express: app.getHttpAdapter().getInstance(),
  });

  app.useStaticAssets(join(__dirname, 'public'));

  const webDist = join(__dirname, 'web');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist);
    app
      .getHttpAdapter()
      .getInstance()
      .get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/v1') || req.path.startsWith('/i/')) {
          next();
          return;
        }
        res.sendFile(join(webDist, 'index.html'));
      });
  }

  await app.listen(3000);

  if (!isProd) {
    console.log(`Dashboard at: http://localhost:5173`);
    console.log('Swagger docs: http://localhost:3000/docs');
  }
}

void bootstrap();
