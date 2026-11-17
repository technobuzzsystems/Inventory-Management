-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CategoryTargetType" AS ENUM ('MACHINE', 'PRODUCT', 'GENERAL');

-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('QUANTITY', 'SERIAL');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'DAMAGED', 'LOST', 'RETIRED');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('OPENING', 'PURCHASE_IN', 'RETURN_IN', 'ISSUE_OUT', 'DIRECT_OUT', 'ADJUSTMENT_ADD', 'ADJUSTMENT_DEDUCT', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "IssueReturnStatus" AS ENUM ('PENDING', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'OVERDUE', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('ADD', 'DEDUCT', 'MARK_DAMAGED', 'MARK_LOST', 'RECOVER');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "refresh_token_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "joining_date" TIMESTAMP(3) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "machine_name" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,
    "machine_type" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "target_type" "CategoryTargetType" NOT NULL DEFAULT 'MACHINE',
    "machine_id" TEXT,
    "machine_type" TEXT,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gst_number" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "tool_number" TEXT,
    "machine_id" TEXT,
    "category_id" TEXT NOT NULL,
    "subcategory_id" TEXT,
    "description" TEXT,
    "brand" TEXT,
    "model_number" TEXT,
    "unit_of_measurement" TEXT NOT NULL DEFAULT 'PCS',
    "tracking_type" "TrackingType" NOT NULL DEFAULT 'QUANTITY',
    "minimum_stock_level" INTEGER NOT NULL DEFAULT 5,
    "opening_stock" INTEGER NOT NULL DEFAULT 0,
    "total_stock" INTEGER NOT NULL DEFAULT 0,
    "available_stock" INTEGER NOT NULL DEFAULT 0,
    "issued_stock" INTEGER NOT NULL DEFAULT 0,
    "damaged_stock" INTEGER NOT NULL DEFAULT 0,
    "lost_stock" INTEGER NOT NULL DEFAULT 0,
    "storage_location" TEXT,
    "item_image" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_serial_assets" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "current_employee_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_serial_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "transaction_ref" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "transaction_type" "StockTransactionType" NOT NULL,
    "supplier_id" TEXT,
    "employee_id" TEXT,
    "issue_id" TEXT,
    "return_id" TEXT,
    "adjustment_id" TEXT,
    "invoice_reference" TEXT,
    "purchase_date" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "unit_price" DOUBLE PRECISION DEFAULT 0,
    "total_amount" DOUBLE PRECISION DEFAULT 0,
    "previous_available_stock" INTEGER NOT NULL,
    "new_available_stock" INTEGER NOT NULL,
    "previous_total_stock" INTEGER NOT NULL,
    "new_total_stock" INTEGER NOT NULL,
    "remarks" TEXT,
    "performed_by_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_issues" (
    "id" TEXT NOT NULL,
    "issue_reference" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "issue_time" TEXT NOT NULL,
    "expected_return_date" TIMESTAMP(3) NOT NULL,
    "actual_final_return_date" TIMESTAMP(3),
    "purpose_remarks" TEXT,
    "issued_by_id" TEXT NOT NULL,
    "status" "IssueReturnStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_items" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "serial_asset_id" TEXT,
    "issued_quantity" INTEGER NOT NULL,
    "accepted_returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "lost_quantity" INTEGER NOT NULL DEFAULT 0,
    "pending_quantity" INTEGER NOT NULL,
    "item_status" "IssueReturnStatus" NOT NULL DEFAULT 'PENDING',
    "actual_return_date" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_returns" (
    "id" TEXT NOT NULL,
    "return_reference" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL,
    "return_time" TEXT NOT NULL,
    "received_by_id" TEXT NOT NULL,
    "remarks" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "issue_item_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "serial_asset_id" TEXT,
    "returned_quantity" INTEGER NOT NULL,
    "condition" "ReturnCondition" NOT NULL DEFAULT 'GOOD',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "adjustment_ref" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "adjustment_type" "AdjustmentType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_available" INTEGER NOT NULL,
    "new_available" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "authorized_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "transaction_reference" TEXT,
    "inventory_item_id" TEXT,
    "previous_quantity" INTEGER,
    "updated_quantity" INTEGER,
    "old_values" JSONB,
    "new_values" JSONB,
    "description" TEXT,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "machines_machine_code_key" ON "machines"("machine_code");

-- CreateIndex
CREATE INDEX "machines_machine_type_idx" ON "machines"("machine_type");

-- CreateIndex
CREATE INDEX "machines_status_idx" ON "machines"("status");

-- CreateIndex
CREATE INDEX "categories_machine_id_idx" ON "categories"("machine_id");

-- CreateIndex
CREATE INDEX "categories_target_type_idx" ON "categories"("target_type");

-- CreateIndex
CREATE INDEX "categories_status_idx" ON "categories"("status");

-- CreateIndex
CREATE INDEX "subcategories_category_id_idx" ON "subcategories"("category_id");

-- CreateIndex
CREATE INDEX "subcategories_status_idx" ON "subcategories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_name_key" ON "subcategories"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_item_code_key" ON "inventory_items"("item_code");

-- CreateIndex
CREATE INDEX "inventory_items_machine_id_idx" ON "inventory_items"("machine_id");

-- CreateIndex
CREATE INDEX "inventory_items_category_id_idx" ON "inventory_items"("category_id");

-- CreateIndex
CREATE INDEX "inventory_items_subcategory_id_idx" ON "inventory_items"("subcategory_id");

-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");

-- CreateIndex
CREATE INDEX "inventory_items_item_name_idx" ON "inventory_items"("item_name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_serial_assets_serial_number_key" ON "inventory_serial_assets"("serial_number");

-- CreateIndex
CREATE INDEX "inventory_serial_assets_inventory_item_id_idx" ON "inventory_serial_assets"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_serial_assets_status_idx" ON "inventory_serial_assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_transaction_ref_key" ON "stock_transactions"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transactions_idempotency_key_key" ON "stock_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_transactions_inventory_item_id_idx" ON "stock_transactions"("inventory_item_id");

-- CreateIndex
CREATE INDEX "stock_transactions_transaction_type_idx" ON "stock_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "stock_transactions_created_at_idx" ON "stock_transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_issues_issue_reference_key" ON "inventory_issues"("issue_reference");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_issues_idempotency_key_key" ON "inventory_issues"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_issues_employee_id_idx" ON "inventory_issues"("employee_id");

-- CreateIndex
CREATE INDEX "inventory_issues_status_idx" ON "inventory_issues"("status");

-- CreateIndex
CREATE INDEX "inventory_issues_expected_return_date_idx" ON "inventory_issues"("expected_return_date");

-- CreateIndex
CREATE INDEX "inventory_issues_issue_date_idx" ON "inventory_issues"("issue_date");

-- CreateIndex
CREATE INDEX "issue_items_issue_id_idx" ON "issue_items"("issue_id");

-- CreateIndex
CREATE INDEX "issue_items_inventory_item_id_idx" ON "issue_items"("inventory_item_id");

-- CreateIndex
CREATE INDEX "issue_items_item_status_idx" ON "issue_items"("item_status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_returns_return_reference_key" ON "inventory_returns"("return_reference");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_returns_idempotency_key_key" ON "inventory_returns"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_returns_issue_id_idx" ON "inventory_returns"("issue_id");

-- CreateIndex
CREATE INDEX "inventory_returns_employee_id_idx" ON "inventory_returns"("employee_id");

-- CreateIndex
CREATE INDEX "inventory_returns_return_date_idx" ON "inventory_returns"("return_date");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_issue_item_id_idx" ON "return_items"("issue_item_id");

-- CreateIndex
CREATE INDEX "return_items_inventory_item_id_idx" ON "return_items"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_adjustment_ref_key" ON "stock_adjustments"("adjustment_ref");

-- CreateIndex
CREATE INDEX "stock_adjustments_inventory_item_id_idx" ON "stock_adjustments"("inventory_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serial_assets" ADD CONSTRAINT "inventory_serial_assets_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serial_assets" ADD CONSTRAINT "inventory_serial_assets_current_employee_id_fkey" FOREIGN KEY ("current_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "inventory_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "inventory_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "inventory_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_items" ADD CONSTRAINT "issue_items_serial_asset_id_fkey" FOREIGN KEY ("serial_asset_id") REFERENCES "inventory_serial_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "inventory_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "inventory_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_issue_item_id_fkey" FOREIGN KEY ("issue_item_id") REFERENCES "issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_serial_asset_id_fkey" FOREIGN KEY ("serial_asset_id") REFERENCES "inventory_serial_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
