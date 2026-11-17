import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CategoryTargetType,
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

const router = Router();
router.use(authenticateJWT);

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required (e.g., 10bolt)'),
  code: z.string().optional().nullable(),
  targetType: z
    .nativeEnum(CategoryTargetType)
    .optional()
    .default(CategoryTargetType.MACHINE),
  machineId: z.string().uuid().optional().nullable(),
  machineType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE)
});

const subcategorySchema = z.object({
  categoryId: z.string().uuid('Valid parent Category ID is required'),
  name: z
    .string()
    .min(1, 'Subcategory name/specification is required (e.g., 10-100, 10-70)'),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE)
});

// Get full hierarchical tree: Machine / Product Type -> Category (e.g. 10bolt) -> Subcategory (e.g. 10-100, 10-70) -> Tools (e.g. 21, 34, 70)
router.get(
  '/hierarchy',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, machineId, targetType, status } = req.query;
      const where: Record<string, unknown> = {};

      if (machineId && typeof machineId === 'string') {
        where.machineId = machineId;
      }
      if (
        targetType &&
        (targetType === 'MACHINE' ||
          targetType === 'PRODUCT' ||
          targetType === 'GENERAL')
      ) {
        where.targetType = targetType;
      }
      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          {
            subcategories: {
              some: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  {
                    inventoryItems: {
                      some: {
                        OR: [
                          { itemName: { contains: search, mode: 'insensitive' } },
                          { toolNumber: { contains: search, mode: 'insensitive' } },
                          { itemCode: { contains: search, mode: 'insensitive' } }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        ];
      }

      const categories = await prisma.category.findMany({
        where,
        include: {
          machine: true,
          subcategories: {
            include: {
              inventoryItems: {
                orderBy: [{ toolNumber: 'asc' }, { itemName: 'asc' }]
              },
              _count: { select: { inventoryItems: true } }
            },
            orderBy: { name: 'asc' }
          },
          inventoryItems: {
            where: { subcategoryId: null },
            orderBy: [{ toolNumber: 'asc' }, { itemName: 'asc' }]
          },
          _count: {
            select: {
              subcategories: true,
              inventoryItems: true
            }
          }
        },
        orderBy: [{ name: 'asc' }]
      });

      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }
);

// List categories with subcategories
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, machineId, targetType, status } = req.query;
      const where: Record<string, unknown> = {};

      if (machineId && typeof machineId === 'string') {
        where.machineId = machineId;
      }
      if (targetType && typeof targetType === 'string') {
        where.targetType = targetType;
      }
      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { machineType: { contains: search, mode: 'insensitive' } },
          {
            subcategories: {
              some: { name: { contains: search, mode: 'insensitive' } }
            }
          }
        ];
      }

      const categories = await prisma.category.findMany({
        where,
        include: {
          machine: true,
          subcategories: {
            include: {
              _count: { select: { inventoryItems: true } }
            },
            orderBy: { name: 'asc' }
          },
          _count: {
            select: {
              subcategories: true,
              inventoryItems: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }
);

// Create Category (prevents duplicate category name within the same parent machine/targetType)
router.post(
  '/',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = categorySchema.parse(req.body);
      const cleanName = parsed.name.trim();

      const duplicate = await prisma.category.findFirst({
        where: {
          name: { equals: cleanName, mode: 'insensitive' },
          machineId: parsed.machineId || null,
          targetType: parsed.targetType
        }
      });

      if (duplicate) {
        throw new AppError(
          `Duplicate category: Category '${cleanName}' already exists under this Machine / Product Type.`,
          409
        );
      }

      const category = await prisma.category.create({
        data: {
          name: cleanName,
          code: parsed.code?.trim() || null,
          targetType: parsed.targetType,
          machineId: parsed.machineId || null,
          machineType: parsed.machineType?.trim() || null,
          description: parsed.description || null,
          status: parsed.status
        },
        include: {
          machine: true,
          subcategories: true
        }
      });

      await recordAuditLog({
        action: 'CATEGORY_CREATE',
        entityType: 'CATEGORY',
        entityId: category.id,
        newValues: category as unknown as Record<string, unknown>,
        description: `Created category '${category.name}'`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  }
);

// Update Category
router.put(
  '/:id',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) throw new AppError('Category not found', 404);

      const parsed = categorySchema.partial().parse(req.body);
      const cleanName = parsed.name ? parsed.name.trim() : existing.name;
      const targetMachineId =
        parsed.machineId !== undefined ? parsed.machineId : existing.machineId;
      const targetType = parsed.targetType || existing.targetType;

      const duplicate = await prisma.category.findFirst({
        where: {
          id: { not: id },
          name: { equals: cleanName, mode: 'insensitive' },
          machineId: targetMachineId || null,
          targetType
        }
      });

      if (duplicate) {
        throw new AppError(
          `Duplicate category: Category '${cleanName}' already exists under this parent.`,
          409
        );
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          name: cleanName,
          code: parsed.code !== undefined ? parsed.code : existing.code,
          targetType,
          machineId: targetMachineId || null,
          machineType:
            parsed.machineType !== undefined
              ? parsed.machineType
              : existing.machineType,
          description:
            parsed.description !== undefined
              ? parsed.description
              : existing.description,
          status: parsed.status || existing.status
        },
        include: {
          machine: true,
          subcategories: true
        }
      });

      await recordAuditLog({
        action: 'CATEGORY_UPDATE',
        entityType: 'CATEGORY',
        entityId: updated.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        description: `Updated category '${updated.name}'`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Deactivate / Activate Category
router.patch(
  '/:id/status',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status } = z
        .object({ status: z.nativeEnum(RecordStatus) })
        .parse(req.body);

      const updated = await prisma.category.update({
        where: { id },
        data: { status }
      });

      await recordAuditLog({
        action: 'CATEGORY_STATUS_CHANGE',
        entityType: 'CATEGORY',
        entityId: updated.id,
        newValues: { status },
        description: `Set category '${updated.name}' status to ${status}`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// List Subcategories (optionally filtered by categoryId)
router.get(
  '/subcategories/list',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, status, search } = req.query;
      const where: Record<string, unknown> = {};

      if (categoryId && typeof categoryId === 'string') {
        where.categoryId = categoryId;
      }
      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (search && typeof search === 'string') {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const subcategories = await prisma.subcategory.findMany({
        where,
        include: {
          category: { include: { machine: true } },
          inventoryItems: {
            select: {
              id: true,
              itemName: true,
              toolNumber: true,
              itemCode: true,
              availableStock: true,
              totalStock: true,
              issuedStock: true,
              status: true
            }
          },
          _count: { select: { inventoryItems: true } }
        },
        orderBy: { name: 'asc' }
      });

      res.json({ success: true, data: subcategories });
    } catch (err) {
      next(err);
    }
  }
);

// Create Subcategory (supports comma-separated e.g. "10-100, 10-70" under 10bolt) with duplicate prevention
router.post(
  '/subcategories',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = subcategorySchema.parse(req.body);
      const parentCategory = await prisma.category.findUnique({
        where: { id: parsed.categoryId }
      });
      if (!parentCategory) {
        throw new AppError('Parent category not found', 404);
      }

      const names = parsed.name
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

      const createdList = [];
      for (const cleanName of names) {
        const duplicate = await prisma.subcategory.findFirst({
          where: {
            categoryId: parsed.categoryId,
            name: { equals: cleanName, mode: 'insensitive' }
          }
        });

        if (duplicate) {
          if (names.length === 1) {
            throw new AppError(
              `Duplicate subcategory: '${cleanName}' already exists under category '${parentCategory.name}'.`,
              409
            );
          }
          continue;
        }

        const subcategory = await prisma.subcategory.create({
          data: {
            categoryId: parsed.categoryId,
            name: cleanName,
            code: parsed.code?.trim() || null,
            description: parsed.description || null,
            status: parsed.status
          },
          include: {
            category: true
          }
        });

        await recordAuditLog({
          action: 'SUBCATEGORY_CREATE',
          entityType: 'SUBCATEGORY',
          entityId: subcategory.id,
          newValues: subcategory as unknown as Record<string, unknown>,
          description: `Created subcategory '${subcategory.name}' under '${parentCategory.name}'`,
          userId: req.user!.id,
          ipAddress: req.ip
        });

        createdList.push(subcategory);
      }

      res.status(201).json({
        success: true,
        data: createdList.length === 1 ? createdList[0] : createdList
      });
    } catch (err) {
      next(err);
    }
  }
);

// Batch Create Subcategories + Tools in one flow
// Supports comma-separated Subcategories (e.g. "10-100, 10-70") AND comma-separated Tools (e.g. "21, 34, 70")
router.post(
  '/quick-hierarchy',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        machineId: z.string().uuid().optional().nullable(),
        targetType: z
          .nativeEnum(CategoryTargetType)
          .optional()
          .default(CategoryTargetType.MACHINE),
        categoryName: z.string().min(1, 'Category name is required (e.g., 10bolt)'),
        subcategoryName: z
          .string()
          .min(1, 'Subcategory name is required (e.g., 10-100, 10-70)'),
        tools: z
          .array(
            z.object({
              toolNumber: z.string().min(1, 'Tool number/code is required (e.g., 21, 34, 70)'),
              itemName: z.string().optional(),
              unitOfMeasurement: z.string().optional().default('PCS'),
              openingStock: z.number().int().min(0).optional().default(0),
              minimumStockLevel: z.number().int().min(0).optional().default(5),
              storageLocation: z.string().optional()
            })
          )
          .optional()
          .default([])
      });

      const parsed = schema.parse(req.body);

      const result = await prisma.$transaction(async (tx) => {
        let category = await tx.category.findFirst({
          where: {
            name: { equals: parsed.categoryName.trim(), mode: 'insensitive' },
            machineId: parsed.machineId || null
          }
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              name: parsed.categoryName.trim(),
              machineId: parsed.machineId || null,
              targetType: parsed.targetType
            }
          });
        }

        // Split comma-separated subcategory names (e.g. "10-100, 10-70" -> ["10-100", "10-70"])
        const subcategoryNames = parsed.subcategoryName
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const createdSubcategories = [];
        const createdTools = [];

        for (const subName of subcategoryNames) {
          let subcategory = await tx.subcategory.findFirst({
            where: {
              categoryId: category.id,
              name: { equals: subName, mode: 'insensitive' }
            }
          });

          if (!subcategory) {
            subcategory = await tx.subcategory.create({
              data: {
                categoryId: category.id,
                name: subName
              }
            });
          }
          createdSubcategories.push(subcategory);

          // Expand any comma-separated tool numbers as well
          for (const t of parsed.tools) {
            const splitToolNums = t.toolNumber
              .split(',')
              .map((tn) => tn.trim())
              .filter(Boolean);

            for (const cleanToolNo of splitToolNums) {
              // Avoid duplicate tool under same category + subcategory + toolNumber
              const existingTool = await tx.inventoryItem.findFirst({
                where: {
                  categoryId: category.id,
                  subcategoryId: subcategory.id,
                  toolNumber: { equals: cleanToolNo, mode: 'insensitive' }
                }
              });

              if (existingTool) {
                createdTools.push(existingTool);
                continue;
              }

              const itemName = `${category.name} (${subcategory.name}) Tool #${cleanToolNo}`;
              const itemCode = `SKU-${category.name
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()}-${subcategory.name
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()}-${cleanToolNo.toUpperCase()}-${Math.floor(
                100 + Math.random() * 900
              )}`;

              const openQty = t.openingStock || 0;
              const item = await tx.inventoryItem.create({
                data: {
                  itemName,
                  itemCode,
                  toolNumber: cleanToolNo,
                  machineId: parsed.machineId || category.machineId || null,
                  categoryId: category.id,
                  subcategoryId: subcategory.id,
                  unitOfMeasurement: t.unitOfMeasurement || 'PCS',
                  minimumStockLevel: t.minimumStockLevel ?? 5,
                  openingStock: openQty,
                  totalStock: openQty,
                  availableStock: openQty,
                  storageLocation: t.storageLocation || null
                }
              });

              if (openQty > 0) {
                await tx.stockTransaction.create({
                  data: {
                    transactionRef: `OPEN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    inventoryItemId: item.id,
                    transactionType: 'OPENING',
                    quantity: openQty,
                    previousAvailableStock: 0,
                    newAvailableStock: openQty,
                    previousTotalStock: 0,
                    newTotalStock: openQty,
                    remarks: `Opening stock for ${itemName}`,
                    performedById: req.user!.id
                  }
                });
              }

              createdTools.push(item);
            }
          }
        }

        await recordAuditLog(
          {
            action: 'HIERARCHY_QUICK_CREATE',
            entityType: 'CATEGORY',
            entityId: category.id,
            newValues: {
              category: category.name,
              subcategories: createdSubcategories.map((s) => s.name),
              toolsCreated: createdTools.map((i) => i.toolNumber)
            },
            description: `Configured hierarchy ${category.name} -> [${createdSubcategories
              .map((s) => s.name)
              .join(', ')}] with ${createdTools.length} tools`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return { category, subcategories: createdSubcategories, createdTools };
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// Update Subcategory
router.put(
  '/subcategories/:id',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.subcategory.findUnique({ where: { id } });
      if (!existing) throw new AppError('Subcategory not found', 404);

      const parsed = subcategorySchema.partial().parse(req.body);
      const cleanName = parsed.name ? parsed.name.trim() : existing.name;
      const targetCategoryId = parsed.categoryId || existing.categoryId;

      const duplicate = await prisma.subcategory.findFirst({
        where: {
          id: { not: id },
          categoryId: targetCategoryId,
          name: { equals: cleanName, mode: 'insensitive' }
        }
      });

      if (duplicate) {
        throw new AppError(
          `Duplicate subcategory: '${cleanName}' already exists under this category.`,
          409
        );
      }

      const updated = await prisma.subcategory.update({
        where: { id },
        data: {
          categoryId: targetCategoryId,
          name: cleanName,
          code: parsed.code !== undefined ? parsed.code : existing.code,
          description:
            parsed.description !== undefined
              ? parsed.description
              : existing.description,
          status: parsed.status || existing.status
        },
        include: { category: true }
      });

      await recordAuditLog({
        action: 'SUBCATEGORY_UPDATE',
        entityType: 'SUBCATEGORY',
        entityId: updated.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        description: `Updated subcategory '${updated.name}'`,
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
