import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || null
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      res.status(409).json({
        success: false,
        message: `Duplicate record: A record with this ${target} already exists.`
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Requested record was not found.'
      });
      return;
    }
  }

  console.error('[UNHANDLED_ERROR]', err);
  const message =
    err instanceof Error ? err.message : 'An unexpected internal server error occurred';
  res.status(500).json({
    success: false,
    message
  });
}
