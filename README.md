# Industrial Inventory & Stock Management System

A complete, production-ready **Industrial Inventory & Stock Management System** built with **Angular**, **Node.js + Express**, **PostgreSQL**, **Prisma ORM**, **Angular Material + Tailwind CSS**, and **Chart.js**.

---

## 1. Folder Structure (`d:\Inventory`)

Both `backend` and `frontend` live inside a single unified workspace (`d:\Inventory`):

```text
d:\Inventory\
├── package.json                # Root orchestration scripts
├── .env.example                # Environment variables example
├── README.md                   # Complete documentation (Setup, API, Deployment, Testing)
├── backend/                    # Node.js + Express + TypeScript + Prisma REST API
│   ├── prisma/
│   │   ├── schema.prisma       # 17 normalized PostgreSQL tables
│   │   ├── migrations/         # SQL migrations + non-negative stock CHECK constraints
│   │   └── seed.ts             # RBAC roles, permissions, users, machines, 10bolt hierarchy
│   ├── src/
│   │   ├── config/             # Database & environment configuration
│   │   ├── middlewares/        # JWT authentication, RBAC guards, Zod error handler
│   │   ├── modules/            # Modular REST controllers & routes (A through K)
│   │   └── utils/              # Asia/Kolkata (IST) date helpers, audit logger, code generators
│   └── tests/
│       └── scenarios.test.ts   # Automated test suite for all 7 mandatory business scenarios
└── frontend/                   # Angular + Angular Material + Tailwind CSS + Chart.js
    └── src/app/
        ├── core/               # AuthService, JWT Interceptor, Route Guard, ApiService, Notifications
        ├── layout/             # Industrial Sidebar + Topbar with live Overdue/Low-Stock counters
        ├── shared/             # IstDatePipe (Asia/Kolkata timezone display)
        └── features/           # All 11 feature modules connected to real backend APIs
```

---

## 2. Dynamic Category, Subcategory & Tool Hierarchy (`10bolt` Flow)

The system models the exact industrial hierarchy:

$$\text{Machine / Product Type} \longrightarrow \text{Category (e.g. } \texttt{10bolt}\text{)} \longrightarrow \text{Subcategory (e.g. } \texttt{10-100}, \texttt{10-70}\text{)} \longrightarrow \text{Tools (e.g. } \texttt{21}, \texttt{34}, \texttt{70}\text{)}$$

- **Quick Hierarchy Flow Builder**: Inside **Categories (`10bolt` Flow)**, admins can create or extend a Category (`10bolt`), Subcategory (`10-100` or `10-70`), and comma-separated Tool numbers (`21, 34, 70`) in a single transaction, or add individual tools inline under any subcategory card.
- **Duplicate Prevention**: Enforced at both database (`@@unique([categoryId, name])`) and service layers (case-insensitive check within the same parent).

---

## 3. Default RBAC Demo Accounts

All 4 roles are pre-seeded with password **`Admin@123`** (also available as 1-click quick-fill buttons on the Login screen):

| Role | Username | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `superadmin@industrial.co.in` | `Admin@123` | Full system access, RBAC user & permission management, all inventory, reports & audit logs |
| **Admin** | `admin` | `admin@industrial.co.in` | `Admin@123` | Manage machines, categories, inventory, stock adjustments, employees, issues, returns & reports |
| **Store Manager** | `storemanager` | `store@industrial.co.in` | `Admin@123` | Manage stock IN/OUT, issue and receive tools, view inventory, employees & reports |
| **Employee** | `employee` | `rajesh.sharma@industrial.co.in` | `Admin@123` | View own issued tools, issue history, expected return dates, and pending returns |

---

## 4. Installation & Running Instructions

### Prerequisites
- **Node.js**: v20+ (v24.18.0 detected)
- **PostgreSQL**: v14+ (`postgresql-x64-18` running on `localhost:5432`)

### Step 1: Configure Environment Variables
Copy `.env.example` to `backend/.env` and verify your PostgreSQL credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:1234@localhost:5432/inventory_db?schema=public"
JWT_ACCESS_SECRET="industrial_inventory_access_secret_key_2026_secure"
JWT_REFRESH_SECRET="industrial_inventory_refresh_secret_key_2026_secure"
JWT_ACCESS_EXPIRES_IN="8h"
JWT_REFRESH_EXPIRES_IN="7d"
TIMEZONE="Asia/Kolkata"
CORS_ORIGIN="http://localhost:4200"
```

### Step 2: Run Database Migrations & Seed Data
From `d:\Inventory`:
```bash
npm run db:migrate
npm run db:seed
```

### Step 3: Start Backend & Frontend Servers
- **Backend API Server** (`http://localhost:5000`):
  ```bash
  npm run dev:backend
  ```
- **Angular Frontend Application** (`http://localhost:4200`):
  ```bash
  npm run dev:frontend
  ```

---

## 5. REST API Documentation

