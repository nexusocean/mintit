import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const webRoot = join(__dirname, '..', 'web');

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: webRoot,
      // Backend owns only these prefixes
      // unknown paths fall back to index.html.
      exclude: ['/v1/{*path}', '/i/{*path}'],
      serveStaticOptions: {
        setHeaders: (res, filePath) => {
          res.setHeader(
            'Cache-Control',
            filePath.endsWith('index.html')
              ? 'no-cache'
              : 'public, max-age=31536000, immutable',
          );
        },
      },
    }),
  ],
})
export class DashboardModule {}
