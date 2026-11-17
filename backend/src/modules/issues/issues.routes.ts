import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  IssueReturnStatus,
  RoleName,
  SerialStatus,
  StockTransactionType
} from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import {
  authenticateJWT,
  authorizeRoles
} from '../../middlewares/auth.middleware';
import { recordAuditLog } from '../../utils/audit-logger';
import {
  calculateDaysHeld,
  generateReferenceCode,
  getCurrentISTTimeString,
  isPastExpectedDate
} from '../../utils/date-utils';

const router = Router();
router.use(authenticateJWT);

const issueItemInputSchema = z.object({
  inventoryItemId: z.string().uuid('Valid Inventory Item ID is required'),
  issueQuantity: z.number().int().positive('Issue quantity must be >= 1'),
  serialAssetId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable()
});

const createIssueSchema = z.object({
  employeeId: z.string().uuid('Employee is required'),
  department: z.string().optional(),
  issueDate: z.string().optional(),
  issueTime: z.string().optional(),
  expectedReturnDate: z.string().min(1, 'Expected return date is required'),
  purposeRemarks: z.string().optional().nullable(),
  issueReference: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  // Support single-item or multi-item payload seamlessly
  inventoryItemId: z.string().uuid().optional(),
  issueQuantity: z.number().int().positive().optional(),
  items: z.array(issueItemInputSchema).optional()
});

function enrichIssueWithDynamicFields(issue: any) {
  const enrichedItems = (issue.items || []).map((ii: any) => {
    const overdue = isPastExpectedDate(
      issue.expectedReturnDate,
      ii.pendingQuantity
    );
    const effectiveItemStatus = overdue
      ? IssueReturnStatus.OVERDUE
      : ii.itemStatus;
    const daysHeld = calculateDaysHeld(
      issue.issueDate,
      ii.actualReturnDate || issue.actualFinalReturnDate
    );

    return {
      ...ii,
      effectiveStatus: effectiveItemStatus,
      isOverdue: overdue,
      daysHeld
    };
  });

  const totalIssuedQty = enrichedItems.reduce(
    (sum: number, i: any) => sum + i.issuedQuantity,
    0
  );
  const totalAcceptedReturnedQty = enrichedItems.reduce(
    (sum: number, i: any) => sum + i.acceptedReturnedQuantity,
    0
  );
  const totalPendingQty = enrichedItems.reduce(
    (sum: number, i: any) => sum + i.pendingQuantity,
    0
  );
  const anyOverdue = enrichedItems.some((i: any) => i.isOverdue);

  const effectiveIssueStatus =
    totalPendingQty > 0 && anyOverdue ? IssueReturnStatus.OVERDUE : issue.status;

  const daysHeld = calculateDaysHeld(
    issue.issueDate,
    issue.actualFinalReturnDate
  );

  return {
    ...issue,
    status: effectiveIssueStatus,
    isOverdue: anyOverdue,
    daysHeld,
    totalIssuedQty,
    totalAcceptedReturnedQty,
    totalPendingQty,
    items: enrichedItems
  };
}