| Module | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/login` | `POST` | Authenticate and receive JWT Access + Refresh tokens |
| **Auth** | `/api/auth/refresh` | `POST` | Rotate refresh token and issue new access token |
| **Auth** | `/api/auth/logout` | `POST` | Revoke active refresh token |
| **Auth** | `/api/auth/me` | `GET` | Get current user profile and permissions |
| **Dashboard** | `/api/dashboard/summary` | `GET` | 10 KPI cards, low stock alerts, overdue returns, recent txs, 12-month analytics |
| **Machines** | `/api/machines` | `GET, POST` | List machines with associated tools or add a new machine |
| **Machines** | `/api/machines/:id` | `GET, PUT` | Get or update machine details |
| **Machines** | `/api/machines/:id/status` | `PATCH` | Activate or deactivate machine |
| **Categories** | `/api/categories/hierarchy` | `GET` | Full tree: Machine $\rightarrow$ Category (`10bolt`) $\rightarrow$ Subcategory (`10-100`) $\rightarrow$ Tools (`21, 34, 70`) |
| **Categories** | `/api/categories/quick-hierarchy` | `POST` | Batch create Category $\rightarrow$ Subcategory $\rightarrow$ Tools in one transaction |
| **Categories** | `/api/categories` | `GET, POST` | List or create categories (prevents duplicates in same parent) |
| **Subcategories**| `/api/categories/subcategories` | `POST` | Create subcategory under a category |
| **Inventory** | `/api/inventory` | `GET, POST` | List/filter inventory items or create item (auto-SKU if omitted) |
| **Inventory** | `/api/inventory/:id/movements`| `GET` | Complete stock movement ledger for an item |
| **Stock Ops** | `/api/stock/in` | `POST` | Record purchased or returned stock IN (row-locked transaction) |
| **Stock Ops** | `/api/stock/out` | `POST` | Record direct stock OUT (prevents negative stock) |
| **Stock Ops** | `/api/stock/adjustments` | `GET, POST` | Authorized stock adjustments with mandatory audit reason |
| **Employees** | `/api/employees` | `GET, POST` | List or register employees |
| **Employees** | `/api/employees/tracking/all`| `GET` | Employee-wise inventory tracking with 5 filters |
| **Employees** | `/api/employees/:id/profile` | `GET` | Employee profile with currently issued tools & complete history |
| **Issues** | `/api/issues` | `GET, POST` | Multi-item employee tool checkout with `FOR UPDATE` row locking |
| **Returns** | `/api/returns` | `GET, POST` | Process Full, Partial, Damaged, or Lost tool returns |
| **Returns** | `/api/returns/pending-items` | `GET` | List all pending and overdue items with Days Held calculation |
| **Reports** | `/api/reports/:reportType` | `GET` | Generate any of the 12 reports (`?format=json`, `?format=excel`, `?format=pdf`) |
| **Audit Logs** | `/api/audit-logs` | `GET` | Immutable stock and system audit logs |
| **Users / RBAC** | `/api/users` & `/api/users/roles` | `GET, POST, PUT` | Manage users, roles, and permissions (Super Admin) |

---

## 6. Automated Testing Documentation (Scenarios 1–7)

Run the automated end-to-end scenario test suite against the live PostgreSQL database at any time:

```bash
npm run test:scenarios
```

### Verified Scenarios in `backend/tests/scenarios.test.ts`:
1. **Scenario 1**: Admin adds `100` units of a tool $\rightarrow$ `available_stock` becomes `100` and `total_stock` becomes `100`.
2. **Scenario 2**: Admin issues `10` units to Employee A $\rightarrow$ `available_stock` becomes `90` and `issued_stock` becomes `10`.
3. **Scenario 3**: Employee A returns `5` units (`GOOD`) $\rightarrow$ `available_stock` becomes `95`, `issued_stock` becomes `5`, and issue status becomes `PARTIALLY_RETURNED`.
4. **Scenario 4**: Employee A returns the remaining `5` units (`GOOD`) $\rightarrow$ `available_stock` becomes `100`, `issued_stock` becomes `0`, and issue status becomes `FULLY_RETURNED`.
5. **Scenario 5**: An employee does not return an item by the expected return date $\rightarrow$ the item automatically appears in the `OVERDUE` returns list with calculated `daysHeld`.
6. **Scenario 6**: An employee returns a `DAMAGED` item $\rightarrow$ recorded under `damaged_stock` and **does not** increase `available_stock`.
7. **Scenario 7**: Two authorized users (`Admin` and `Store Manager`) simultaneously attempt to issue stock exceeding remaining `available_stock` $\rightarrow$ PostgreSQL `SELECT ... FOR UPDATE` row locking allows the first (`201 Created`) and rejects the second (`409 Conflict`), preventing overselling.

---

## 7. Production Deployment Instructions

1. **Build Backend & Frontend**:
   ```bash
   npm run build:backend
   npm run build:frontend
   ```
2. **Database Migration in Production**:
   ```bash
   cd backend && npx prisma migrate deploy
   ```
3. **Run Backend API**:
   Serve `backend/dist/server.js` using PM2 or Docker with production `.env` variables (`NODE_ENV=production`).
4. **Serve Frontend**:
   Serve `frontend/dist/frontend/browser` via Nginx or Apache with SPA fallback (`try_files $uri $uri/ /index.html;`) and reverse-proxy `/api` to `http://localhost:5000/api`.
