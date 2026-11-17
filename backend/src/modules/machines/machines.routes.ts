import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RecordStatus, RoleName } from '@prisma/client';
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

const machineSchema = z.object({
  machineName: z.string().min(1, 'Machine name is required'),
  machineCode: z.string().optional(),
  machineType: z.string().min(1, 'Machine type is required'),
  description: z.string().optional().nullable(),
  location: z.string().min(1, 'Location is required'),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE)
});

// Get all machines with search, status filter, and associated tools/categories count
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, status, machineType } = req.query;
      const where: Record<string, unknown> = {};

      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (machineType && typeof machineType === 'string') {
        where.machineType = { equals: machineType, mode: 'insensitive' };
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { machineName: { contains: search, mode: 'insensitive' } },
          { machineCode: { contains: search, mode: 'insensitive' } },
          { machineType: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } }
        ];
      }

      const machines = await prisma.machine.findMany({
        where,
        include: {
          categories: {
            include: {
              subcategories: true
            }
          },
          inventoryItems: {
            select: {
              id: true,
              itemName: true,
              itemCode: true,
              toolNumber: true,
              availableStock: true,
              totalStock: true,
              issuedStock: true,
              unitOfMeasurement: true,
              status: true,
              category: { select: { id: true, name: true } },
              subcategory: { select: { id: true, name: true } }
            }
          },
          _count: {
            select: {
              categories: true,
              inventoryItems: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: machines });
    } catch (err) {
      next(err);
    }
  }
);

// Get single machine details with full hierarchy of Categories -> Subcategories -> Tools
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const machine = await prisma.machine.findUnique({
        where: { id },
        include: {
          categories: {
            include: {
              subcategories: {
                include: {
                  inventoryItems: true
                }
              },
              inventoryItems: true
            }
          },
          inventoryItems: {
            include: {
              category: true,
              subcategory: true
            }
          }
        }
      });

      if (!machine) throw new AppError('Machine not found', 404);
      res.json({ success: true, data: machine });
    } catch (err) {
      next(err);
    }
  }
);

// Create machine
router.post(
  '/',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = machineSchema.parse(req.body);
      const machineCode =
        parsed.machineCode && parsed.machineCode.trim().length > 0
          ? parsed.machineCode.trim().toUpperCase()
          : generateReferenceCode('MCH');

      const machine = await prisma.machine.create({
        data: {
          machineName: parsed.machineName.trim(),
          machineCode,
          machineType: parsed.machineType.trim(),
          description: parsed.description || null,
          location: parsed.location.trim(),
          status: parsed.status
        }
      });

      await recordAuditLog({
        action: 'MACHINE_CREATE',
        entityType: 'MACHINE',
        entityId: machine.id,
        newValues: machine as unknown as Record<string, unknown>,
        description: `Added machine ${machine.machineName} (${machine.machineCode})`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, data: machine });
    } catch (err) {
      next(err);
    }
  }
);

// Edit machine
router.put(
  '/:id',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.machine.findUnique({ where: { id } });
      if (!existing) throw new AppError('Machine not found', 404);

      const parsed = machineSchema.partial().parse(req.body);

      const updated = await prisma.machine.update({
        where: { id },
        data: {
          machineName: parsed.machineName?.trim(),
          machineCode: parsed.machineCode?.trim().toUpperCase(),
          machineType: parsed.machineType?.trim(),
          description: parsed.description,
          location: parsed.location?.trim(),
          status: parsed.status
        }
      });

      await recordAuditLog({
        action: 'MACHINE_UPDATE',
        entityType: 'MACHINE',
        entityId: updated.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        description: `Updated machine ${updated.machineName} (${updated.machineCode})`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Activate / Deactivate machine
router.patch(
  '/:id/status',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status } = z
        .object({ status: z.nativeEnum(RecordStatus) })
        .parse(req.body);

      const existing = await prisma.machine.findUnique({ where: { id } });
      if (!existing) throw new AppError('Machine not found', 404);

      const updated = await prisma.machine.update({
        where: { id },
        data: { status }
      });

      await recordAuditLog({
        action: 'MACHINE_STATUS_CHANGE',
        entityType: 'MACHINE',
        entityId: updated.id,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
        description: `Changed machine ${updated.machineName} status to ${status}`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Associate existing tools (inventory items) with a machine
router.post(
  '/:id/associate-tools',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { inventoryItemIds } = z
        .object({ inventoryItemIds: z.array(z.string().uuid()) })
        .parse(req.body);

      const machine = await prisma.machine.findUnique({ where: { id } });
      if (!machine) throw new AppError('Machine not found', 404);

      await prisma.inventoryItem.updateMany({
        where: { id: { in: inventoryItemIds } },
        data: { machineId: id }
      });

      await recordAuditLog({
        action: 'MACHINE_TOOLS_ASSOCIATED',
        entityType: 'MACHINE',
        entityId: id,
        newValues: { inventoryItemIds },
        description: `Associated ${inventoryItemIds.length} tools with machine ${machine.machineName}`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `${inventoryItemIds.length} tool(s) associated with ${machine.machineName}`
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
