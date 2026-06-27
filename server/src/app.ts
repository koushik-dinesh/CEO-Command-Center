import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import driveExplorerRoutes from './routes/driveExplorer.js';
import healthRoutes from './routes/health.js';
import ingestionRoutes from './routes/ingestion.js';
import kpiRoutes from './routes/kpis.js';
import processingRoutes from './routes/processing.js';
import revenueRoutes from './routes/revenue.js';
import commandCenterRoutes from './routes/commandCenter.js';
import pbtRoutes from './routes/pbt.js';
import productivityRoutes from './routes/productivity.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(morgan('tiny'));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/drive-explorer', driveExplorerRoutes);
  app.use('/api/kpis', kpiRoutes);
  app.use('/api/processing', processingRoutes);
  app.use('/api/ingestion', ingestionRoutes);
  app.use('/api/revenue', revenueRoutes);
  app.use('/api/command-center', commandCenterRoutes);
  app.use('/api/pbt', pbtRoutes);
  app.use('/api/productivity', productivityRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
