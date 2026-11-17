import app from './app';
import { env } from './config/env';
import { prisma } from './config/db';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL database successfully.');

    app.listen(env.PORT, () => {
      console.log(
        `[SERVER] Industrial Inventory API running on http://localhost:${env.PORT}`
      );
    });
  } catch (error) {
    console.error('[BOOTSTRAP_ERROR] Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
