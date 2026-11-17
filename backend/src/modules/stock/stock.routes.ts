import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  AdjustmentType,
  RecordStatus,
  RoleName,
  StockTransactionType
} from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import {
  authenticateJWT,
  authorizeRoles
} from '../../middlewares/auth.middleware';
import { recordAuditLog } from '../../utils/audit-logger';
import { generateReferenceCode } from '../../utils/date-utils';

const router = Router();
router.use(authenticateJWT);

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  code: z.string().optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE)
});

const stockInSchema = z.object({
  inventoryItemId: z.string().uuid('Valid Inventory Item ID is required'),
  transactionType: z
    .enum(['PURCHASE_IN', 'RETURN_IN'])
    .optional()
    .default('PURCHASE_IN'),
  supplierId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  invoiceReference: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0).optional().default(0),
  remarks: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable()
});

const stockOutSchema = z.object({
  inventoryItemId: z.string().uuid('Valid Inventory Item ID is required'),
  employeeId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  remarks: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable()
});

const stockAdjustmentSchema = z.object({
  inventoryItemId: z.string().uuid('Valid Inventory Item ID is required'),
  adjustmentType: z.nativeEnum(AdjustmentType),
  quantity: z.number().int().positive('Adjustment quantity must be > 0'),
  reason: z.string().min(3, 'A clear reason is mandatory for stock adjustments')
});

