import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { recordAuditLog } from '../../utils/audit-logger';

const router = Router();

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

function signTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { sub: userId, role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
  const refreshToken = jwt.sign(
    { sub: userId, role, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
  return { accessToken, refreshToken };
}

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { usernameOrEmail, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: usernameOrEmail, mode: 'insensitive' } },
            { email: { equals: usernameOrEmail, mode: 'insensitive' } }
          ]
        },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          },
          employee: true
        }
      });

      if (!user || !user.isActive) {
        throw new AppError('Invalid credentials or inactive account', 401);
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        throw new AppError('Invalid credentials', 401);
      }

      const { accessToken, refreshToken } = signTokens(user.id, user.role.name);
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash,
          lastLoginAt: new Date()
        }
      });

      await recordAuditLog({
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        description: `User ${user.username} (${user.role.name}) logged in`,
        userId: user.id,
        ipAddress: req.ip
      });

      const permissions = user.role.rolePermissions.map(
        (rp) => rp.permission.code
      );

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role.name,
            roleDisplayName: user.role.displayName,
            employeeId: user.employeeId,
            employee: user.employee,
            permissions
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400);
      }

      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        sub: string;
        role: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } }
            }
          }
        }
      });

      if (!user || !user.isActive || !user.refreshTokenHash) {
        throw new AppError('Invalid refresh session', 401);
      }

      const isMatchingToken = await bcrypt.compare(
        refreshToken,
        user.refreshTokenHash
      );
      if (!isMatchingToken) {
        throw new AppError('Refresh token has been revoked or rotated', 401);
      }

      const tokens = signTokens(user.id, user.role.name);
      const newRefreshHash = await bcrypt.hash(tokens.refreshToken, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: newRefreshHash }
      });

      res.json({
        success: true,
        data: tokens
      });
    } catch (err) {
      next(new AppError('Invalid or expired refresh token', 401));
    }
  }
);

router.post(
  '/logout',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { refreshTokenHash: null }
      });
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/me',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } }
            }
          },
          employee: true
        }
      });

      if (!user) throw new AppError('User not found', 404);

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role.name,
          roleDisplayName: user.role.displayName,
          employeeId: user.employeeId,
          employee: user.employee,
          permissions: user.role.rolePermissions.map((rp) => rp.permission.code)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
