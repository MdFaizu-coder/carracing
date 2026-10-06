import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { apiRouter } from './server/routes';
import { getDatabase } from './server/db';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Body and cookie parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Initialize relational DB on startup
  try {
    await getDatabase();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }

  // Mount API router
  app.use('/api', apiRouter);

  // Vite development integration or static serving
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.get('*', (_req, res) => {
        res.send('Production build not found. Please run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
