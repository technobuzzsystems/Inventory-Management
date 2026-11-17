import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { RoleName } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import {
  authenticateJWT,
  authorizeRoles
} from '../../middlewares/auth.middleware';
import { recordAuditLog } from '../../utils/audit-logger';

const router = Router();

router.use(authenticateJWT);

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  roleId: z.string().uuid(),
  employeeId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  roleId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional().nullable(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional()
});

// Get all roles and permissions
router.get(
  '/roles',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await prisma.role.findMany({
        include: {
          rolePermissions: {
            include: { permission: true }
          },
          _count: { select: { users: true } }
        },
        orderBy: { createdAt: 'asc' }
      });
      const permissions = await prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { code: 'asc' }]
      });
      res.json({ success: true, data: { roles, permissions } });
    } catch (err) {
      next(err);
    }
  }
);

// Update permissions for a role (Super Admin only)
router.put(
  '/roles/:roleId/permissions',
  authorizeRoles(RoleName.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = String(req.params.roleId);
      const { permissionIds } = z
        .object({ permissionIds: z.array(z.string().uuid()) })
        .parse(req.body);

      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId
            }))
          });
        }
        await recordAuditLog(
          {
            action: 'ROLE_PERMISSIONS_UPDATE',
            entityType: 'ROLE',
            entityId: roleId,
            newValues: { permissionIds },
            description: `Updated permissions for role ${roleId}`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );
      });

      res.json({
        success: true,
        message: 'Role permissions updated successfully'
      });
    } catch (err) {
      next(err);
    }
  }
);

// List all users
router.get(
  '/',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          roleId: true,
          employeeId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: true,
          employee: true
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }
);

// Create user (Super Admin)
router.post(
  '/',
  authorizeRoles(RoleName.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createUserSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(parsed.password, 10);

      const user = await prisma.user.create({
        data: {
          username: parsed.username,
          email: parsed.email,
          passwordHash,
          fullName: parsed.fullName,
          roleId: parsed.roleId,
          employeeId: parsed.employeeId || null,
          isActive: parsed.isActive
        },
        include: { role: true, employee: true }
      });

      await recordAuditLog({
        action: 'USER_CREATE',
        entityType: 'USER',
        entityId: user.id,
        newValues: {
          username: user.username,
          email: user.email,
          role: user.role.name
        },
        description: `Created system user ${user.username}`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// Update user (Super Admin)
router.put(
  '/:id',
  authorizeRoles(RoleName.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const parsed = updateUserSchema.parse(req.body);

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) throw new AppError('User not found', 404);

      const updateData: Record<string, unknown> = {};
      if (parsed.email !== undefined) updateData.email = parsed.email;
      if (parsed.fullName !== undefined) updateData.fullName = parsed.fullName;
      if (parsed.roleId !== undefined) updateData.roleId = parsed.roleId;
      if (parsed.employeeId !== undefined)
        updateData.employeeId = parsed.employeeId;
      if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
      if (parsed.password) {
        updateData.passwordHash = await bcrypt.hash(parsed.password, 10);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        include: { role: true, employee: true }
      });

      await recordAuditLog({
        action: 'USER_UPDATE',
        entityType: 'USER',
        entityId: updated.id,
        description: `Updated user ${updated.username}`,
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
