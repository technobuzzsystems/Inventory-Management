import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import machinesRoutes from './modules/machines/machines.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import stockRoutes from './modules/stock/stock.routes';
import employeesRoutes from './modules/employees/employees.routes';
import issuesRoutes from './modules/issues/issues.routes';
import returnsRoutes from './modules/returns/returns.routes';
import reportsRoutes from './modules/reports/reports.routes';
import auditLogsRoutes from './modules/audit-logs/audit-logs.routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'Industrial Inventory & Stock Management API',
    timezone: env.TIMEZONE,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);

app.use(errorHandler);

export default app;
