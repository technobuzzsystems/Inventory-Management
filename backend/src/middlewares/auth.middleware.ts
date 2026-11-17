import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';
import { RoleName } from '@prisma/client';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: RoleName;
  employeeId?: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      role: RoleName;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new AppError('User account is inactive or no longer exists', 401);
    }

    const permissions = user.role.rolePermissions.map((rp) => rp.permission.code);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      employeeId: user.employeeId,
      permissions
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError('Invalid or expired access token', 401));
  }
}

export function authorizeRoles(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (req.user.role === RoleName.SUPER_ADMIN) {
      next();
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Access denied. Role '${req.user.role}' does not have permission for this resource.`,
          403
        )
      );
      return;
    }
    next();
  };
}

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (
      req.user.role === RoleName.SUPER_ADMIN ||
      req.user.permissions.includes(permissionCode)
    ) {
      next();
      return;
    }
    next(
      new AppError(
        `Access denied. Missing required permission: '${permissionCode}'`,
        403
      )
    );
  };
}
