import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import {
  CategoryTargetType,
  RecordStatus,
  RoleName,
  SerialStatus,
  TrackingType
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

// Download Bulk Inventory Excel Template (.xlsx) - public access so direct browser downloads also work seamlessly
router.get(
  '/bulk-template',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Industrial Inventory System';
      const sheet = workbook.addWorksheet('Bulk Tools Import Template');

      sheet.columns = [
        { header: 'MachineCode (Optional)', key: 'machineCode', width: 22 },
        { header: 'MachineName (Optional)', key: 'machineName', width: 25 },
        { header: 'CategoryName * (e.g. 10bolt)', key: 'categoryName', width: 26 },
        { header: 'SubcategoryName * (e.g. 10-100)', key: 'subcategoryName', width: 28 },
        { header: 'ToolNumber * (e.g. 21)', key: 'toolNumber', width: 22 },
        { header: 'ItemName *', key: 'itemName', width: 32 },
        { header: 'SKU / ItemCode (Optional)', key: 'itemCode', width: 24 },
        { header: 'Brand', key: 'brand', width: 18 },
        { header: 'ModelNumber', key: 'modelNumber', width: 18 },
        { header: 'Unit (PCS/SET/BOX/KG)', key: 'unit', width: 20 },
        { header: 'OpeningStock *', key: 'openingStock', width: 16 },
        { header: 'MinStockLevel', key: 'minStockLevel', width: 16 },
        { header: 'StorageLocation', key: 'storageLocation', width: 22 },
        { header: 'Description', key: 'description', width: 28 }
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };

      // Add 3 sample guide rows showing the exact 10bolt -> 10-100 / 10-70 -> Tools 21, 34, 70 structure
      sheet.addRow({
        machineCode: 'MCH-HDR-10',
        machineName: 'Cold Header Machine #10',
        categoryName: '10bolt',
        subcategoryName: '10-100',
        toolNumber: '21',
        itemName: '10bolt (10-100) Tool #21 Heading Die',
        itemCode: '',
        brand: 'Bharat Carbide',
        modelNumber: 'BC-10100-21',
        unit: 'PCS',
        openingStock: 50,
        minStockLevel: 10,
        storageLocation: 'Rack A1 - Bin 21',
        description: 'First blow heading die for 10-100'
      });

      sheet.addRow({
        machineCode: 'MCH-HDR-10',
        machineName: 'Cold Header Machine #10',
        categoryName: '10bolt',
        subcategoryName: '10-100',
        toolNumber: '34',
        itemName: '10bolt (10-100) Tool #34 Extrusion Die',
        itemCode: '',
        brand: 'Bharat Carbide',
        modelNumber: 'BC-10100-34',
        unit: 'PCS',
        openingStock: 40,
        minStockLevel: 10,
        storageLocation: 'Rack A1 - Bin 34',
        description: 'Second blow extrusion die for 10-100'
      });

      sheet.addRow({
        machineCode: 'MCH-HDR-10',
        machineName: 'Cold Header Machine #10',
        categoryName: '10bolt',
        subcategoryName: '10-70',
        toolNumber: '70',
        itemName: '10bolt (10-70) Tool #70 Trimming Punch',
        itemCode: '',
        brand: 'Sandvik',
        modelNumber: 'SV-1070-70',
        unit: 'PCS',
        openingStock: 30,
        minStockLevel: 8,
        storageLocation: 'Rack A2 - Bin 70',
        description: 'Trimming punch insert for 10-70'
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="bulk-inventory-tools-template.xlsx"'
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  }
);

router.use(authenticateJWT);

const createItemSchema = z.object({
  itemName: z.string().min(1, 'Item Name is required'),
  itemCode: z.string().optional().nullable(),
  toolNumber: z.string().optional().nullable(),
  machineId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid('Category ID is required'),
  subcategoryId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  unitOfMeasurement: z.string().default('PCS'),
  trackingType: z
    .nativeEnum(TrackingType)
    .optional()
    .default(TrackingType.QUANTITY),
  minimumStockLevel: z.number().int().min(0).optional().default(5),
  openingStock: z.number().int().min(0).optional().default(0),
  storageLocation: z.string().optional().nullable(),
  itemImage: z.string().optional().nullable(),
  status: z.nativeEnum(RecordStatus).optional().default(RecordStatus.ACTIVE),
  serialNumbers: z.array(z.string()).optional()
});

const updateItemSchema = createItemSchema.partial();



// Bulk Import Tools / Inventory Items from Excel (.xlsx base64)
router.post(
  '/bulk-excel',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileBase64 } = z
        .object({
          fileBase64: z.string().min(10, 'Excel file payload is required')
        })
        .parse(req.body);

      const base64Clean = fileBase64.includes('base64,')
        ? fileBase64.split('base64,')[1]
        : fileBase64;
      const buffer = Buffer.from(base64Clean, 'base64');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new AppError('The uploaded Excel file has no worksheets', 400);
      }

      interface ParsedExcelRow {
        rowNumber: number;
        machineCode: string;
        machineName: string;
        categoryName: string;
        subcategoryName: string;
        toolNumber: string;
        itemName: string;
        itemCode: string;
        brand: string;
        modelNumber: string;
        unit: string;
        openingStock: number;
        minStockLevel: number;
        storageLocation: string;
        description: string;
      }

      const cellToString = (cellValue: ExcelJS.CellValue): string => {
        if (cellValue === null || cellValue === undefined) return '';
        if (typeof cellValue === 'object') {
          if ('text' in cellValue && cellValue.text) return String(cellValue.text).trim();
          if ('result' in cellValue && cellValue.result !== undefined)
            return String(cellValue.result).trim();
        }
        return String(cellValue).trim();
      };

      const parsedRows: ParsedExcelRow[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const machineCode = cellToString(row.getCell(1).value);
        const machineName = cellToString(row.getCell(2).value);
        const categoryName = cellToString(row.getCell(3).value);
        const subcategoryName = cellToString(row.getCell(4).value);
        const toolNumber = cellToString(row.getCell(5).value);
        const itemName = cellToString(row.getCell(6).value);
        const itemCode = cellToString(row.getCell(7).value);
        const brand = cellToString(row.getCell(8).value);
        const modelNumber = cellToString(row.getCell(9).value);
        const unit = cellToString(row.getCell(10).value) || 'PCS';
        const openingStockRaw = Number(cellToString(row.getCell(11).value) || '0');
        const minStockRaw = Number(cellToString(row.getCell(12).value) || '5');
        const storageLocation = cellToString(row.getCell(13).value);
        const description = cellToString(row.getCell(14).value);

        // Skip completely blank rows
        if (!categoryName && !itemName && !toolNumber) return;

        if (!categoryName) {
          throw new AppError(
            `Row ${rowNumber}: CategoryName is required (e.g., 10bolt)`,
            400
          );
        }

        const effectiveItemName =
          itemName ||
          `${categoryName}${subcategoryName ? ` (${subcategoryName})` : ''}${
            toolNumber ? ` Tool #${toolNumber}` : ''
          }`;

        parsedRows.push({
          rowNumber,
          machineCode,
          machineName,
          categoryName,
          subcategoryName,
          toolNumber,
          itemName: effectiveItemName,
          itemCode,
          brand,
          modelNumber,
          unit: unit.toUpperCase(),
          openingStock: isNaN(openingStockRaw) ? 0 : Math.max(0, Math.floor(openingStockRaw)),
          minStockLevel: isNaN(minStockRaw) ? 5 : Math.max(0, Math.floor(minStockRaw)),
          storageLocation,
          description
        });
      });

      if (parsedRows.length === 0) {
        throw new AppError(
          'No valid tool rows found in the Excel sheet. Please fill rows starting from Row 2.',
          400
        );
      }

      const summary = await prisma.$transaction(async (tx) => {
        let createdItemsCount = 0;
        let updatedStockCount = 0;
        const processedItems: any[] = [];

        for (const r of parsedRows) {
          // 1. Resolve or auto-create Machine if specified
          let machineId: string | null = null;
          if (r.machineCode || r.machineName) {
            const cleanMCode =
              r.machineCode.toUpperCase() ||
              generateReferenceCode('MCH');
            let machine = await tx.machine.findFirst({
              where: {
                OR: [
                  ...(r.machineCode
                    ? [{ machineCode: { equals: r.machineCode, mode: 'insensitive' as const } }]
                    : []),
                  ...(r.machineName
                    ? [{ machineName: { equals: r.machineName, mode: 'insensitive' as const } }]
                    : [])
                ]
              }
            });

            if (!machine) {
              machine = await tx.machine.create({
                data: {
                  machineCode: cleanMCode,
                  machineName: r.machineName || cleanMCode,
                  machineType: 'Industrial Machine',
                  location: r.storageLocation || 'Plant Floor',
                  status: RecordStatus.ACTIVE
                }
              });
            }
            machineId = machine.id;
          }

          // 2. Resolve or auto-create Category (e.g. 10bolt)
          let category = await tx.category.findFirst({
            where: {
              name: { equals: r.categoryName, mode: 'insensitive' },
              machineId: machineId
            }
          });
          if (!category) {
            category = await tx.category.create({
              data: {
                name: r.categoryName,
                machineId,
                targetType: machineId
                  ? CategoryTargetType.MACHINE
                  : CategoryTargetType.PRODUCT,
                status: RecordStatus.ACTIVE
              }
            });
          }

          // 3. Resolve or auto-create Subcategory (e.g. 10-100, 10-70)
          let subcategoryId: string | null = null;
          if (r.subcategoryName) {
            let sub = await tx.subcategory.findFirst({
              where: {
                categoryId: category.id,
                name: { equals: r.subcategoryName, mode: 'insensitive' }
              }
            });
            if (!sub) {
              sub = await tx.subcategory.create({
                data: {
                  categoryId: category.id,
                  name: r.subcategoryName,
                  status: RecordStatus.ACTIVE
                }
              });
            }
            subcategoryId = sub.id;
          }

          // 4. Check if this tool already exists under same Category + Subcategory + ToolNumber (or SKU)
          const existingItem = await tx.inventoryItem.findFirst({
            where: {
              OR: [
                ...(r.itemCode
                  ? [{ itemCode: { equals: r.itemCode, mode: 'insensitive' as const } }]
                  : []),
                {
                  categoryId: category.id,
                  subcategoryId,
                  toolNumber: r.toolNumber || null,
                  itemName: { equals: r.itemName, mode: 'insensitive' as const }
                }
              ]
            }
          });

          if (existingItem) {
            // Add openingStock from Excel row to existing item's stock if > 0
            if (r.openingStock > 0) {
              const prevAvail = existingItem.availableStock;
              const prevTotal = existingItem.totalStock;
              const newAvail = prevAvail + r.openingStock;
              const newTotal = prevTotal + r.openingStock;

              const updated = await tx.inventoryItem.update({
                where: { id: existingItem.id },
                data: {
                  availableStock: newAvail,
                  totalStock: newTotal,
                  storageLocation: r.storageLocation || existingItem.storageLocation
                }
              });

              await tx.stockTransaction.create({
                data: {
                  transactionRef: generateReferenceCode('BLK-IN'),
                  inventoryItemId: existingItem.id,
                  transactionType: 'PURCHASE_IN',
                  quantity: r.openingStock,
                  previousAvailableStock: prevAvail,
                  newAvailableStock: newAvail,
                  previousTotalStock: prevTotal,
                  newTotalStock: newTotal,
                  remarks: `Bulk Excel Stock Import (Row ${r.rowNumber})`,
                  performedById: req.user!.id
                }
              });

              updatedStockCount++;
              processedItems.push(updated);
            }
          } else {
            const generatedSku =
              r.itemCode ||
              `SKU-${r.categoryName
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()}-${(r.subcategoryName || 'GEN')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()}-${(r.toolNumber || 'T')
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

            const newItem = await tx.inventoryItem.create({
              data: {
                itemName: r.itemName,
                itemCode: generatedSku,
                toolNumber: r.toolNumber || null,
                machineId,
                categoryId: category.id,
                subcategoryId,
                brand: r.brand || null,
                modelNumber: r.modelNumber || null,
                unitOfMeasurement: r.unit,
                minimumStockLevel: r.minStockLevel,
                openingStock: r.openingStock,
                totalStock: r.openingStock,
                availableStock: r.openingStock,
                storageLocation: r.storageLocation || null,
                description: r.description || null,
                status: RecordStatus.ACTIVE
              }
            });

            if (r.openingStock > 0) {
              await tx.stockTransaction.create({
                data: {
                  transactionRef: generateReferenceCode('BLK-OPN'),
                  inventoryItemId: newItem.id,
                  transactionType: 'OPENING',
                  quantity: r.openingStock,
                  previousAvailableStock: 0,
                  newAvailableStock: r.openingStock,
                  previousTotalStock: 0,
                  newTotalStock: r.openingStock,
                  remarks: `Bulk Excel Opening Stock (Row ${r.rowNumber})`,
                  performedById: req.user!.id
                }
              });
            }

            createdItemsCount++;
            processedItems.push(newItem);
          }
        }

        await recordAuditLog(
          {
            action: 'INVENTORY_BULK_EXCEL_IMPORT',
            entityType: 'INVENTORY_ITEM',
            newValues: {
              totalRowsProcessed: parsedRows.length,
              createdItemsCount,
              updatedStockCount
            },
            description: `Bulk Excel Import: ${createdItemsCount} new tools created, ${updatedStockCount} existing tools restocked (${parsedRows.length} total rows)`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return {
          totalRowsProcessed: parsedRows.length,
          createdItemsCount,
          updatedStockCount,
          items: processedItems
        };
      });

      res.status(201).json({
        success: true,
        message: `Successfully imported ${summary.totalRowsProcessed} rows (${summary.createdItemsCount} new tools created, ${summary.updatedStockCount} existing tools updated).`,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
);

// List all inventory items with search & filters
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        search,
        machineId,
        categoryId,
        subcategoryId,
        status,
        lowStockOnly,
        trackingType
      } = req.query;

      const where: Record<string, unknown> = {};
      if (machineId && typeof machineId === 'string') {
        where.machineId = machineId;
      }
      if (categoryId && typeof categoryId === 'string') {
        where.categoryId = categoryId;
      }
      if (subcategoryId && typeof subcategoryId === 'string') {
        where.subcategoryId = subcategoryId;
      }
      if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
        where.status = status;
      }
      if (trackingType && (trackingType === 'QUANTITY' || trackingType === 'SERIAL')) {
        where.trackingType = trackingType;
      }
      if (search && typeof search === 'string') {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { itemCode: { contains: search, mode: 'insensitive' } },
          { toolNumber: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { modelNumber: { contains: search, mode: 'insensitive' } },
          { storageLocation: { contains: search, mode: 'insensitive' } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
          { subcategory: { name: { contains: search, mode: 'insensitive' } } }
        ];
      }

      let items = await prisma.inventoryItem.findMany({
        where,
        include: {
          machine: { select: { id: true, machineName: true, machineCode: true } },
          category: { select: { id: true, name: true, targetType: true } },
          subcategory: { select: { id: true, name: true } },
          serialAssets: true
        },
        orderBy: [
          { category: { name: 'asc' } },
          { subcategory: { name: 'asc' } },
          { toolNumber: 'asc' },
          { itemName: 'asc' }
        ]
      });

      if (lowStockOnly === 'true') {
        items = items.filter(
          (item) => item.availableStock <= item.minimumStockLevel
        );
      }

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }
);

