import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();
router.use(authenticateJWT);

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        action,
        entityType,
        userId,
        inventoryItemId,
        startDate,
        endDate,
        search
      } = req.query;

      const where: Record<string, unknown> = {};

      if (action && typeof action === 'string') {
        where.action = action;
      }
      if (entityType && typeof entityType === 'string') {
        where.entityType = entityType;
      }
      if (userId && typeof userId === 'string') {
        where.userId = userId;
      }
      if (inventoryItemId && typeof inventoryItemId === 'string') {
        where.inventoryItemId = inventoryItemId;
      }
      if (startDate || endDate) {
        const createdAt: Record<string, Date> = {};
        if (startDate && typeof startDate === 'string') {
          createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
        }
        if (endDate && typeof endDate === 'string') {
          createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
        }
        where.createdAt = createdAt;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { transactionReference: { contains: search, mode: 'insensitive' } },
          { user: { fullName: { contains: search, mode: 'insensitive' } } },
          { user: { username: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 400
      });

      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
