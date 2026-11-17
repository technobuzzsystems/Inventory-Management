import assert from 'node:assert';
import http from 'node:http';
import app from '../src/app';
import { prisma } from '../src/config/db';

let server: http.Server;
let baseUrl = '';
let adminToken = '';
let storeManagerToken = '';

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  token = adminToken
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('==============================================================');
  console.log('RUNNING AUTOMATED VERIFICATION OF ALL 7 MANDATORY SCENARIOS');
  console.log('==============================================================\n');

  server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5055;
  baseUrl = `http://localhost:${port}/api`;

  let testToolId = '';
  let testCatId = '';
  let testSubId = '';
  let testEmpId = '';

  try {
    // Authenticate Admin & Store Manager
    const adminLogin = await apiRequest(
      'POST',
      '/auth/login',
      { usernameOrEmail: 'admin', password: 'Admin@123' },
      ''
    );
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    adminToken = adminLogin.data.data.accessToken;

    const smLogin = await apiRequest(
      'POST',
      '/auth/login',
      { usernameOrEmail: 'storemanager', password: 'Admin@123' },
      ''
    );
    assert.strictEqual(smLogin.status, 200, 'Store Manager login should succeed');
    storeManagerToken = smLogin.data.data.accessToken;

    // Create temporary Category, Subcategory, and Employee A for the test run
    const catRes = await apiRequest('POST', '/categories', {
      name: `TestCat-${Date.now()}`,
      targetType: 'MACHINE'
    });
    assert.strictEqual(catRes.status, 201);
    testCatId = catRes.data.data.id;

    const subRes = await apiRequest('POST', '/categories/subcategories', {
      categoryId: testCatId,
      name: '10-100'
    });
    assert.strictEqual(subRes.status, 201);
    testSubId = subRes.data.data.id;

    const empRes = await apiRequest('POST', '/employees', {
      name: 'Test Employee A',
      department: 'Tooling',
      designation: 'Operator',
      contactNumber: '9999999999',
      email: `test.emp.${Date.now()}@company.com`,
      joiningDate: new Date().toISOString().slice(0, 10)
    });
    assert.strictEqual(empRes.status, 201);
    testEmpId = empRes.data.data.id;

    // Create a clean test tool item with 0 opening stock to test Scenario 1 -> 7
    const createItemRes = await apiRequest('POST', '/inventory', {
      itemName: `Test Tool #21 (Scenario Suite ${Date.now()})`,
      toolNumber: '21',
      categoryId: testCatId,
      subcategoryId: testSubId,
      unitOfMeasurement: 'PCS',
      minimumStockLevel: 5,
      openingStock: 0,
      storageLocation: 'Test Bay 1'
    });
    assert.strictEqual(createItemRes.status, 201);
    testToolId = createItemRes.data.data.id;

    // ------------------------------------------------------------------------
    // SCENARIO 1: Admin adds 100 units of a tool. Available stock must become 100.
    // ------------------------------------------------------------------------
    console.log('-> Testing Scenario 1: Admin adds 100 units of a tool...');
    const stockInRes = await apiRequest('POST', '/stock/in', {
      inventoryItemId: testToolId,
      transactionType: 'PURCHASE_IN',
      quantity: 100,
      unitPrice: 250,
      invoiceReference: 'INV-TEST-100',
      remarks: 'Scenario 1: Add 100 units'
    });
    assert.strictEqual(stockInRes.status, 201);
    assert.strictEqual(
      stockInRes.data.data.item.availableStock,
      100,
      'Available stock must become 100'
    );
    assert.strictEqual(
      stockInRes.data.data.item.totalStock,
      100,
      'Total stock must become 100'
    );
    console.log('   [PASS] Scenario 1: Available stock = 100, Total stock = 100\n');

    // ------------------------------------------------------------------------
    // SCENARIO 2: Admin issues 10 units to Employee A. Available stock must become 90 and issued stock must become 10.
    // ------------------------------------------------------------------------
    console.log('-> Testing Scenario 2: Admin issues 10 units to Employee A...');
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const issueRes = await apiRequest('POST', '/issues', {
      employeeId: testEmpId,
      expectedReturnDate: tomorrow,
      purposeRemarks: 'Scenario 2: Issue 10 units to Employee A',
      items: [
        {
          inventoryItemId: testToolId,
          issueQuantity: 10
        }
      ]
    });
    assert.strictEqual(issueRes.status, 201);
    const issueId = issueRes.data.data.id;
    const issueItemId = issueRes.data.data.items[0].id;

    const itemAfterIssue = await apiRequest('GET', `/inventory/${testToolId}`);
    assert.strictEqual(
      itemAfterIssue.data.data.availableStock,
      90,
      'Available stock must become 90'
    );
    assert.strictEqual(
      itemAfterIssue.data.data.issuedStock,
      10,
      'Issued stock must become 10'
    );
    console.log(
      '   [PASS] Scenario 2: Available stock = 90, Issued stock = 10\n'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 3: Employee A returns 5 units. Available stock must become 95, issued stock must become 5, and issue status must become Partially Returned.
    // ------------------------------------------------------------------------
    console.log(
      '-> Testing Scenario 3: Employee A returns 5 units (Partial Return)...'
    );
    const partialReturnRes = await apiRequest('POST', '/returns', {
      issueId,
      remarks: 'Scenario 3: Partial return of 5 units',
      items: [
        {
          issueItemId,
          returnedQuantity: 5,
          condition: 'GOOD'
        }
      ]
    });
    assert.strictEqual(partialReturnRes.status, 201);
    assert.strictEqual(
      partialReturnRes.data.data.issue.status,
      'PARTIALLY_RETURNED',
      'Issue status must become PARTIALLY_RETURNED'
    );

    const itemAfterPartial = await apiRequest('GET', `/inventory/${testToolId}`);
    assert.strictEqual(
      itemAfterPartial.data.data.availableStock,
      95,
      'Available stock must become 95'
    );
    assert.strictEqual(
      itemAfterPartial.data.data.issuedStock,
      5,
      'Issued stock must become 5'
    );
    console.log(
      '   [PASS] Scenario 3: Available stock = 95, Issued stock = 5, Status = PARTIALLY_RETURNED\n'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 4: Employee A returns the remaining 5 units. Available stock must become 100 and the issue status must become Fully Returned.
    // ------------------------------------------------------------------------
    console.log(
      '-> Testing Scenario 4: Employee A returns remaining 5 units (Full Return)...'
    );
    const fullReturnRes = await apiRequest('POST', '/returns', {
      issueId,
      remarks: 'Scenario 4: Return remaining 5 units',
      items: [
        {
          issueItemId,
          returnedQuantity: 5,
          condition: 'GOOD'
        }
      ]
    });
    assert.strictEqual(fullReturnRes.status, 201);
    assert.strictEqual(
      fullReturnRes.data.data.issue.status,
      'FULLY_RETURNED',
      'Issue status must become FULLY_RETURNED'
    );

    const itemAfterFull = await apiRequest('GET', `/inventory/${testToolId}`);
    assert.strictEqual(
      itemAfterFull.data.data.availableStock,
      100,
      'Available stock must become 100'
    );
    assert.strictEqual(
      itemAfterFull.data.data.issuedStock,
      0,
      'Issued stock must become 0'
    );
    console.log(
      '   [PASS] Scenario 4: Available stock = 100, Issued stock = 0, Status = FULLY_RETURNED\n'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 5: An employee does not return an item by the expected date. The item must appear in the Overdue Returns list.
    // ------------------------------------------------------------------------
    console.log(
      '-> Testing Scenario 5: Overdue Return detection when past expected date...'
    );
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const overdueIssueRes = await apiRequest('POST', '/issues', {
      employeeId: testEmpId,
      issueDate: fiveDaysAgo,
      expectedReturnDate: yesterday,
      purposeRemarks: 'Scenario 5: Overdue test',
      items: [
        {
          inventoryItemId: testToolId,
          issueQuantity: 4
        }
      ]
    });
    assert.strictEqual(overdueIssueRes.status, 201);
    const overdueIssueId = overdueIssueRes.data.data.id;
    const overdueIssueItemId = overdueIssueRes.data.data.items[0].id;

    const overdueListRes = await apiRequest(
      'GET',
      '/returns/pending-items?overdueOnly=true'
    );
    assert.strictEqual(overdueListRes.status, 200);
    const foundOverdue = overdueListRes.data.data.find(
      (i: any) => i.id === overdueIssueItemId
    );
    assert.ok(
      foundOverdue,
      'Unreturned item past expected return date must appear in Overdue Returns list'
    );
    assert.strictEqual(foundOverdue.effectiveStatus, 'OVERDUE');
    console.log(
      `   [PASS] Scenario 5: Overdue item detected in Overdue Returns list (Days Held: ${foundOverdue.daysHeld})\n`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 6: An employee returns a damaged item. It must be recorded as damaged and must not increase available stock.
    // ------------------------------------------------------------------------
    console.log(
      '-> Testing Scenario 6: Employee returns a DAMAGED item (must not increase available stock)...'
    );
    const beforeDamaged = await apiRequest('GET', `/inventory/${testToolId}`);
    const availBeforeDamaged = beforeDamaged.data.data.availableStock; // 96

    const damagedReturnRes = await apiRequest('POST', '/returns', {
      issueId: overdueIssueId,
      remarks: 'Scenario 6: Returned 4 units damaged',
      items: [
        {
          issueItemId: overdueIssueItemId,
          returnedQuantity: 4,
          condition: 'DAMAGED'
        }
      ]
    });
    assert.strictEqual(damagedReturnRes.status, 201);

    const afterDamaged = await apiRequest('GET', `/inventory/${testToolId}`);
    assert.strictEqual(
      afterDamaged.data.data.availableStock,
      availBeforeDamaged,
      'Available stock MUST NOT increase when returned item is DAMAGED'
    );
    assert.strictEqual(
      afterDamaged.data.data.damagedStock,
      4,
      'Damaged stock must increase by 4'
    );
    assert.strictEqual(
      afterDamaged.data.data.issuedStock,
      0,
      'Issued stock must decrease to 0'
    );
    console.log(
      `   [PASS] Scenario 6: Available stock remained ${afterDamaged.data.data.availableStock}, Damaged stock = ${afterDamaged.data.data.damagedStock}\n`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 7: Two authorized users attempt to issue the same remaining stock simultaneously. The system must prevent overselling.
    // ------------------------------------------------------------------------
    console.log(
      '-> Testing Scenario 7: Concurrent checkout race condition prevention (Admin + Store Manager)...'
    );
    const [concurrentReq1, concurrentReq2] = await Promise.all([
      apiRequest(
        'POST',
        '/issues',
        {
          employeeId: testEmpId,
          expectedReturnDate: tomorrow,
          purposeRemarks: 'Scenario 7 Concurrent User 1 (Admin)',
          items: [{ inventoryItemId: testToolId, issueQuantity: 60 }]
        },
        adminToken
      ),
      apiRequest(
        'POST',
        '/issues',
        {
          employeeId: testEmpId,
          expectedReturnDate: tomorrow,
          purposeRemarks: 'Scenario 7 Concurrent User 2 (Store Manager)',
          items: [{ inventoryItemId: testToolId, issueQuantity: 60 }]
        },
        storeManagerToken
      )
    ]);

    const statuses = [concurrentReq1.status, concurrentReq2.status].sort();
    assert.deepStrictEqual(
      statuses,
      [201, 409],
      `Expected one 201 Created and one 409 Conflict, got ${statuses}`
    );

    const afterConcurrent = await apiRequest('GET', `/inventory/${testToolId}`);
    assert.strictEqual(
      afterConcurrent.data.data.availableStock,
      36,
      'Available stock must be 96 - 60 = 36 (never negative or double-deducted)'
    );
    console.log(
      `   [PASS] Scenario 7: Concurrent requests resulted in [${statuses.join(
        ', '
      )}]. Overselling prevented! Remaining available stock = ${
        afterConcurrent.data.data.availableStock
      }\n`
    );

    console.log('==============================================================');
    console.log('ALL 7 MANDATORY TESTING SCENARIOS PASSED 100% SUCCESSFULLY!');
    console.log('==============================================================');
  } finally {
    // Clean up all temporary test records so the database stays 100% free of dummy data
    if (testToolId) {
      await prisma.returnItem.deleteMany({ where: { inventoryItemId: testToolId } });
      await prisma.issueItem.deleteMany({ where: { inventoryItemId: testToolId } });
      await prisma.stockTransaction.deleteMany({ where: { inventoryItemId: testToolId } });
    }
    if (testEmpId) {
      await prisma.inventoryReturn.deleteMany({ where: { employeeId: testEmpId } });
      await prisma.inventoryIssue.deleteMany({ where: { employeeId: testEmpId } });
    }
    if (testToolId) {
      await prisma.inventoryItem.deleteMany({ where: { id: testToolId } });
    }
    if (testSubId) {
      await prisma.subcategory.deleteMany({ where: { id: testSubId } });
    }
    if (testCatId) {
      await prisma.category.deleteMany({ where: { id: testCatId } });
    }
    if (testEmpId) {
      await prisma.employee.deleteMany({ where: { id: testEmpId } });
    }
    await prisma.auditLog.deleteMany({});
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Scenario Test Suite Failed:', err);
  process.exit(1);
});
