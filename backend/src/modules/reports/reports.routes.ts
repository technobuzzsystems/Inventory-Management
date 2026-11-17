import { Router, Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/app-error';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import {
  calculateDaysHeld,
  formatISTDateTime,
  isPastExpectedDate
} from '../../utils/date-utils';

const router = Router();
router.use(authenticateJWT);

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface GeneratedReport {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}

async function buildReportData(
  reportType: string,
  query: Record<string, unknown>
): Promise<GeneratedReport> {
  const search =
    typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
  const startDate =
    typeof query.startDate === 'string' && query.startDate
      ? new Date(`${query.startDate}T00:00:00.000Z`)
      : undefined;
  const endDate =
    typeof query.endDate === 'string' && query.endDate
      ? new Date(`${query.endDate}T23:59:59.999Z`)
      : undefined;

  const filterRowsBySearch = (rows: Record<string, unknown>[]) => {
    if (!search) return rows;
    return rows.filter((r) =>
      Object.values(r).some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(search)
      )
    );
  };

  switch (reportType) {
    case 'current-stock': {
      const items = await prisma.inventoryItem.findMany({
        include: { machine: true, category: true, subcategory: true },
        orderBy: [{ category: { name: 'asc' } }, { itemName: 'asc' }]
      });
      const rows = items.map((i) => ({
        itemCode: i.itemCode,
        toolNumber: i.toolNumber || '-',
        itemName: i.itemName,
        machine: i.machine?.machineName || 'General',
        category: i.category.name,
        subcategory: i.subcategory?.name || '-',
        unit: i.unitOfMeasurement,
        openingStock: i.openingStock,
        totalStock: i.totalStock,
        availableStock: i.availableStock,
        issuedStock: i.issuedStock,
        damagedStock: i.damagedStock,
        lostStock: i.lostStock,
        minLevel: i.minimumStockLevel,
        location: i.storageLocation || '-',
        status: i.status
      }));
      return {
        title: '1. Current Stock Report',
        columns: [
          { header: 'SKU / Code', key: 'itemCode', width: 18 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 26 },
          { header: 'Machine', key: 'machine', width: 18 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Subcategory', key: 'subcategory', width: 16 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Total Stock', key: 'totalStock', width: 14 },
          { header: 'Available', key: 'availableStock', width: 14 },
          { header: 'Issued', key: 'issuedStock', width: 12 },
          { header: 'Damaged', key: 'damagedStock', width: 12 },
          { header: 'Lost', key: 'lostStock', width: 12 },
          { header: 'Storage Location', key: 'location', width: 18 },
          { header: 'Status', key: 'status', width: 12 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'available-stock': {
      const items = await prisma.inventoryItem.findMany({
        where: { status: 'ACTIVE' },
        include: { machine: true, category: true, subcategory: true },
        orderBy: { availableStock: 'desc' }
      });
      const rows = items.map((i) => ({
        itemCode: i.itemCode,
        toolNumber: i.toolNumber || '-',
        itemName: i.itemName,
        category: i.category.name,
        subcategory: i.subcategory?.name || '-',
        unit: i.unitOfMeasurement,
        availableStock: i.availableStock,
        minStockLevel: i.minimumStockLevel,
        stockAlert:
          i.availableStock <= i.minimumStockLevel ? 'LOW STOCK' : 'HEALTHY',
        location: i.storageLocation || '-'
      }));
      return {
        title: '2. Available Stock Report',
        columns: [
          { header: 'SKU / Code', key: 'itemCode', width: 18 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 28 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Subcategory', key: 'subcategory', width: 16 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Available Qty', key: 'availableStock', width: 16 },
          { header: 'Min Level', key: 'minStockLevel', width: 14 },
          { header: 'Stock Status', key: 'stockAlert', width: 16 },
          { header: 'Location', key: 'location', width: 18 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'issued-stock': {
      const issueItems = await prisma.issueItem.findMany({
        where:
          startDate || endDate
            ? {
                issue: {
                  issueDate: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {})
                  }
                }
              }
            : undefined,
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          issue: {
            include: {
              employee: true,
              issuedBy: { select: { fullName: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      const rows = issueItems.map((ii) => ({
        issueReference: ii.issue.issueReference,
        employeeCode: ii.issue.employee.employeeCode,
        employeeName: ii.issue.employee.name,
        department: ii.issue.department,
        itemCode: ii.inventoryItem.itemCode,
        toolNumber: ii.inventoryItem.toolNumber || '-',
        itemName: ii.inventoryItem.itemName,
        category: ii.inventoryItem.category.name,
        subcategory: ii.inventoryItem.subcategory?.name || '-',
        issuedQuantity: ii.issuedQuantity,
        acceptedReturned: ii.acceptedReturnedQuantity,
        pendingQuantity: ii.pendingQuantity,
        issueDate: formatISTDateTime(ii.issue.issueDate),
        expectedReturnDate: formatISTDateTime(ii.issue.expectedReturnDate),
        issuedBy: ii.issue.issuedBy.fullName
      }));
      return {
        title: '3. Issued Stock Report',
        columns: [
          { header: 'Issue Ref', key: 'issueReference', width: 20 },
          { header: 'Emp ID', key: 'employeeCode', width: 14 },
          { header: 'Employee', key: 'employeeName', width: 20 },
          { header: 'Department', key: 'department', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Subcategory', key: 'subcategory', width: 15 },
          { header: 'Issued Qty', key: 'issuedQuantity', width: 12 },
          { header: 'Returned Qty', key: 'acceptedReturned', width: 14 },
          { header: 'Pending Qty', key: 'pendingQuantity', width: 12 },
          { header: 'Issue Date (IST)', key: 'issueDate', width: 22 },
          { header: 'Expected Return', key: 'expectedReturnDate', width: 22 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'employee-wise': {
      const issueItems = await prisma.issueItem.findMany({
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          issue: { include: { employee: true } }
        },
        orderBy: [
          { issue: { employee: { name: 'asc' } } },
          { createdAt: 'desc' }
        ]
      });
      const rows = issueItems.map((ii) => {
        const overdue = isPastExpectedDate(
          ii.issue.expectedReturnDate,
          ii.pendingQuantity
        );
        const daysHeld = calculateDaysHeld(
          ii.issue.issueDate,
          ii.actualReturnDate || ii.issue.actualFinalReturnDate
        );
        return {
          employeeCode: ii.issue.employee.employeeCode,
          employeeName: ii.issue.employee.name,
          department: ii.issue.department,
          issueReference: ii.issue.issueReference,
          itemName: ii.inventoryItem.itemName,
          toolNumber: ii.inventoryItem.toolNumber || '-',
          issuedQuantity: ii.issuedQuantity,
          acceptedReturned: ii.acceptedReturnedQuantity,
          pendingQuantity: ii.pendingQuantity,
          issueDate: formatISTDateTime(ii.issue.issueDate),
          expectedReturnDate: formatISTDateTime(ii.issue.expectedReturnDate),
          actualReturnDate: formatISTDateTime(
            ii.actualReturnDate || ii.issue.actualFinalReturnDate
          ),
          daysHeld,
          status: overdue ? 'OVERDUE' : ii.itemStatus
        };
      });
      return {
        title: '4. Employee-wise Inventory Report',
        columns: [
          { header: 'Emp ID', key: 'employeeCode', width: 14 },
          { header: 'Employee Name', key: 'employeeName', width: 20 },
          { header: 'Department', key: 'department', width: 16 },
          { header: 'Issue Ref', key: 'issueReference', width: 18 },
          { header: 'Tool #', key: 'toolNumber', width: 10 },
          { header: 'Product / Tool Name', key: 'itemName', width: 24 },
          { header: 'Issued Qty', key: 'issuedQuantity', width: 12 },
          { header: 'Pending Qty', key: 'pendingQuantity', width: 12 },
          { header: 'Issue Date (IST)', key: 'issueDate', width: 22 },
          { header: 'Expected Return', key: 'expectedReturnDate', width: 22 },
          { header: 'Actual Return', key: 'actualReturnDate', width: 22 },
          { header: 'Days Held', key: 'daysHeld', width: 12 },
          { header: 'Return Status', key: 'status', width: 16 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'pending-returns': {
      const pending = await prisma.issueItem.findMany({
        where: { pendingQuantity: { gt: 0 } },
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          issue: { include: { employee: true } }
        },
        orderBy: { issue: { expectedReturnDate: 'asc' } }
      });
      const rows = pending.map((ii) => {
        const overdue = isPastExpectedDate(
          ii.issue.expectedReturnDate,
          ii.pendingQuantity
        );
        const daysHeld = calculateDaysHeld(ii.issue.issueDate, null);
        return {
          issueReference: ii.issue.issueReference,
          employeeCode: ii.issue.employee.employeeCode,
          employeeName: ii.issue.employee.name,
          department: ii.issue.department,
          toolNumber: ii.inventoryItem.toolNumber || '-',
          itemName: ii.inventoryItem.itemName,
          issuedQuantity: ii.issuedQuantity,
          returnedQuantity: ii.acceptedReturnedQuantity,
          pendingQuantity: ii.pendingQuantity,
          issueDate: formatISTDateTime(ii.issue.issueDate),
          expectedReturnDate: formatISTDateTime(ii.issue.expectedReturnDate),
          daysHeld,
          status: overdue ? 'OVERDUE' : ii.itemStatus
        };
      });
      return {
        title: '5. Pending Return Report',
        columns: [
          { header: 'Issue Ref', key: 'issueReference', width: 18 },
          { header: 'Emp ID', key: 'employeeCode', width: 14 },
          { header: 'Employee', key: 'employeeName', width: 20 },
          { header: 'Department', key: 'department', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Issued Qty', key: 'issuedQuantity', width: 12 },
          { header: 'Returned Qty', key: 'returnedQuantity', width: 14 },
          { header: 'Pending Qty', key: 'pendingQuantity', width: 14 },
          { header: 'Expected Return', key: 'expectedReturnDate', width: 22 },
          { header: 'Days Held', key: 'daysHeld', width: 12 },
          { header: 'Status', key: 'status', width: 16 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'overdue-returns': {
      const pending = await prisma.issueItem.findMany({
        where: { pendingQuantity: { gt: 0 } },
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          issue: { include: { employee: true } }
        },
        orderBy: { issue: { expectedReturnDate: 'asc' } }
      });
      const overdueItems = pending.filter((ii) =>
        isPastExpectedDate(ii.issue.expectedReturnDate, ii.pendingQuantity)
      );
      const rows = overdueItems.map((ii) => ({
        issueReference: ii.issue.issueReference,
        employeeCode: ii.issue.employee.employeeCode,
        employeeName: ii.issue.employee.name,
        contactNumber: ii.issue.employee.contactNumber,
        department: ii.issue.department,
        toolNumber: ii.inventoryItem.toolNumber || '-',
        itemName: ii.inventoryItem.itemName,
        issuedQuantity: ii.issuedQuantity,
        pendingQuantity: ii.pendingQuantity,
        issueDate: formatISTDateTime(ii.issue.issueDate),
        expectedReturnDate: formatISTDateTime(ii.issue.expectedReturnDate),
        daysHeld: calculateDaysHeld(ii.issue.issueDate, null),
        status: 'OVERDUE'
      }));
      return {
        title: '6. Overdue Return Report',
        columns: [
          { header: 'Issue Ref', key: 'issueReference', width: 18 },
          { header: 'Emp ID', key: 'employeeCode', width: 14 },
          { header: 'Employee', key: 'employeeName', width: 20 },
          { header: 'Contact', key: 'contactNumber', width: 16 },
          { header: 'Department', key: 'department', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Pending Qty', key: 'pendingQuantity', width: 14 },
          { header: 'Expected Return', key: 'expectedReturnDate', width: 22 },
          { header: 'Days Held', key: 'daysHeld', width: 12 },
          { header: 'Status', key: 'status', width: 14 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'damaged-lost': {
      const items = await prisma.inventoryItem.findMany({
        where: {
          OR: [{ damagedStock: { gt: 0 } }, { lostStock: { gt: 0 } }]
        },
        include: { category: true, subcategory: true, machine: true }
      });
      const rows = items.map((i) => ({
        itemCode: i.itemCode,
        toolNumber: i.toolNumber || '-',
        itemName: i.itemName,
        category: i.category.name,
        subcategory: i.subcategory?.name || '-',
        damagedStock: i.damagedStock,
        lostStock: i.lostStock,
        availableStock: i.availableStock,
        totalStock: i.totalStock,
        location: i.storageLocation || '-'
      }));
      return {
        title: '7. Damaged and Lost Items Report',
        columns: [
          { header: 'SKU / Code', key: 'itemCode', width: 18 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 26 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Subcategory', key: 'subcategory', width: 16 },
          { header: 'Damaged Qty', key: 'damagedStock', width: 14 },
          { header: 'Lost Qty', key: 'lostStock', width: 14 },
          { header: 'Available Qty', key: 'availableStock', width: 14 },
          { header: 'Total Stock', key: 'totalStock', width: 14 },
          { header: 'Storage Location', key: 'location', width: 18 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'stock-in': {
      const txs = await prisma.stockTransaction.findMany({
        where: {
          transactionType: {
            in: ['PURCHASE_IN', 'RETURN_IN', 'OPENING', 'ADJUSTMENT_ADD']
          },
          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {})
                }
              }
            : {})
        },
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          supplier: true,
          performedBy: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      const rows = txs.map((t) => ({
        transactionRef: t.transactionRef,
        transactionType: t.transactionType,
        itemCode: t.inventoryItem.itemCode,
        toolNumber: t.inventoryItem.toolNumber || '-',
        itemName: t.inventoryItem.itemName,
        supplier: t.supplier?.name || '-',
        invoiceRef: t.invoiceReference || '-',
        quantity: t.quantity,
        unitPrice: t.unitPrice ?? 0,
        totalAmount: t.totalAmount ?? 0,
        previousAvailable: t.previousAvailableStock,
        newAvailable: t.newAvailableStock,
        performedBy: t.performedBy.fullName,
        date: formatISTDateTime(t.createdAt)
      }));
      return {
        title: '8. Stock In Report',
        columns: [
          { header: 'Tx Ref', key: 'transactionRef', width: 20 },
          { header: 'Type', key: 'transactionType', width: 16 },
          { header: 'SKU', key: 'itemCode', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 10 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Supplier', key: 'supplier', width: 20 },
          { header: 'Invoice / Ref', key: 'invoiceRef', width: 16 },
          { header: 'Qty In', key: 'quantity', width: 12 },
          { header: 'Unit Price', key: 'unitPrice', width: 12 },
          { header: 'Total Amt', key: 'totalAmount', width: 14 },
          { header: 'New Avail', key: 'newAvailable', width: 12 },
          { header: 'Recorded By', key: 'performedBy', width: 18 },
          { header: 'Date & Time (IST)', key: 'date', width: 22 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'stock-out': {
      const txs = await prisma.stockTransaction.findMany({
        where: {
          transactionType: {
            in: ['ISSUE_OUT', 'DIRECT_OUT', 'ADJUSTMENT_DEDUCT', 'DAMAGED', 'LOST']
          },
          ...(startDate || endDate
            ? {
                createdAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {})
                }
              }
            : {})
        },
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          employee: true,
          performedBy: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      const rows = txs.map((t) => ({
        transactionRef: t.transactionRef,
        transactionType: t.transactionType,
        itemCode: t.inventoryItem.itemCode,
        toolNumber: t.inventoryItem.toolNumber || '-',
        itemName: t.inventoryItem.itemName,
        employee: t.employee?.name || '-',
        quantity: t.quantity,
        previousAvailable: t.previousAvailableStock,
        newAvailable: t.newAvailableStock,
        remarks: t.remarks || '-',
        performedBy: t.performedBy.fullName,
        date: formatISTDateTime(t.createdAt)
      }));
      return {
        title: '9. Stock Out Report',
        columns: [
          { header: 'Tx Ref', key: 'transactionRef', width: 20 },
          { header: 'Type', key: 'transactionType', width: 16 },
          { header: 'SKU', key: 'itemCode', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 10 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Issued To Employee', key: 'employee', width: 20 },
          { header: 'Qty Out', key: 'quantity', width: 12 },
          { header: 'Prev Avail', key: 'previousAvailable', width: 12 },
          { header: 'New Avail', key: 'newAvailable', width: 12 },
          { header: 'Remarks', key: 'remarks', width: 26 },
          { header: 'Performed By', key: 'performedBy', width: 18 },
          { header: 'Date & Time (IST)', key: 'date', width: 22 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'category-wise': {
      const categories = await prisma.category.findMany({
        include: {
          machine: true,
          subcategories: {
            include: {
              inventoryItems: true
            }
          },
          inventoryItems: true
        },
        orderBy: { name: 'asc' }
      });

      const rows: Record<string, unknown>[] = [];
      for (const cat of categories) {
        if (cat.subcategories.length > 0) {
          for (const sub of cat.subcategories) {
            const toolsList = sub.inventoryItems
              .map((t) => t.toolNumber || t.itemName)
              .join(', ');
            const totalStock = sub.inventoryItems.reduce(
              (s, i) => s + i.totalStock,
              0
            );
            const availStock = sub.inventoryItems.reduce(
              (s, i) => s + i.availableStock,
              0
            );
            const issuedStock = sub.inventoryItems.reduce(
              (s, i) => s + i.issuedStock,
              0
            );
            rows.push({
              machineOrType: cat.machine?.machineName || cat.targetType,
              category: cat.name,
              subcategory: sub.name,
              itemCount: sub.inventoryItems.length,
              tools: toolsList || '-',
              totalStock,
              availableStock: availStock,
              issuedStock
            });
          }
        } else {
          const totalStock = cat.inventoryItems.reduce(
            (s, i) => s + i.totalStock,
            0
          );
          const availStock = cat.inventoryItems.reduce(
            (s, i) => s + i.availableStock,
            0
          );
          const issuedStock = cat.inventoryItems.reduce(
            (s, i) => s + i.issuedStock,
            0
          );
          rows.push({
            machineOrType: cat.machine?.machineName || cat.targetType,
            category: cat.name,
            subcategory: '-',
            itemCount: cat.inventoryItems.length,
            tools:
              cat.inventoryItems
                .map((t) => t.toolNumber || t.itemName)
                .join(', ') || '-',
            totalStock,
            availableStock: availStock,
            issuedStock
          });
        }
      }

      return {
        title: '10. Category-wise Stock Report',
        columns: [
          { header: 'Machine / Type', key: 'machineOrType', width: 20 },
          { header: 'Category (e.g. 10bolt)', key: 'category', width: 20 },
          { header: 'Subcategory (e.g. 10-100)', key: 'subcategory', width: 22 },
          { header: 'Tools Count', key: 'itemCount', width: 14 },
          { header: 'Tools (e.g. 21, 34, 70)', key: 'tools', width: 30 },
          { header: 'Total Stock', key: 'totalStock', width: 14 },
          { header: 'Available Stock', key: 'availableStock', width: 16 },
          { header: 'Issued Stock', key: 'issuedStock', width: 14 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'machine-wise': {
      const machines = await prisma.machine.findMany({
        include: {
          inventoryItems: {
            include: { category: true, subcategory: true }
          }
        },
        orderBy: { machineName: 'asc' }
      });

      const rows: Record<string, unknown>[] = [];
      for (const m of machines) {
        for (const item of m.inventoryItems) {
          rows.push({
            machineCode: m.machineCode,
            machineName: m.machineName,
            machineType: m.machineType,
            location: m.location,
            category: item.category.name,
            subcategory: item.subcategory?.name || '-',
            toolNumber: item.toolNumber || '-',
            itemCode: item.itemCode,
            itemName: item.itemName,
            totalStock: item.totalStock,
            availableStock: item.availableStock,
            issuedStock: item.issuedStock
          });
        }
      }

      return {
        title: '11. Machine-wise Tools Report',
        columns: [
          { header: 'Machine Code', key: 'machineCode', width: 16 },
          { header: 'Machine Name', key: 'machineName', width: 22 },
          { header: 'Machine Type', key: 'machineType', width: 18 },
          { header: 'Location', key: 'location', width: 16 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Subcategory', key: 'subcategory', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 12 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Total Stock', key: 'totalStock', width: 14 },
          { header: 'Available', key: 'availableStock', width: 14 },
          { header: 'Issued', key: 'issuedStock', width: 12 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    case 'monthly-transactions': {
      const txs = await prisma.stockTransaction.findMany({
        where:
          startDate || endDate
            ? {
                createdAt: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {})
                }
              }
            : undefined,
        include: {
          inventoryItem: { include: { category: true, subcategory: true } },
          employee: true,
          supplier: true,
          performedBy: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const rows = txs.map((t) => ({
        month: new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short'
        }).format(t.createdAt),
        transactionRef: t.transactionRef,
        transactionType: t.transactionType,
        category: t.inventoryItem.category.name,
        subcategory: t.inventoryItem.subcategory?.name || '-',
        toolNumber: t.inventoryItem.toolNumber || '-',
        itemName: t.inventoryItem.itemName,
        quantity: t.quantity,
        party: t.employee?.name || t.supplier?.name || '-',
        performedBy: t.performedBy.fullName,
        date: formatISTDateTime(t.createdAt)
      }));

      return {
        title: '12. Monthly Inventory Transactions Report',
        columns: [
          { header: 'Month', key: 'month', width: 14 },
          { header: 'Tx Ref', key: 'transactionRef', width: 20 },
          { header: 'Tx Type', key: 'transactionType', width: 16 },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Subcategory', key: 'subcategory', width: 16 },
          { header: 'Tool #', key: 'toolNumber', width: 10 },
          { header: 'Item Name', key: 'itemName', width: 24 },
          { header: 'Quantity', key: 'quantity', width: 12 },
          { header: 'Employee / Supplier', key: 'party', width: 20 },
          { header: 'Performed By', key: 'performedBy', width: 18 },
          { header: 'Date & Time (IST)', key: 'date', width: 22 }
        ],
        rows: filterRowsBySearch(rows)
      };
    }

    default:
      throw new AppError(`Unknown report type: '${reportType}'`, 400);
  }
}

// Get JSON preview or downloadable Excel (.xlsx) / PDF (.pdf) for any of the 12 reports
router.get(
  '/:reportType',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportType = String(req.params.reportType);
      const format =
        typeof req.query.format === 'string'
          ? req.query.format.toLowerCase()
          : 'json';

      const report = await buildReportData(
        reportType,
        req.query as Record<string, unknown>
      );

      if (format === 'excel' || format === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Industrial Inventory System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(report.title.slice(0, 30));
        sheet.columns = report.columns;

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }
        };

        for (const r of report.rows) {
          sheet.addRow(r);
        }

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${reportType}-report.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${reportType}-report.pdf"`
        );

        const doc = new PDFDocument({
          margin: 30,
          size: 'A4',
          layout: 'landscape'
        });
        doc.pipe(res);

        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('Industrial Inventory & Stock Management System', {
            align: 'left'
          });
        doc.fontSize(13).text(report.title, { align: 'left' });
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(
            `Generated (Asia/Kolkata): ${formatISTDateTime(new Date())} | Total Records: ${report.rows.length}`,
            { align: 'left' }
          );
        doc.moveDown(1);

        const pageWidth = 780;
        const colCount = Math.min(report.columns.length, 10);
        const activeCols = report.columns.slice(0, colCount);
        const colWidth = Math.floor(pageWidth / colCount);

        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8);
        doc.rect(30, y - 3, pageWidth, 18).fill('#1e293b');
        doc.fillColor('#ffffff');

        activeCols.forEach((col, idx) => {
          doc.text(col.header, 34 + idx * colWidth, y, {
            width: colWidth - 6,
            ellipsis: true
          });
        });

        y += 20;
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a');

        for (const row of report.rows) {
          if (y > 530) {
            doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
            y = 40;
          }
          activeCols.forEach((col, idx) => {
            const val = String(row[col.key] ?? '-');
            doc.text(val, 34 + idx * colWidth, y, {
              width: colWidth - 6,
              ellipsis: true
            });
          });
          y += 16;
        }

        doc.end();
        return;
      }

      res.json({
        success: true,
        data: {
          title: report.title,
          generatedAtIST: formatISTDateTime(new Date()),
          totalRecords: report.rows.length,
          columns: report.columns,
          rows: report.rows
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