// Suppliers CRUD
router.get(
  '/suppliers',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const suppliers = await prisma.supplier.findMany({
        orderBy: { name: 'asc' }
      });
      res.json({ success: true, data: suppliers });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/suppliers',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = supplierSchema.parse(req.body);
      const code =
        parsed.code && parsed.code.trim().length > 0
          ? parsed.code.trim().toUpperCase()
          : generateReferenceCode('SUP');

      const supplier = await prisma.supplier.create({
        data: {
          name: parsed.name.trim(),
          code,
          contactPerson: parsed.contactPerson || null,
          phone: parsed.phone || null,
          email: parsed.email || null,
          address: parsed.address || null,
          gstNumber: parsed.gstNumber || null,
          status: parsed.status
        }
      });

      await recordAuditLog({
        action: 'SUPPLIER_CREATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        newValues: supplier as unknown as Record<string, unknown>,
        description: `Created supplier ${supplier.name}`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }
);

// List all stock transactions
router.get(
  '/transactions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        inventoryItemId,
        transactionType,
        startDate,
        endDate,
        search
      } = req.query;

      const where: Record<string, unknown> = {};
      if (inventoryItemId && typeof inventoryItemId === 'string') {
        where.inventoryItemId = inventoryItemId;
      }
      if (transactionType && typeof transactionType === 'string') {
        where.transactionType = transactionType;
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
          { transactionRef: { contains: search, mode: 'insensitive' } },
          { invoiceReference: { contains: search, mode: 'insensitive' } },
          { remarks: { contains: search, mode: 'insensitive' } },
          {
            inventoryItem: {
              OR: [
                { itemName: { contains: search, mode: 'insensitive' } },
                { itemCode: { contains: search, mode: 'insensitive' } },
                { toolNumber: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ];
      }

      const transactions = await prisma.stockTransaction.findMany({
        where,
        include: {
          inventoryItem: {
            include: { category: true, subcategory: true, machine: true }
          },
          supplier: true,
          employee: true,
          performedBy: { select: { id: true, fullName: true, username: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 300
      });

      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }
);

// STOCK IN: Add new purchased stock or returned stock (Scenario 1)
router.post(
  '/in',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = stockInSchema.parse(req.body);

      if (parsed.idempotencyKey) {
        const existingTx = await prisma.stockTransaction.findUnique({
          where: { idempotencyKey: parsed.idempotencyKey }
        });
        if (existingTx) {
          throw new AppError('Duplicate stock-in submission prevented', 409);
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Row-level pessimistic lock on inventory_items
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            item_name: string;
            available_stock: number;
            total_stock: number;
            status: string;
          }>
        >`SELECT id, item_name, available_stock, total_stock, status FROM inventory_items WHERE id = ${parsed.inventoryItemId} FOR UPDATE`;

        if (!lockedRows || lockedRows.length === 0) {
          throw new AppError('Inventory item not found', 404);
        }

        const itemRow = lockedRows[0];
        if (itemRow.status !== 'ACTIVE') {
          throw new AppError(
            `Cannot add stock to inactive item '${itemRow.item_name}'`,
            400
          );
        }

        const prevAvail = Number(itemRow.available_stock);
        const prevTotal = Number(itemRow.total_stock);
        const newAvail = prevAvail + parsed.quantity;
        const newTotal = prevTotal + parsed.quantity;

        const updatedItem = await tx.inventoryItem.update({
          where: { id: parsed.inventoryItemId },
          data: {
            availableStock: newAvail,
            totalStock: newTotal
          }
        });

        const txRef = generateReferenceCode('SIN');
        const unitPrice = parsed.unitPrice || 0;
        const totalAmount = Number((unitPrice * parsed.quantity).toFixed(2));

        const stockTx = await tx.stockTransaction.create({
          data: {
            transactionRef: txRef,
            inventoryItemId: parsed.inventoryItemId,
            transactionType: parsed.transactionType as StockTransactionType,
            supplierId: parsed.supplierId || null,
            invoiceReference: parsed.invoiceReference || null,
            purchaseDate: parsed.purchaseDate
              ? new Date(parsed.purchaseDate)
              : new Date(),
            quantity: parsed.quantity,
            unitPrice,
            totalAmount,
            previousAvailableStock: prevAvail,
            newAvailableStock: newAvail,
            previousTotalStock: prevTotal,
            newTotalStock: newTotal,
            remarks: parsed.remarks || 'Stock IN transaction',
            performedById: req.user!.id,
            idempotencyKey: parsed.idempotencyKey || null
          },
          include: {
            inventoryItem: true,
            supplier: true
          }
        });

        await recordAuditLog(
          {
            action: 'STOCK_IN',
            entityType: 'INVENTORY_ITEM',
            entityId: updatedItem.id,
            transactionReference: txRef,
            inventoryItemId: updatedItem.id,
            previousQuantity: prevAvail,
            updatedQuantity: newAvail,
            newValues: {
              addedQuantity: parsed.quantity,
              invoiceReference: parsed.invoiceReference,
              supplierId: parsed.supplierId
            },
            description: `Added ${parsed.quantity} units to '${updatedItem.itemName}'. Available: ${prevAvail} -> ${newAvail}`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return { item: updatedItem, transaction: stockTx };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// STOCK OUT (Direct consumable / non-returnable stock out or direct employee issue)
router.post(
  '/out',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = stockOutSchema.parse(req.body);

      if (parsed.idempotencyKey) {
        const existingTx = await prisma.stockTransaction.findUnique({
          where: { idempotencyKey: parsed.idempotencyKey }
        });
        if (existingTx) {
          throw new AppError('Duplicate stock-out submission prevented', 409);
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            item_name: string;
            available_stock: number;
            total_stock: number;
            issued_stock: number;
            status: string;
          }>
        >`SELECT id, item_name, available_stock, total_stock, issued_stock, status FROM inventory_items WHERE id = ${parsed.inventoryItemId} FOR UPDATE`;

        if (!lockedRows || lockedRows.length === 0) {
          throw new AppError('Inventory item not found', 404);
        }

        const itemRow = lockedRows[0];
        const prevAvail = Number(itemRow.available_stock);
        const prevTotal = Number(itemRow.total_stock);

        if (prevAvail < parsed.quantity) {
          throw new AppError(
            `Insufficient available stock for '${itemRow.item_name}'. Available: ${prevAvail}, Requested: ${parsed.quantity}`,
            409
          );
        }

        const newAvail = prevAvail - parsed.quantity;
        const newTotal = prevTotal - parsed.quantity;

        const updatedItem = await tx.inventoryItem.update({
          where: { id: parsed.inventoryItemId },
          data: {
            availableStock: newAvail,
            totalStock: newTotal
          }
        });

        const txRef = generateReferenceCode('SOUT');
        const stockTx = await tx.stockTransaction.create({
          data: {
            transactionRef: txRef,
            inventoryItemId: parsed.inventoryItemId,
            transactionType: StockTransactionType.DIRECT_OUT,
            employeeId: parsed.employeeId || null,
            quantity: parsed.quantity,
            previousAvailableStock: prevAvail,
            newAvailableStock: newAvail,
            previousTotalStock: prevTotal,
            newTotalStock: newTotal,
            remarks: parsed.remarks || 'Direct Stock OUT',
            performedById: req.user!.id,
            idempotencyKey: parsed.idempotencyKey || null
          },
          include: {
            inventoryItem: true,
            employee: true
          }
        });

        await recordAuditLog(
          {
            action: 'STOCK_OUT',
            entityType: 'INVENTORY_ITEM',
            entityId: updatedItem.id,
            transactionReference: txRef,
            inventoryItemId: updatedItem.id,
            previousQuantity: prevAvail,
            updatedQuantity: newAvail,
            description: `Stock OUT of ${parsed.quantity} units for '${updatedItem.itemName}'. Available: ${prevAvail} -> ${newAvail}`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return { item: updatedItem, transaction: stockTx };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// STOCK ADJUSTMENTS (Requires reason and Admin / Super Admin permission)
router.get(
  '/adjustments',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const adjustments = await prisma.stockAdjustment.findMany({
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          authorizedBy: { select: { id: true, fullName: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: adjustments });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/adjustments',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = stockAdjustmentSchema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        const lockedRows = await tx.$queryRaw<
          Array<{
            id: string;
            item_name: string;
            available_stock: number;
            total_stock: number;
            damaged_stock: number;
            lost_stock: number;
          }>
        >`SELECT id, item_name, available_stock, total_stock, damaged_stock, lost_stock FROM inventory_items WHERE id = ${parsed.inventoryItemId} FOR UPDATE`;

        if (!lockedRows || lockedRows.length === 0) {
          throw new AppError('Inventory item not found', 404);
        }

        const row = lockedRows[0];
        const prevAvail = Number(row.available_stock);
        const prevTotal = Number(row.total_stock);
        let newAvail = prevAvail;
        let newTotal = prevTotal;
        let newDamaged = Number(row.damaged_stock);
        let newLost = Number(row.lost_stock);
        let txType: StockTransactionType = StockTransactionType.ADJUSTMENT_ADD;

        if (parsed.adjustmentType === AdjustmentType.ADD) {
          newAvail += parsed.quantity;
          newTotal += parsed.quantity;
          txType = StockTransactionType.ADJUSTMENT_ADD;
        } else if (parsed.adjustmentType === AdjustmentType.DEDUCT) {
          if (prevAvail < parsed.quantity) {
            throw new AppError(
              `Cannot deduct ${parsed.quantity} units. Available stock is only ${prevAvail}`,
              409
            );
          }
          newAvail -= parsed.quantity;
          newTotal -= parsed.quantity;
          txType = StockTransactionType.ADJUSTMENT_DEDUCT;
        } else if (parsed.adjustmentType === AdjustmentType.MARK_DAMAGED) {
          if (prevAvail < parsed.quantity) {
            throw new AppError(
              `Cannot mark ${parsed.quantity} units damaged from available stock (${prevAvail})`,
              409
            );
          }
          newAvail -= parsed.quantity;
          newDamaged += parsed.quantity;
          txType = StockTransactionType.DAMAGED;
        } else if (parsed.adjustmentType === AdjustmentType.MARK_LOST) {
          if (prevAvail < parsed.quantity) {
            throw new AppError(
              `Cannot mark ${parsed.quantity} units lost from available stock (${prevAvail})`,
              409
            );
          }
          newAvail -= parsed.quantity;
          newLost += parsed.quantity;
          txType = StockTransactionType.LOST;
        } else if (parsed.adjustmentType === AdjustmentType.RECOVER) {
          if (newDamaged < parsed.quantity) {
            throw new AppError(
              `Cannot recover ${parsed.quantity} units. Damaged stock is ${newDamaged}`,
              409
            );
          }
          newDamaged -= parsed.quantity;
          newAvail += parsed.quantity;
          txType = StockTransactionType.ADJUSTMENT_ADD;
        }

        const updatedItem = await tx.inventoryItem.update({
          where: { id: parsed.inventoryItemId },
          data: {
            availableStock: newAvail,
            totalStock: newTotal,
            damagedStock: newDamaged,
            lostStock: newLost
          }
        });

        const adjRef = generateReferenceCode('ADJ');
        const adjustment = await tx.stockAdjustment.create({
          data: {
            adjustmentRef: adjRef,
            inventoryItemId: parsed.inventoryItemId,
            adjustmentType: parsed.adjustmentType,
            quantity: parsed.quantity,
            previousAvailable: prevAvail,
            newAvailable: newAvail,
            reason: parsed.reason.trim(),
            authorizedById: req.user!.id
          }
        });

        await tx.stockTransaction.create({
          data: {
            transactionRef: adjRef,
            inventoryItemId: parsed.inventoryItemId,
            transactionType: txType,
            adjustmentId: adjustment.id,
            quantity: parsed.quantity,
            previousAvailableStock: prevAvail,
            newAvailableStock: newAvail,
            previousTotalStock: prevTotal,
            newTotalStock: newTotal,
            remarks: `Stock Adjustment (${parsed.adjustmentType}): ${parsed.reason}`,
            performedById: req.user!.id
          }
        });

        await recordAuditLog(
          {
            action: 'STOCK_ADJUSTMENT',
            entityType: 'INVENTORY_ITEM',
            entityId: updatedItem.id,
            transactionReference: adjRef,
            inventoryItemId: updatedItem.id,
            previousQuantity: prevAvail,
            updatedQuantity: newAvail,
            newValues: {
              adjustmentType: parsed.adjustmentType,
              quantity: parsed.quantity,
              reason: parsed.reason
            },
            description: `Adjusted stock (${parsed.adjustmentType}) by ${parsed.quantity} for '${updatedItem.itemName}'. Reason: ${parsed.reason}`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return { item: updatedItem, adjustment };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
