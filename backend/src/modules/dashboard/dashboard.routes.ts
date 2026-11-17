import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import {
  calculateDaysHeld,
  isPastExpectedDate
} from '../../utils/date-utils';

const router = Router();
router.use(authenticateJWT);

router.get(
  '/summary',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        allItems,
        totalMachines,
        pendingIssueItems,
        recentTransactions
      ] = await Promise.all([
        prisma.inventoryItem.findMany({
          where: { status: 'ACTIVE' },
          include: {
            category: true,
            subcategory: true,
            machine: true
          }
        }),
        prisma.machine.count({ where: { status: 'ACTIVE' } }),
        prisma.issueItem.findMany({
          where: { pendingQuantity: { gt: 0 } },
          include: {
            inventoryItem: {
              include: { category: true, subcategory: true }
            },
            issue: {
              include: {
                employee: true,
                issuedBy: { select: { id: true, fullName: true } }
              }
            }
          },
          orderBy: { issue: { expectedReturnDate: 'asc' } }
        }),
        prisma.stockTransaction.findMany({
          include: {
            inventoryItem: {
              include: { category: true, subcategory: true }
            },
            employee: true,
            supplier: true,
            performedBy: { select: { id: true, fullName: true, username: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 15
        })
      ]);

      const totalInventoryItems = allItems.length;
      let totalStockQuantity = 0;
      let availableStock = 0;
      let issuedStock = 0;
      let damagedItems = 0;
      let lostItems = 0;
      const lowStockAlerts: typeof allItems = [];

      for (const item of allItems) {
        totalStockQuantity += item.totalStock;
        availableStock += item.availableStock;
        issuedStock += item.issuedStock;
        damagedItems += item.damagedStock;
        lostItems += item.lostStock;

        if (item.availableStock <= item.minimumStockLevel) {
          lowStockAlerts.push(item);
        }
      }

      let pendingReturnsCount = 0;
      let pendingReturnsQty = 0;
      let overdueReturnsCount = 0;
      let overdueReturnsQty = 0;
      const overdueItemsList: Array<Record<string, unknown>> = [];

      for (const ii of pendingIssueItems) {
        pendingReturnsCount++;
        pendingReturnsQty += ii.pendingQuantity;

        const overdue = isPastExpectedDate(
          ii.issue.expectedReturnDate,
          ii.pendingQuantity
        );
        const daysHeld = calculateDaysHeld(ii.issue.issueDate, null);

        if (overdue) {
          overdueReturnsCount++;
          overdueReturnsQty += ii.pendingQuantity;
          overdueItemsList.push({
            issueItemId: ii.id,
            issueId: ii.issueId,
            issueReference: ii.issue.issueReference,
            employee: ii.issue.employee,
            department: ii.issue.department,
            inventoryItem: ii.inventoryItem,
            issuedQuantity: ii.issuedQuantity,
            pendingQuantity: ii.pendingQuantity,
            issueDate: ii.issue.issueDate,
            expectedReturnDate: ii.issue.expectedReturnDate,
            daysHeld,
            status: 'OVERDUE'
          });
        }
      }

      // Monthly Stock In / Out Analytics (last 12 months)
      const now = new Date();
      const twelveMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 11,
        1
      );
      const monthlyTxs = await prisma.stockTransaction.findMany({
        where: {
          createdAt: { gte: twelveMonthsAgo }
        },
        select: {
          transactionType: true,
          quantity: true,
          createdAt: true
        }
      });

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];
      const monthlyMap = new Map<
        string,
        { month: string; stockIn: number; stockOut: number; returnsIn: number }
      >();

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}`;
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthlyMap.set(key, {
          month: label,
          stockIn: 0,
          stockOut: 0,
          returnsIn: 0
        });
      }

      for (const tx of monthlyTxs) {
        const d = new Date(tx.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}`;
        const bucket = monthlyMap.get(key);
        if (!bucket) continue;

        if (
          tx.transactionType === 'PURCHASE_IN' ||
          tx.transactionType === 'OPENING' ||
          tx.transactionType === 'ADJUSTMENT_ADD'
        ) {
          bucket.stockIn += tx.quantity;
        } else if (
          tx.transactionType === 'ISSUE_OUT' ||
          tx.transactionType === 'DIRECT_OUT' ||
          tx.transactionType === 'ADJUSTMENT_DEDUCT'
        ) {
          bucket.stockOut += tx.quantity;
        } else if (tx.transactionType === 'RETURN_IN') {
          bucket.returnsIn += tx.quantity;
        }
      }

      res.json({
        success: true,
        data: {
          cards: {
            totalInventoryItems,
            totalMachines,
            totalStockQuantity,
            availableStock,
            issuedStock,
            pendingReturns: pendingReturnsCount,
            pendingReturnsQuantity: pendingReturnsQty,
            overdueReturns: overdueReturnsCount,
            overdueReturnsQuantity: overdueReturnsQty,
            damagedItems,
            lostItems,
            lowStockAlertsCount: lowStockAlerts.length
          },
          lowStockAlerts,
          overdueReturnsList: overdueItemsList,
          recentTransactions,
          monthlyAnalytics: Array.from(monthlyMap.values())
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