// Get single inventory item details + stock movement history
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          machine: true,
          category: true,
          subcategory: true,
          serialAssets: {
            include: { currentEmployee: true }
          },
          stockTransactions: {
            include: {
              supplier: true,
              employee: true,
              performedBy: { select: { id: true, fullName: true, username: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          }
        }
      });

      if (!item) throw new AppError('Inventory item not found', 404);
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// Get item movement history
router.get(
  '/:id/movements',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const movements = await prisma.stockTransaction.findMany({
        where: { inventoryItemId: id },
        include: {
          supplier: true,
          employee: true,
          issue: true,
          returnRecord: true,
          performedBy: { select: { id: true, fullName: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, data: movements });
    } catch (err) {
      next(err);
    }
  }
);

// Add new inventory item (auto-generates unique SKU if not provided)
router.post(
  '/',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createItemSchema.parse(req.body);

      const itemCode =
        parsed.itemCode && parsed.itemCode.trim().length > 0
          ? parsed.itemCode.trim().toUpperCase()
          : generateReferenceCode('SKU');

      const openingQty =
        parsed.trackingType === TrackingType.SERIAL && parsed.serialNumbers?.length
          ? parsed.serialNumbers.length
          : parsed.openingStock || 0;

      const created = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.create({
          data: {
            itemName: parsed.itemName.trim(),
            itemCode,
            toolNumber: parsed.toolNumber?.trim() || null,
            machineId: parsed.machineId || null,
            categoryId: parsed.categoryId,
            subcategoryId: parsed.subcategoryId || null,
            description: parsed.description || null,
            brand: parsed.brand || null,
            modelNumber: parsed.modelNumber || null,
            unitOfMeasurement: parsed.unitOfMeasurement.toUpperCase(),
            trackingType: parsed.trackingType,
            minimumStockLevel: parsed.minimumStockLevel,
            openingStock: openingQty,
            totalStock: openingQty,
            availableStock: openingQty,
            issuedStock: 0,
            damagedStock: 0,
            lostStock: 0,
            storageLocation: parsed.storageLocation || null,
            itemImage: parsed.itemImage || null,
            status: parsed.status
          },
          include: {
            machine: true,
            category: true,
            subcategory: true
          }
        });

        if (
          parsed.trackingType === TrackingType.SERIAL &&
          parsed.serialNumbers &&
          parsed.serialNumbers.length > 0
        ) {
          await tx.inventorySerialAsset.createMany({
            data: parsed.serialNumbers.map((sn) => ({
              inventoryItemId: item.id,
              serialNumber: sn.trim(),
              status: SerialStatus.AVAILABLE
            }))
          });
        }

        if (openingQty > 0) {
          const txRef = generateReferenceCode('OPN');
          await tx.stockTransaction.create({
            data: {
              transactionRef: txRef,
              inventoryItemId: item.id,
              transactionType: 'OPENING',
              quantity: openingQty,
              previousAvailableStock: 0,
              newAvailableStock: openingQty,
              previousTotalStock: 0,
              newTotalStock: openingQty,
              remarks: 'Initial opening stock upon item creation',
              performedById: req.user!.id
            }
          });
        }

        await recordAuditLog(
          {
            action: 'INVENTORY_ITEM_CREATE',
            entityType: 'INVENTORY_ITEM',
            entityId: item.id,
            inventoryItemId: item.id,
            previousQuantity: 0,
            updatedQuantity: openingQty,
            newValues: item as unknown as Record<string, unknown>,
            description: `Added inventory item '${item.itemName}' (${item.itemCode}) with opening stock ${openingQty}`,
            userId: req.user!.id,
            ipAddress: req.ip
          },
          tx
        );

        return item;
      });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

