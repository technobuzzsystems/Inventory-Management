import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  IssueReturnStatus,
  ReturnCondition,
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

const returnItemInputSchema = z.object({
  issueItemId: z.string().uuid('Valid Issue Item ID is required'),
  returnedQuantity: z.number().int().positive('Returned quantity must be >= 1'),
  condition: z
    .nativeEnum(ReturnCondition)
    .optional()
    .default(ReturnCondition.GOOD),
  remarks: z.string().optional().nullable()
});

const processReturnSchema = z.object({
  issueId: z.string().uuid('Issue ID is required'),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  remarks: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  // Support single-item or multi-item return payload seamlessly
  issueItemId: z.string().uuid().optional(),
  returnedQuantity: z.number().int().positive().optional(),
  condition: z.nativeEnum(ReturnCondition).optional(),
  items: z.array(returnItemInputSchema).optional()
});

// List all return transactions
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, issueId, condition, startDate, endDate, search } =
        req.query;
      const where: Record<string, unknown> = {};

      if (req.user!.role === RoleName.EMPLOYEE && req.user!.employeeId) {
        where.employeeId = req.user!.employeeId;
      } else if (employeeId && typeof employeeId === 'string') {
        where.employeeId = employeeId;
      }

      if (issueId && typeof issueId === 'string') {
        where.issueId = issueId;
      }

      if (startDate || endDate) {
        const returnDate: Record<string, Date> = {};
        if (startDate && typeof startDate === 'string') {
          returnDate.gte = new Date(`${startDate}T00:00:00.000Z`);
        }
        if (endDate && typeof endDate === 'string') {
          returnDate.lte = new Date(`${endDate}T23:59:59.999Z`);
        }
        where.returnDate = returnDate;
      }

      if (condition && typeof condition === 'string') {
        where.items = {
          some: { condition: condition as ReturnCondition }
        };
      }

      if (search && typeof search === 'string') {
        where.OR = [
          { returnReference: { contains: search, mode: 'insensitive' } },
          { issue: { issueReference: { contains: search, mode: 'insensitive' } } },
          { employee: { name: { contains: search, mode: 'insensitive' } } },
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

      const returns = await prisma.inventoryReturn.findMany({
        where,
        include: {
          issue: true,
          employee: true,
          receivedBy: { select: { id: true, fullName: true, username: true } },
          items: {
            include: {
              inventoryItem: {
                include: { category: true, subcategory: true, machine: true }
              },
              issueItem: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: returns });
    } catch (err) {
      next(err);
    }
  }
);

// List all pending & overdue issued items ready for return
router.get(
  '/pending-items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { overdueOnly, employeeId, search } = req.query;
      const where: Record<string, unknown> = {
        pendingQuantity: { gt: 0 }
      };

      if (req.user!.role === RoleName.EMPLOYEE && req.user!.employeeId) {
        where.issue = { employeeId: req.user!.employeeId };
      } else if (employeeId && typeof employeeId === 'string') {
        where.issue = { employeeId };
      }

      if (search && typeof search === 'string') {
        where.OR = [
          {
            inventoryItem: {
              OR: [
                { itemName: { contains: search, mode: 'insensitive' } },
                { itemCode: { contains: search, mode: 'insensitive' } },
                { toolNumber: { contains: search, mode: 'insensitive' } }
              ]
            }
          },
          {
            issue: {
              OR: [
                { issueReference: { contains: search, mode: 'insensitive' } },
                { employee: { name: { contains: search, mode: 'insensitive' } } },
                {
                  employee: {
                    employeeCode: { contains: search, mode: 'insensitive' }
                  }
                }
              ]
            }
          }
        ];
      }

      const pendingIssueItems = await prisma.issueItem.findMany({
        where,
        include: {
          inventoryItem: {
            include: { category: true, subcategory: true, machine: true }
          },
          issue: {
            include: {
              employee: true,
              issuedBy: { select: { id: true, fullName: true, username: true } }
            }
          },
          returnItems: {
            include: {
              returnRecord: {
                include: {
                  receivedBy: { select: { id: true, fullName: true } }
                }
              }
            }
          }
        },
        orderBy: { issue: { expectedReturnDate: 'asc' } }
      });

      let enriched = pendingIssueItems.map((ii) => {
        const isOverdue = isPastExpectedDate(
          ii.issue.expectedReturnDate,
          ii.pendingQuantity
        );
        const daysHeld = calculateDaysHeld(ii.issue.issueDate, null);
        return {
          ...ii,
          effectiveStatus: isOverdue
            ? IssueReturnStatus.OVERDUE
            : ii.itemStatus,
          isOverdue,
          daysHeld
        };
      });

      if (overdueOnly === 'true') {
        enriched = enriched.filter((i) => i.isOverdue);
      }

      res.json({ success: true, data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// Process Return (Full, Partial, Damaged, or Lost) — Scenarios 3, 4, 6
router.post(
  '/',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = processReturnSchema.parse(req.body);

      const itemsToReturn =
        parsed.items && parsed.items.length > 0
          ? parsed.items
          : parsed.issueItemId && parsed.returnedQuantity
          ? [
              {
                issueItemId: parsed.issueItemId,
                returnedQuantity: parsed.returnedQuantity,
                condition: parsed.condition || ReturnCondition.GOOD,
                remarks: parsed.remarks || null
              }
            ]
          : [];

      if (itemsToReturn.length === 0) {
        throw new AppError(
          'At least one issue item and return quantity must be specified',
          400
        );
      }

      if (parsed.idempotencyKey) {
        const duplicate = await prisma.inventoryReturn.findUnique({
          where: { idempotencyKey: parsed.idempotencyKey }
        });
        if (duplicate) {
          throw new AppError('Duplicate return submission prevented', 409);
        }
      }

      const actualReturnDateObj = parsed.returnDate
        ? new Date(parsed.returnDate)
        : new Date();
      const actualReturnTimeStr =
        parsed.returnTime || getCurrentISTTimeString();

      const result = await prisma.$transaction(async (tx) => {
        const issue = await tx.inventoryIssue.findUnique({
          where: { id: parsed.issueId },
          include: {
            employee: true,
            items: true
          }
        });

        if (!issue) {
          throw new AppError('Parent Issue transaction not found', 404);
        }

        const returnRef = generateReferenceCode('RET');
        const returnRecord = await tx.inventoryReturn.create({
          data: {
            returnReference: returnRef,
            issueId: issue.id,
            employeeId: issue.employeeId,
            returnDate: actualReturnDateObj,
            returnTime: actualReturnTimeStr,
            receivedById: req.user!.id,
            remarks: parsed.remarks || null,
            idempotencyKey: parsed.idempotencyKey || null
          }
        });

        for (const retInput of itemsToReturn) {
          // Lock the issue_item row
          const lockedIssueItems = await tx.$queryRaw<
            Array<{
              id: string;
              inventory_item_id: string;
              serial_asset_id: string | null;
              issued_quantity: number;
              accepted_returned_quantity: number;
              damaged_quantity: number;
              lost_quantity: number;
              pending_quantity: number;
            }>
          >`SELECT id, inventory_item_id, serial_asset_id, issued_quantity, accepted_returned_quantity, damaged_quantity, lost_quantity, pending_quantity FROM issue_items WHERE id = ${retInput.issueItemId} AND issue_id = ${issue.id} FOR UPDATE`;

          if (!lockedIssueItems || lockedIssueItems.length === 0) {
            throw new AppError(
              `Issue item ${retInput.issueItemId} not found in this issue`,
              404
            );
          }

          const iiRow = lockedIssueItems[0];
          const currentPending = Number(iiRow.pending_quantity);

          if (retInput.returnedQuantity > currentPending) {
            throw new AppError(
              `Returned quantity (${retInput.returnedQuantity}) exceeds pending quantity (${currentPending})`,
              400
            );
          }

          // Lock the inventory_items row
          const lockedInvRows = await tx.$queryRaw<
            Array<{
              id: string;
              item_name: string;
              available_stock: number;
              issued_stock: number;
              damaged_stock: number;
              lost_stock: number;
              total_stock: number;
            }>
          >`SELECT id, item_name, available_stock, issued_stock, damaged_stock, lost_stock, total_stock FROM inventory_items WHERE id = ${iiRow.inventory_item_id} FOR UPDATE`;

          const invRow = lockedInvRows[0];
          const prevAvail = Number(invRow.available_stock);
          const prevIssued = Number(invRow.issued_stock);
          const prevDamaged = Number(invRow.damaged_stock);
          const prevLost = Number(invRow.lost_stock);
          const prevTotal = Number(invRow.total_stock);

          let newAvail = prevAvail;
          const newIssued = Math.max(0, prevIssued - retInput.returnedQuantity);
          let newDamaged = prevDamaged;
          let newLost = prevLost;

          let newAcceptedReturned = Number(iiRow.accepted_returned_quantity);
          let newItemDamaged = Number(iiRow.damaged_quantity);
          let newItemLost = Number(iiRow.lost_quantity);

          let txType: StockTransactionType = StockTransactionType.RETURN_IN;

          if (retInput.condition === ReturnCondition.GOOD) {
            // Good condition return increases available stock
            newAvail = prevAvail + retInput.returnedQuantity;
            newAcceptedReturned += retInput.returnedQuantity;
            txType = StockTransactionType.RETURN_IN;
          } else if (retInput.condition === ReturnCondition.DAMAGED) {
            // Scenario 6: Damaged item MUST NOT increase available stock; increases damaged_stock
            newDamaged = prevDamaged + retInput.returnedQuantity;
            newItemDamaged += retInput.returnedQuantity;
            txType = StockTransactionType.DAMAGED;
          } else if (retInput.condition === ReturnCondition.LOST) {
            // Lost item MUST NOT increase available stock; increases lost_stock
            newLost = prevLost + retInput.returnedQuantity;
            newItemLost += retInput.returnedQuantity;
            txType = StockTransactionType.LOST;
          }

          const newPending = currentPending - retInput.returnedQuantity;

          // Determine new item status
          let newItemStatus: IssueReturnStatus =
            IssueReturnStatus.PARTIALLY_RETURNED;
          if (newPending === 0) {
            if (newItemLost > 0 && newAcceptedReturned === 0 && newItemDamaged === 0) {
              newItemStatus = IssueReturnStatus.LOST;
            } else if (
              newItemDamaged > 0 &&
              newAcceptedReturned === 0 &&
              newItemLost === 0
            ) {
              newItemStatus = IssueReturnStatus.DAMAGED;
            } else {
              newItemStatus = IssueReturnStatus.FULLY_RETURNED;
            }
          } else {
            newItemStatus = IssueReturnStatus.PARTIALLY_RETURNED;
          }

          await tx.inventoryItem.update({
            where: { id: iiRow.inventory_item_id },
            data: {
              availableStock: newAvail,
              issuedStock: newIssued,
              damagedStock: newDamaged,
              lostStock: newLost
            }
          });

          await tx.issueItem.update({
            where: { id: iiRow.id },
            data: {
              acceptedReturnedQuantity: newAcceptedReturned,
              damagedQuantity: newItemDamaged,
              lostQuantity: newItemLost,
              pendingQuantity: newPending,
              itemStatus: newItemStatus,
              actualReturnDate: newPending === 0 ? actualReturnDateObj : null
            }
          });

          if (iiRow.serial_asset_id) {
            const serialStatus =
              retInput.condition === ReturnCondition.GOOD
                ? SerialStatus.AVAILABLE
                : retInput.condition === ReturnCondition.DAMAGED
                ? SerialStatus.DAMAGED
                : SerialStatus.LOST;
            await tx.inventorySerialAsset.update({
              where: { id: iiRow.serial_asset_id },
              data: {
                status: serialStatus,
                currentEmployeeId: null
              }
            });
          }

          await tx.returnItem.create({
            data: {
              returnId: returnRecord.id,
              issueItemId: iiRow.id,
              inventoryItemId: iiRow.inventory_item_id,
              serialAssetId: iiRow.serial_asset_id,
              returnedQuantity: retInput.returnedQuantity,
              condition: retInput.condition,
              remarks: retInput.remarks || parsed.remarks || null
            }
          });

          const txRef = generateReferenceCode('RETTX');
          await tx.stockTransaction.create({
            data: {
              transactionRef: txRef,
              inventoryItemId: iiRow.inventory_item_id,
              transactionType: txType,
              employeeId: issue.employeeId,
              issueId: issue.id,
              returnId: returnRecord.id,
              quantity: retInput.returnedQuantity,
              previousAvailableStock: prevAvail,
              newAvailableStock: newAvail,
              previousTotalStock: prevTotal,
              newTotalStock: prevTotal,
              remarks: `Return (${retInput.condition}) from ${issue.employee.name} for ${issue.issueReference}`,
              performedById: req.user!.id
            }
          });

          await recordAuditLog(
            {
              action: `INVENTORY_RETURN_${retInput.condition}`,
              entityType: 'INVENTORY_RETURN',
              entityId: returnRecord.id,
              transactionReference: returnRef,
              inventoryItemId: iiRow.inventory_item_id,
              previousQuantity: prevAvail,
              updatedQuantity: newAvail,
              newValues: {
                issueReference: issue.issueReference,
                returnedQuantity: retInput.returnedQuantity,
                condition: retInput.condition,
                remainingPendingQuantity: newPending
              },
              description: `Received ${retInput.returnedQuantity} units of '${invRow.item_name}' (${retInput.condition}) from ${issue.employee.name}. Available: ${prevAvail} -> ${newAvail}, Pending: ${currentPending} -> ${newPending}`,
              userId: req.user!.id,
              ipAddress: req.ip
            },
            tx
          );
        }

        // Recalculate parent InventoryIssue overall status
        const updatedIssueItems = await tx.issueItem.findMany({
          where: { issueId: issue.id }
        });

        const totalRemainingPending = updatedIssueItems.reduce(
          (sum, item) => sum + item.pendingQuantity,
          0
        );
        const totalAccepted = updatedIssueItems.reduce(
          (sum, item) => sum + item.acceptedReturnedQuantity,
          0
        );
        const totalDamaged = updatedIssueItems.reduce(
          (sum, item) => sum + item.damagedQuantity,
          0
        );
        const totalLost = updatedIssueItems.reduce(
          (sum, item) => sum + item.lostQuantity,
          0
        );

        let headerStatus: IssueReturnStatus = IssueReturnStatus.PENDING;
        let finalReturnDate: Date | null = null;

        if (totalRemainingPending === 0) {
          finalReturnDate = actualReturnDateObj;
          if (totalLost > 0 && totalAccepted === 0 && totalDamaged === 0) {
            headerStatus = IssueReturnStatus.LOST;
          } else if (totalDamaged > 0 && totalAccepted === 0 && totalLost === 0) {
            headerStatus = IssueReturnStatus.DAMAGED;
          } else {
            headerStatus = IssueReturnStatus.FULLY_RETURNED;
          }
        } else if (totalAccepted > 0 || totalDamaged > 0 || totalLost > 0) {
          headerStatus = IssueReturnStatus.PARTIALLY_RETURNED;
        }

        const updatedIssue = await tx.inventoryIssue.update({
          where: { id: issue.id },
          data: {
            status: headerStatus,
            actualFinalReturnDate: finalReturnDate
          },
          include: {
            employee: true,
            items: {
              include: {
                inventoryItem: true
              }
            }
          }
        });

        const daysHeld = calculateDaysHeld(
          updatedIssue.issueDate,
          updatedIssue.actualFinalReturnDate
        );

        return {
          returnRecord,
          issue: {
            ...updatedIssue,
            daysHeld
          }
        };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
