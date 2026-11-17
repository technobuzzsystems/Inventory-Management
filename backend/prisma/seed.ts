import bcrypt from 'bcryptjs';
import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning all dummy transactional and master data...');

  // Wipe all dummy transactions, issues, returns, inventory items, categories, machines, suppliers, and employees
  await prisma.auditLog.deleteMany({});
  await prisma.returnItem.deleteMany({});
  await prisma.inventoryReturn.deleteMany({});
  await prisma.issueItem.deleteMany({});
  await prisma.inventoryIssue.deleteMany({});
  await prisma.stockTransaction.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
  await prisma.inventorySerialAsset.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.subcategory.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.machine.deleteMany({});
  await prisma.supplier.deleteMany({});

  // Unlink employeeId from any users before deleting employees
  await prisma.user.updateMany({
    data: { employeeId: null }
  });
  await prisma.employee.deleteMany({});

  console.log('Seeding essential RBAC roles, permissions, and system login accounts...');

  // 1. Permissions
  const permissionList = [
    { code: 'dashboard:view', module: 'DASHBOARD', description: 'View dashboard metrics' },
    { code: 'machine:manage', module: 'MACHINES', description: 'Add, edit, activate/deactivate machines' },
    { code: 'category:manage', module: 'CATEGORIES', description: 'Manage categories and subcategories' },
    { code: 'inventory:view', module: 'INVENTORY', description: 'View inventory items' },
    { code: 'inventory:manage', module: 'INVENTORY', description: 'Add, edit, deactivate, and bulk import inventory items' },
    { code: 'stock:in_out', module: 'STOCK', description: 'Perform Stock In and Stock Out transactions' },
    { code: 'stock:adjust', module: 'STOCK', description: 'Perform authorized stock adjustments' },
    { code: 'employee:manage', module: 'EMPLOYEES', description: 'Add and edit employees' },
    { code: 'issue:manage', module: 'ISSUES', description: 'Issue multiple tools and products to employees' },
    { code: 'return:manage', module: 'RETURNS', description: 'Receive and record returned items' },
    { code: 'report:view', module: 'REPORTS', description: 'View and export reports' },
    { code: 'audit:view', module: 'AUDIT', description: 'View system audit logs' },
    { code: 'user:manage', module: 'USERS', description: 'Manage users, roles, and permissions' }
  ];

  const createdPermissions: Record<string, string> = {};
  for (const perm of permissionList) {
    const p = await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm
    });
    createdPermissions[perm.code] = p.id;
  }

  // 2. Roles
  const rolesConfig = [
    {
      name: RoleName.SUPER_ADMIN,
      displayName: 'Super Admin',
      description: 'Full access to the entire system, users, permissions, and audit logs',
      perms: permissionList.map((p) => p.code)
    },
    {
      name: RoleName.ADMIN,
      displayName: 'Admin',
      description: 'Manage inventory, machines, categories, employees, issues, returns, and reports',
      perms: [
        'dashboard:view',
        'machine:manage',
        'category:manage',
        'inventory:view',
        'inventory:manage',
        'stock:in_out',
        'stock:adjust',
        'employee:manage',
        'issue:manage',
        'return:manage',
        'report:view',
        'audit:view'
      ]
    },
    {
      name: RoleName.STORE_MANAGER,
      displayName: 'Store Manager',
      description: 'Manage stock, issue and receive tools, view inventory and employee records',
      perms: [
        'dashboard:view',
        'inventory:view',
        'inventory:manage',
        'stock:in_out',
        'issue:manage',
        'return:manage',
        'report:view'
      ]
    },
    {
      name: RoleName.EMPLOYEE,
      displayName: 'Employee',
      description: 'View own issued items, issue history, expected return dates, and pending returns',
      perms: ['dashboard:view', 'inventory:view']
    }
  ];

  const roleMap: Record<RoleName, string> = {} as Record<RoleName, string>;

  for (const rc of rolesConfig) {
    const role = await prisma.role.upsert({
      where: { name: rc.name },
      update: { displayName: rc.displayName, description: rc.description },
      create: {
        name: rc.name,
        displayName: rc.displayName,
        description: rc.description
      }
    });
    roleMap[rc.name] = role.id;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: rc.perms.map((code) => ({
        roleId: role.id,
        permissionId: createdPermissions[code]
      }))
    });
  }

  // 3. System Login Users Only (Zero dummy inventory/machines/employees)
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { passwordHash, roleId: roleMap[RoleName.SUPER_ADMIN], employeeId: null },
    create: {
      username: 'superadmin',
      email: 'superadmin@company.com',
      passwordHash,
      fullName: 'Super Administrator',
      roleId: roleMap[RoleName.SUPER_ADMIN],
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash, roleId: roleMap[RoleName.ADMIN], employeeId: null },
    create: {
      username: 'admin',
      email: 'admin@company.com',
      passwordHash,
      fullName: 'System Admin',
      roleId: roleMap[RoleName.ADMIN],
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { username: 'storemanager' },
    update: { passwordHash, roleId: roleMap[RoleName.STORE_MANAGER], employeeId: null },
    create: {
      username: 'storemanager',
      email: 'store@company.com',
      passwordHash,
      fullName: 'Store Manager',
      roleId: roleMap[RoleName.STORE_MANAGER],
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { username: 'employee' },
    update: { passwordHash, roleId: roleMap[RoleName.EMPLOYEE], employeeId: null },
    create: {
      username: 'employee',
      email: 'employee@company.com',
      passwordHash,
      fullName: 'Employee Portal User',
      roleId: roleMap[RoleName.EMPLOYEE],
      isActive: true
    }
  });

  console.log('Database wiped of all dummy records. Only RBAC roles and login users remain.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