// Edit inventory item metadata
router.put(
  '/:id',
  authorizeRoles(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.STORE_MANAGER
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!existing) throw new AppError('Inventory item not found', 404);

      const parsed = updateItemSchema.parse(req.body);

      const updated = await prisma.inventoryItem.update({
        where: { id },
        data: {
          itemName: parsed.itemName?.trim(),
          itemCode: parsed.itemCode?.trim().toUpperCase(),
          toolNumber:
            parsed.toolNumber !== undefined
              ? parsed.toolNumber?.trim() || null
              : existing.toolNumber,
          machineId:
            parsed.machineId !== undefined ? parsed.machineId : existing.machineId,
          categoryId: parsed.categoryId ?? existing.categoryId,
          subcategoryId:
            parsed.subcategoryId !== undefined
              ? parsed.subcategoryId
              : existing.subcategoryId,
          description:
            parsed.description !== undefined
              ? parsed.description
              : existing.description,
          brand: parsed.brand !== undefined ? parsed.brand : existing.brand,
          modelNumber:
            parsed.modelNumber !== undefined
              ? parsed.modelNumber
              : existing.modelNumber,
          unitOfMeasurement: parsed.unitOfMeasurement?.toUpperCase(),
          trackingType: parsed.trackingType,
          minimumStockLevel: parsed.minimumStockLevel,
          storageLocation:
            parsed.storageLocation !== undefined
              ? parsed.storageLocation
              : existing.storageLocation,
          itemImage:
            parsed.itemImage !== undefined ? parsed.itemImage : existing.itemImage,
          status: parsed.status
        },
        include: {
          machine: true,
          category: true,
          subcategory: true
        }
      });

      await recordAuditLog({
        action: 'INVENTORY_ITEM_UPDATE',
        entityType: 'INVENTORY_ITEM',
        entityId: updated.id,
        inventoryItemId: updated.id,
        previousQuantity: existing.availableStock,
        updatedQuantity: updated.availableStock,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: updated as unknown as Record<string, unknown>,
        description: `Edited inventory item '${updated.itemName}' (${updated.itemCode})`,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// Deactivate / Activate inventory item (Soft delete)
router.patch(
  '/:id/status',
  authorizeRoles(RoleName.SUPER_ADMIN, RoleName.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { status } = z
        .object({ status: z.nativeEnum(RecordStatus) })
        .parse(req.body);

      const existing = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!existing) throw new AppError('Inventory item not found', 404);

      const updated = await prisma.inventoryItem.update({
        where: { id },
        data: { status }
      });

      await recordAuditLog({
        action: 'INVENTORY_ITEM_STATUS_CHANGE',
        entityType: 'INVENTORY_ITEM',
        entityId: updated.id,
        inventoryItemId: updated.id,
        oldValues: { status: existing.status },
        newValues: { status: updated.status },
        description: `Set inventory item '${updated.itemName}' status to ${status}`,
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