// List all issues with filters
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, status, department, search, startDate, endDate } =
        req.query;
      const where: Record<string, unknown> = {};

      if (req.user!.role === RoleName.EMPLOYEE && req.user!.employeeId) {
        where.employeeId = req.user!.employeeId;
      } else if (employeeId && typeof employeeId === 'string') {
        where.employeeId = employeeId;
      }

      if (department && typeof department === 'string') {
        where.department = { equals: department, mode: 'insensitive' };
      }

      if (startDate || endDate) {
        const issueDate: Record<string, Date> = {};
        if (startDate && typeof startDate === 'string') {
          issueDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        }
        if (endDate && typeof endDate === 'string') {
          issueDate.lte = new Date(`${endDate}T23:59:59.999Z`);
        }
        where.issueDate = issueDate;
      }

      if (search && typeof search === 'string') {
        where.OR = [
          { issueReference: { contains: search, mode: 'insensitive' } },
          { purposeRemarks: { contains: search, mode: 'insensitive' } },
          { employee: { name: { contains: search, mode: 'insensitive' } } },
          {
            employee: { employeeCode: { contains: search, mode: 'insensitive' } }
          },
          {
            items: {
              some: {
                inventoryItem: {
                  OR: [
                    { itemName: { contains: search, mode: 'insensitive' } },
                    { itemCode: { contains: search, mode: 'insensitive' } },
                    { toolNumber: { contains: search, mode: 'insensitive' } }
                  ]
                }
              }
            }
          }
        ];
      }

      const issues = await prisma.inventoryIssue.findMany({
        where,
        include: {
          employee: true,
          issuedBy: { select: { id: true, fullName: true, username: true } },
          items: {
            include: {
              inventoryItem: {
                include: { category: true, subcategory: true, machine: true }
              },
              serialAsset: true,
              returnItems: {
                include: {
                  returnRecord: {
                    include: {
                      receivedBy: { select: { id: true, fullName: true } }
                    }
                  }
                }
              }
            }
          },
          returns: {
            include: {
              receivedBy: { select: { id: true, fullName: true } },
              items: true
            },
            orderBy: { returnDate: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      let enriched = issues.map(enrichIssueWithDynamicFields);

      if (status && typeof status === 'string') {
        enriched = enriched.filter((iss) => iss.status === status);
      }

      res.json({ success: true, data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// Get single issue details
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const issue = await prisma.inventoryIssue.findUnique({
        where: { id },
        include: {
          employee: true,
          issuedBy: { select: { id: true, fullName: true, username: true } },
          items: {
            include: {
              inventoryItem: {
                include: { category: true, subcategory: true, machine: true }
              },
              serialAsset: true,
              returnItems: {
                include: {
                  returnRecord: {
                    include: {
                      receivedBy: { select: { id: true, fullName: true } }
                    }
                  }
                }
              }
            }
          },
          returns: {
            include: {
              receivedBy: { select: { id: true, fullName: true } },
              items: { include: { inventoryItem: true } }
            },
            orderBy: { returnDate: 'desc' }
          }
        }
      });

      if (!issue) throw new AppError('Issue record not found', 404);
      res.json({ success: true, data: enrichIssueWithDynamicFields(issue) });
    } catch (err) {
      next(err);
    }
  }
);

// Create Issue / Checkout Transaction (Scenarios 2 & 7: Row-level lock to prevent overselling under concurrent requests)
router.post(
  '/',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createIssueSchema.parse(req.body);

      const itemsToIssue =
        parsed.items && parsed.items.length > 0
          ? parsed.items
          : parsed.inventoryItemId && parsed.issueQuantity
          ? [
              {
                inventoryItemId: parsed.inventoryItemId,
                issueQuantity: parsed.issueQuantity,
                serialAssetId: null,
                remarks: parsed.purposeRemarks || null
              }
            ]
          : [];

      if (itemsToIssue.length === 0) {
        throw new AppError(
          'At least one inventory item and quantity must be specified to issue',
          400
        );
      }

      if (parsed.idempotencyKey) {
        const duplicate = await prisma.inventoryIssue.findUnique({
          where: { idempotencyKey: parsed.idempotencyKey }
        });
        if (duplicate) {
          throw new AppError('Duplicate issue submission prevented', 409);
        }
      }

      const createdIssue = await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: parsed.employeeId }
        });
        if (!employee || employee.status !== 'ACTIVE') {
          throw new AppError(
            'Selected employee not found or is currently inactive',
            400
          );
        }

        const issueRef =
          parsed.issueReference && parsed.issueReference.trim().length > 0
            ? parsed.issueReference.trim().toUpperCase()
            : generateReferenceCode('ISS');

        const issueHeader = await tx.inventoryIssue.create({
          data: {
            issueReference: issueRef,
            employeeId: employee.id,
            department: parsed.department?.trim() || employee.department,
            issueDate: parsed.issueDate ? new Date(parsed.issueDate) : new Date(),
            issueTime: parsed.issueTime || getCurrentISTTimeString(),
            expectedReturnDate: new Date(parsed.expectedReturnDate),
            purposeRemarks: parsed.purposeRemarks || null,
            issuedById: req.user!.id,
            status: IssueReturnStatus.PENDING,
            idempotencyKey: parsed.idempotencyKey || null
          }
        });

        // Sort item IDs before locking to prevent deadlocks when issuing multiple items concurrently
        const sortedItems = [...itemsToIssue].sort((a, b) =>
          a.inventoryItemId.localeCompare(b.inventoryItemId)
        );

        for (const reqItem of sortedItems) {
          // Acquire pessimistic row lock on inventory_items
          const lockedRows = await tx.$queryRaw<
            Array<{
              id: string;
              item_name: string;
              available_stock: number;
              issued_stock: number;
              total_stock: number;
              status: string;
            }>
          >`SELECT id, item_name, available_stock, issued_stock, total_stock, status FROM inventory_items WHERE id = ${reqItem.inventoryItemId} FOR UPDATE`;

          if (!lockedRows || lockedRows.length === 0) {
            throw new AppError(
              `Inventory item ${reqItem.inventoryItemId} not found`,
              404
            );
          }

          const itemRow = lockedRows[0];
          if (itemRow.status !== 'ACTIVE') {
            throw new AppError(
              `Inventory item '${itemRow.item_name}' is inactive and cannot be issued`,
              400
            );
          }

          const prevAvail = Number(itemRow.available_stock);
          const prevIssued = Number(itemRow.issued_stock);
          const prevTotal = Number(itemRow.total_stock);

          if (prevAvail < reqItem.issueQuantity) {
            throw new AppError(
              `Insufficient available stock for '${itemRow.item_name}'. Available: ${prevAvail}, Requested: ${reqItem.issueQuantity}`,
              409
            );
          }

          const newAvail = prevAvail - reqItem.issueQuantity;
          const newIssued = prevIssued + reqItem.issueQuantity;

          await tx.inventoryItem.update({
            where: { id: reqItem.inventoryItemId },
            data: {
              availableStock: newAvail,
              issuedStock: newIssued
            }
          });

          if (reqItem.serialAssetId) {
            await tx.inventorySerialAsset.update({
              where: { id: reqItem.serialAssetId },
              data: {
                status: SerialStatus.ISSUED,
                currentEmployeeId: employee.id
              }
            });
          }

          await tx.issueItem.create({
            data: {
              issueId: issueHeader.id,
              inventoryItemId: reqItem.inventoryItemId,
              serialAssetId: reqItem.serialAssetId || null,
              issuedQuantity: reqItem.issueQuantity,
              acceptedReturnedQuantity: 0,
              damagedQuantity: 0,
              lostQuantity: 0,
              pendingQuantity: reqItem.issueQuantity,
              itemStatus: IssueReturnStatus.PENDING,
              remarks: reqItem.remarks || parsed.purposeRemarks || null
            }
          });

          const txRef = generateReferenceCode('ISSTX');
          await tx.stockTransaction.create({
            data: {
              transactionRef: txRef,
              inventoryItemId: reqItem.inventoryItemId,
              transactionType: StockTransactionType.ISSUE_OUT,
              employeeId: employee.id,
              issueId: issueHeader.id,
              quantity: reqItem.issueQuantity,
              previousAvailableStock: prevAvail,
              newAvailableStock: newAvail,
              previousTotalStock: prevTotal,
              newTotalStock: prevTotal,
              remarks: `Issued to ${employee.name} (${employee.employeeCode}) under ${issueRef}`,
              performedById: req.user!.id
            }
          });

          await recordAuditLog(
            {
              action: 'INVENTORY_ISSUE',
              entityType: 'INVENTORY_ISSUE',
              entityId: issueHeader.id,
              transactionReference: issueRef,
              inventoryItemId: reqItem.inventoryItemId,
              previousQuantity: prevAvail,
              updatedQuantity: newAvail,
              newValues: {
                employeeId: employee.id,
                employeeName: employee.name,
                issuedQuantity: reqItem.issueQuantity,
                expectedReturnDate: parsed.expectedReturnDate
              },
              description: `Issued ${reqItem.issueQuantity} units of '${itemRow.item_name}' to ${employee.name}. Available: ${prevAvail} -> ${newAvail}, Issued: ${prevIssued} -> ${newIssued}`,
              userId: req.user!.id,
              ipAddress: req.ip
            },
            tx
          );
        }

        return tx.inventoryIssue.findUnique({
          where: { id: issueHeader.id },
          include: {
            employee: true,
            issuedBy: { select: { id: true, fullName: true, username: true } },
            items: {
              include: {
                inventoryItem: {
                  include: { category: true, subcategory: true, machine: true }
                }
              }
            }
          }
        });
      });

      res.status(201).json({
        success: true,
        data: enrichIssueWithDynamicFields(createdIssue)
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
