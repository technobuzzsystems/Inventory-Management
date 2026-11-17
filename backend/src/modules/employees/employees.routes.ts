import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  IssueReturnStatus,
  RecordStatus,
  RoleName
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
  isPastExpectedDate
} from '../../utils/date-utils';

const router = Router();
router.use(authenticateJWT);

const employeeSchema = z.object({
  employeeCode: z.string().optional(),
  name: z.string().min(1, 'Employee Name is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  contactNumber: z.string().min(5, 'Contact Number is required'),
  email: z.string().email('Valid email is required'),
  joiningDate: z.string().min(1, 'Joining Date is required'),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE)
});

function computeDynamicStatus(
  storedStatus: IssueReturnStatus,
  pendingQuantity: number,
  expectedReturnDate: Date | string
): IssueReturnStatus {
  if (pendingQuantity <= 0) {
    return storedStatus;
  }
  if (isPastExpectedDate(expectedReturnDate, pendingQuantity)) {
    return IssueReturnStatus.OVERDUE;
  }
  return storedStatus;
}

// List all employees
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, department, status } = req.query;
      const where: Record<string, unknown> = {};

      if (department && typeof department === 'string') {
        where.department = { equals: department, mode: 'insensitive' };
      }
      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
          { designation: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const employees = await prisma.employee.findMany({
        where,
        include: {
          issues: {
            include: {
              items: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      const enriched = employees.map((emp) => {
        let activeIssuedCount = 0;
        let totalPendingQty = 0;
        let overdueCount = 0;

        for (const iss of emp.issues) {
          for (const item of iss.items) {
            if (item.pendingQuantity > 0) {
              activeIssuedCount++;
              totalPendingQty += item.pendingQuantity;
              if (isPastExpectedDate(iss.expectedReturnDate, item.pendingQuantity)) {
                overdueCount++;
              }
            }
          }
        }

        return {
          ...emp,
          summary: {
            activeIssuedCount,
            totalPendingQty,
            overdueCount,
            totalIssuesCount: emp.issues.length
          }
        };
      });

      res.json({ success: true, data: enriched });
    } catch (err) {
      next(err);
    }
  }
);

// Dedicated Employee-wise Inventory Tracking endpoint (Module I)
// Supports filtering by employeeId, department, inventoryItemId, startDate, endDate, returnStatus
router.get(
  '/tracking/all',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        employeeId,
        department,
        inventoryItemId,
        startDate,
        endDate,
        returnStatus,
        search
      } = req.query;

      // If logged-in user is EMPLOYEE role, scope to their own employeeId
      let effectiveEmployeeId =
        typeof employeeId === 'string' && employeeId ? employeeId : undefined;
      if (req.user!.role === RoleName.EMPLOYEE && req.user!.employeeId) {
        effectiveEmployeeId = req.user!.employeeId;
      }

      const issueWhere: Record<string, unknown> = {};
      if (effectiveEmployeeId) {
        issueWhere.employeeId = effectiveEmployeeId;
      }
      if (department && typeof department === 'string') {
        issueWhere.department = { equals: department, mode: 'insensitive' };
      }
      if (startDate || endDate) {
        const issueDateFilter: Record<string, Date> = {};
        if (startDate && typeof startDate === 'string') {
          issueDateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
        }
        if (endDate && typeof endDate === 'string') {
          issueDateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
        }
        issueWhere.issueDate = issueDateFilter;
      }

      const itemWhere: Record<string, unknown> = {
        issue: issueWhere
      };

      if (inventoryItemId && typeof inventoryItemId === 'string') {
        itemWhere.inventoryItemId = inventoryItemId;
      }
      if (search && typeof search === 'string') {
        itemWhere.OR = [
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

      const issueItems = await prisma.issueItem.findMany({
        where: itemWhere,
        include: {
          inventoryItem: {
            include: {
              category: true,
              subcategory: true,
              machine: true
            }
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
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const records = issueItems
        .map((ii) => {
          const effectiveStatus = computeDynamicStatus(
            ii.itemStatus,
            ii.pendingQuantity,
            ii.issue.expectedReturnDate
          );

          const daysHeld = calculateDaysHeld(
            ii.issue.issueDate,
            ii.actualReturnDate || ii.issue.actualFinalReturnDate
          );

          // Pending Quantity (as defined in prompt: Issued Quantity - Total Accepted Returned Quantity)
          // And Remaining Unaccounted Quantity (Issued - Accepted - Damaged - Lost)
          const pendingForGoodReturn =
            ii.issuedQuantity - ii.acceptedReturnedQuantity;

          return {
            issueItemId: ii.id,
            issueId: ii.issueId,
            issueReference: ii.issue.issueReference,
            employee: ii.issue.employee,
            department: ii.issue.department,
            inventoryItem: ii.inventoryItem,
            issuedQuantity: ii.issuedQuantity,
            acceptedReturnedQuantity: ii.acceptedReturnedQuantity,
            damagedQuantity: ii.damagedQuantity,
            lostQuantity: ii.lostQuantity,
            pendingQuantity: ii.pendingQuantity,
            pendingByAcceptedFormula: pendingForGoodReturn,
            issueDate: ii.issue.issueDate,
            issueTime: ii.issue.issueTime,
            expectedReturnDate: ii.issue.expectedReturnDate,
            actualReturnDate: ii.actualReturnDate || ii.issue.actualFinalReturnDate,
            daysHeld,
            returnStatus: effectiveStatus,
            isOverdue: effectiveStatus === IssueReturnStatus.OVERDUE,
            issuedBy: ii.issue.issuedBy,
            purposeRemarks: ii.issue.purposeRemarks,
            returnHistory: ii.returnItems
          };
        })
        .filter((rec) => {
          if (returnStatus && typeof returnStatus === 'string') {
            return rec.returnStatus === returnStatus;
          }
          return true;
        });

      res.json({ success: true, data: records });
    } catch (err) {
      next(err);
    }
  }
);

// Single Employee Profile with currently issued tools & complete historical transactions
router.get(
  '/:id/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      if (
        req.user!.role === RoleName.EMPLOYEE &&
        req.user!.employeeId &&
        req.user!.employeeId !== id
      ) {
        throw new AppError('Employees can only view their own profile', 403);
      }

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          heldSerialAssets: {
            include: { inventoryItem: true }
          },
          issues: {
            include: {
              issuedBy: { select: { id: true, fullName: true, username: true } },
              items: {
                include: {
                  inventoryItem: {
                    include: { category: true, subcategory: true, machine: true }
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
                }
              }
            },
            orderBy: { issueDate: 'desc' }
          },
          returns: {
            include: {
              receivedBy: { select: { id: true, fullName: true } },
              items: {
                include: { inventoryItem: true }
              }
            },
            orderBy: { returnDate: 'desc' }
          }
        }
      });

      if (!employee) throw new AppError('Employee not found', 404);

      const allIssuedItems = employee.issues.flatMap((issue: any) =>
        issue.items.map((ii: any) => {
          const effectiveStatus = computeDynamicStatus(
            ii.itemStatus,
            ii.pendingQuantity,
            issue.expectedReturnDate
          );
          const daysHeld = calculateDaysHeld(
            issue.issueDate,
            ii.actualReturnDate || issue.actualFinalReturnDate
          );

          return {
            issueItemId: ii.id,
            issueId: issue.id,
            issueReference: issue.issueReference,
            inventoryItem: ii.inventoryItem,
            issuedQuantity: ii.issuedQuantity,
            acceptedReturnedQuantity: ii.acceptedReturnedQuantity,
            damagedQuantity: ii.damagedQuantity,
            lostQuantity: ii.lostQuantity,
            pendingQuantity: ii.pendingQuantity,
            issueDate: issue.issueDate,
            issueTime: issue.issueTime,
            expectedReturnDate: issue.expectedReturnDate,
            actualReturnDate: ii.actualReturnDate || issue.actualFinalReturnDate,
            daysHeld,
            returnStatus: effectiveStatus,
            isOverdue: effectiveStatus === IssueReturnStatus.OVERDUE,
            purposeRemarks: issue.purposeRemarks,
            issuedBy: issue.issuedBy,
            returnHistory: ii.returnItems
          };
        })
      );

      const currentlyIssued = allIssuedItems.filter(
        (item: any) => item.pendingQuantity > 0
      );

      res.json({
        success: true,
        data: {
          employee,
          currentlyIssued,
          historicalTransactions: allIssuedItems
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// Create Employee
router.post(
  '/',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = employeeSchema.parse(req.body);
      const employeeCode =
        parsed.employeeCode && parsed.employeeCode.trim().length > 0
          ? parsed.employeeCode.trim().toUpperCase()
          : generateReferenceCode('EMP');

      const employee = await prisma.employee.create({
        data: {
          employeeCode,
          name: parsed.name.trim(),
          department: parsed.department.trim(),
          designation: parsed.designation.trim(),
          contactNumber: parsed.contactNumber.trim(),
          email: parsed.email.trim().toLowerCase(),
          joiningDate: new Date(parsed.joiningDate),
          status: parsed.status
        }
      });

      await recordAuditLog({
        action: 'EMPLOYEE_CREATE',
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        newValues: employee as unknown as Record<string, unknown>,
        description: `Added employee ${employee.name} (${employee.employeeCode})`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }
);

// Update Employee
router.put(
  '/:id',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) throw new AppError('Employee not found', 404);

      const parsed = employeeSchema.partial().parse(req.body);

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          employeeCode: parsed.employeeCode?.trim().toUpperCase(),
          name: parsed.name?.trim(),
          department: parsed.department?.trim(),
          designation: parsed.designation?.trim(),
          contactNumber: parsed.contactNumber?.trim(),
          email: parsed.email?.trim().toLowerCase(),
          joiningDate: parsed.joiningDate
            ? new Date(parsed.joiningDate)
            : undefined,
          status: parsed.status
        }
      });

      await recordAuditLog({
        action: 'EMPLOYEE_UPDATE',
        entityType: 'EMPLOYEE',
        entityId: updated.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        description: `Updated employee ${updated.name} (${updated.employeeCode})`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
