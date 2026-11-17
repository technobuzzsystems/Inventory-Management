import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

export interface CreateAuditLogInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  transactionReference?: string | null;
  inventoryItemId?: string | null;
  previousQuantity?: number | null;
  updatedQuantity?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  description?: string | null;
  userId: string;
  ipAddress?: string | null;
}

export async function recordAuditLog(
  input: CreateAuditLogInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      transactionReference: input.transactionReference || null,
      inventoryItemId: input.inventoryItemId || null,
      previousQuantity:
        input.previousQuantity !== undefined ? input.previousQuantity : null,
      updatedQuantity:
        input.updatedQuantity !== undefined ? input.updatedQuantity : null,
      oldValues: input.oldValues
        ? (input.oldValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      newValues: input.newValues
        ? (input.newValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      description: input.description || null,
      userId: input.userId,
      ipAddress: input.ipAddress || null
    }
  });
}
