import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Employee Management & Employee-wise Inventory Tracking
          </h1>
          <p class="text-sm text-slate-500">
            View employee profiles, currently issued tools, pending quantities, days held, return statuses, and historical transactions
          </p>
        </div>

        <div class="flex gap-2">
          <button
            (click)="activeView.set('tracking')"
            class="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
            [ngClass]="
              activeView() === 'tracking'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            Employee-wise Inventory Tracking
          </button>
          <button
            (click)="activeView.set('directory')"
            class="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
            [ngClass]="
              activeView() === 'directory'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            Employee Directory ({{ employees().length }})
          </button>
          <button
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
            (click)="openCreateEmployee()"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
          >
            + Add Employee
          </button>
        </div>
      </div>

      <!-- Add / Edit Employee Form -->
      <div
        *ngIf="showEmployeeForm()"
        class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 class="text-base font-bold text-slate-900">
            {{ editingEmpId() ? 'Edit Employee' : 'Register New Employee' }}
          </h2>
          <button (click)="showEmployeeForm.set(false)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="saveEmployee()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Employee ID (Auto if blank)</label>
            <input
              type="text"
              name="empCode"
              [(ngModel)]="empForm.employeeCode"
              placeholder="e.g. EMP-1004"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Employee Name *</label>
            <input
              type="text"
              name="empName"
              [(ngModel)]="empForm.name"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Department *</label>
            <input
              type="text"
              name="empDept"
              [(ngModel)]="empForm.department"
              required
              placeholder="e.g. CNC Machining & Tooling"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Designation *</label>
            <input
              type="text"
              name="empDesig"
              [(ngModel)]="empForm.designation"
              required
              placeholder="e.g. Senior Operator"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Contact Number *</label>
            <input
              type="text"
              name="empPhone"
              [(ngModel)]="empForm.contactNumber"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              name="empEmail"
              [(ngModel)]="empForm.email"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Joining Date *</label>
            <input
              type="date"
              name="empJoin"
              [(ngModel)]="empForm.joiningDate"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status</label>
            <select
              name="empStatus"
              [(ngModel)]="empForm.status"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div class="md:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              (click)="showEmployeeForm.set(false)"
              class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
            >
              Save Employee
            </button>
          </div>
        </form>
      </div>

      <!-- VIEW 1: DEDICATED EMPLOYEE-WISE INVENTORY TRACKING PAGE (Module I) -->
      <div *ngIf="activeView() === 'tracking'" class="space-y-5">
        <!-- 5 Required Filters: Employee, Department, Item, Date Range, Return Status -->
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Employee</label>
            <select
              [(ngModel)]="trackingFilters.employeeId"
              (ngModelChange)="loadTracking()"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="">All Employees</option>
              <option *ngFor="let e of employees()" [value]="e.id">
                {{ e.name }} ({{ e.employeeCode }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Department</label>
            <input
              type="text"
              [(ngModel)]="trackingFilters.department"
              (ngModelChange)="loadTracking()"
              placeholder="Filter department..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Inventory Item / Tool</label>
            <select
              [(ngModel)]="trackingFilters.inventoryItemId"
              (ngModelChange)="loadTracking()"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">All Tools / Products</option>
              <option *ngFor="let i of items()" [value]="i.id">
                [{{ i.category?.name }} &rarr; {{ i.subcategory?.name || '-' }} | #{{ i.toolNumber || '-' }}] {{ i.itemName }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">From Issue Date</label>
            <input
              type="date"
              [(ngModel)]="trackingFilters.startDate"
              (ngModelChange)="loadTracking()"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">To Issue Date</label>
            <input
              type="date"
              [(ngModel)]="trackingFilters.endDate"
              (ngModelChange)="loadTracking()"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Return Status</label>
            <select
              [(ngModel)]="trackingFilters.returnStatus"
              (ngModelChange)="loadTracking()"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIALLY_RETURNED">PARTIALLY_RETURNED</option>
              <option value="FULLY_RETURNED">FULLY_RETURNED</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="DAMAGED">DAMAGED</option>
              <option value="LOST">LOST</option>
            </select>
          </div>
        </div>

        <!-- Employee Tracking Records Table -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-900 text-white uppercase text-[11px]">
                  <th class="py-3 px-4">Employee & Dept</th>
                  <th class="py-3 px-4">Issue Ref</th>
                  <th class="py-3 px-4">Product / Tool Name (Hierarchy)</th>
                  <th class="py-3 px-4 text-center">Issued Qty</th>
                  <th class="py-3 px-4 text-center">Pending Qty</th>
                  <th class="py-3 px-4">Issue Date & Time</th>
                  <th class="py-3 px-4">Expected Return</th>
                  <th class="py-3 px-4">Actual Return Date</th>
                  <th class="py-3 px-4 text-center">Days Held</th>
                  <th class="py-3 px-4">Return Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr
                  *ngFor="let rec of trackingRecords()"
                  [ngClass]="rec.isOverdue ? 'bg-red-50/40' : 'hover:bg-slate-50'"
                >
                  <td class="py-3 px-4">
                    <button
                      (click)="openProfileDrawer(rec.employee?.id)"
                      class="font-bold text-blue-700 hover:underline text-left cursor-pointer"
                    >
                      {{ rec.employee?.name }}
                    </button>
                    <div class="text-[11px] text-slate-500">
                      {{ rec.employee?.employeeCode }} | {{ rec.department }}
                    </div>
                  </td>
                  <td class="py-3 px-4 font-mono-code font-bold">{{ rec.issueReference }}</td>
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-900">{{ rec.inventoryItem?.itemName }}</div>
                    <div class="text-[11px] text-slate-500 font-mono-code">
                      {{ rec.inventoryItem?.category?.name }} &rarr; {{ rec.inventoryItem?.subcategory?.name || '-' }} | Tool #{{ rec.inventoryItem?.toolNumber || '-' }}
                    </div>
                  </td>
                  <td class="py-3 px-4 text-center font-bold">{{ rec.issuedQuantity }}</td>
                  <td class="py-3 px-4 text-center font-bold text-amber-800">
                    {{ rec.pendingQuantity }}
                  </td>
                  <td class="py-3 px-4">
                    {{ rec.issueDate | istDate:'date' }} <span class="text-slate-500">{{ rec.issueTime }}</span>
                  </td>
                  <td class="py-3 px-4 font-semibold">
                    {{ rec.expectedReturnDate | istDate:'date' }}
                  </td>
                  <td class="py-3 px-4">
                    {{ rec.actualReturnDate ? (rec.actualReturnDate | istDate:'date') : '-' }}
                  </td>
                  <td class="py-3 px-4 text-center font-bold">{{ rec.daysHeld }} days</td>
                  <td class="py-3 px-4">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="{
                        'bg-red-100 text-red-800 border border-red-300': rec.returnStatus === 'OVERDUE',
                        'bg-amber-100 text-amber-800': rec.returnStatus === 'PENDING',
                        'bg-blue-100 text-blue-800': rec.returnStatus === 'PARTIALLY_RETURNED',
                        'bg-emerald-100 text-emerald-800': rec.returnStatus === 'FULLY_RETURNED',
                        'bg-orange-100 text-orange-800': rec.returnStatus === 'DAMAGED',
                        'bg-rose-100 text-rose-800': rec.returnStatus === 'LOST'
                      }"
                    >
                      {{ rec.returnStatus }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- VIEW 2: EMPLOYEE DIRECTORY -->
      <div *ngIf="activeView() === 'directory'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          *ngFor="let emp of employees()"
          class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded bg-slate-100 font-mono-code font-bold text-xs text-slate-800">
                {{ emp.employeeCode }}
              </span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                [ngClass]="
                  emp.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                "
              >
                {{ emp.status }}
              </span>
            </div>
            <h3 class="mt-2 text-base font-bold text-slate-900">{{ emp.name }}</h3>
            <p class="text-xs text-slate-600">{{ emp.designation }} — {{ emp.department }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ emp.contactNumber }} | {{ emp.email }}</p>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-amber-800">
                Pending Qty: {{ emp.summary?.totalPendingQty || 0 }}
              </span>
              <span *ngIf="emp.summary?.overdueCount > 0" class="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                {{ emp.summary.overdueCount }} Overdue
              </span>
            </div>
            <div class="flex gap-1.5">
              <button
                (click)="openProfileDrawer(emp.id)"
                class="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
              >
                Open Profile
              </button>
              <button
                *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                (click)="openEditEmployee(emp)"
                class="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Employee Profile Modal (Currently Issued Tools + Complete Historical Transactions) -->
      <div
        *ngIf="selectedProfile()"
        class="bg-white p-6 rounded-xl border-2 border-slate-900 shadow-2xl space-y-5"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900">
              Employee Inventory Profile: {{ selectedProfile()?.employee?.name }} ({{ selectedProfile()?.employee?.employeeCode }})
            </h2>
            <p class="text-xs text-slate-500">
              Department: <strong>{{ selectedProfile()?.employee?.department }}</strong> |
              Designation: <strong>{{ selectedProfile()?.employee?.designation }}</strong> |
              Contact: <strong>{{ selectedProfile()?.employee?.contactNumber }}</strong>
            </p>
          </div>
          <button (click)="selectedProfile.set(null)" class="text-slate-400 hover:text-slate-800 font-bold cursor-pointer">
            ✕ Close Profile
          </button>
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-bold text-amber-900">
            Currently Issued Tools ({{ selectedProfile()?.currentlyIssued?.length || 0 }})
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs border border-slate-200">
              <thead>
                <tr class="bg-amber-50 text-amber-950 uppercase text-[10px]">
                  <th class="py-2 px-3">Issue Ref</th>
                  <th class="py-2 px-3">Tool / Product</th>
                  <th class="py-2 px-3">Issued Qty</th>
                  <th class="py-2 px-3">Pending Qty</th>
                  <th class="py-2 px-3">Issue Date</th>
                  <th class="py-2 px-3">Expected Return</th>
                  <th class="py-2 px-3">Days Held</th>
                  <th class="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr *ngFor="let ci of selectedProfile()?.currentlyIssued">
                  <td class="py-2 px-3 font-mono-code font-bold">{{ ci.issueReference }}</td>
                  <td class="py-2 px-3 font-semibold">{{ ci.inventoryItem?.itemName }}</td>
                  <td class="py-2 px-3">{{ ci.issuedQuantity }}</td>
                  <td class="py-2 px-3 font-bold text-amber-800">{{ ci.pendingQuantity }}</td>
                  <td class="py-2 px-3">{{ ci.issueDate | istDate:'date' }} {{ ci.issueTime }}</td>
                  <td class="py-2 px-3">{{ ci.expectedReturnDate | istDate:'date' }}</td>
                  <td class="py-2 px-3 font-bold">{{ ci.daysHeld }} days</td>
                  <td class="py-2 px-3 font-bold">{{ ci.returnStatus }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class EmployeesComponent implements OnInit {
  activeView = signal<'tracking' | 'directory'>('tracking');
  employees = signal<any[]>([]);
  items = signal<any[]>([]);
  trackingRecords = signal<any[]>([]);
  selectedProfile = signal<any | null>(null);

  showEmployeeForm = signal(false);
  editingEmpId = signal<string | null>(null);

  trackingFilters = {
    employeeId: '',
    department: '',
    inventoryItemId: '',
    startDate: '',
    endDate: '',
    returnStatus: ''
  };

  empForm = {
    employeeCode: '',
    name: '',
    department: '',
    designation: '',
    contactNumber: '',
    email: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE'
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadEmployees();
    this.api.get('/inventory').subscribe((res) => this.items.set(res.data || []));
    this.loadTracking();
  }

  loadEmployees(): void {
    this.api
      .get('/employees')
      .subscribe((res) => this.employees.set(res.data || []));
  }

  loadTracking(): void {
    this.api
      .get('/employees/tracking/all', this.trackingFilters)
      .subscribe((res) => this.trackingRecords.set(res.data || []));
  }

  openProfileDrawer(empId: string): void {
    if (!empId) return;
    this.api.get(`/employees/${empId}/profile`).subscribe({
      next: (res) => this.selectedProfile.set(res.data)
    });
  }

  openCreateEmployee(): void {
    this.editingEmpId.set(null);
    this.empForm = {
      employeeCode: '',
      name: '',
      department: '',
      designation: '',
      contactNumber: '',
      email: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE'
    };
    this.showEmployeeForm.set(true);
  }

  openEditEmployee(emp: any): void {
    this.editingEmpId.set(emp.id);
    this.empForm = {
      employeeCode: emp.employeeCode,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      contactNumber: emp.contactNumber,
      email: emp.email,
      joiningDate: new Date(emp.joiningDate).toISOString().slice(0, 10),
      status: emp.status
    };
    this.showEmployeeForm.set(true);
  }

  saveEmployee(): void {
    const id = this.editingEmpId();
    const req$ = id
      ? this.api.put(`/employees/${id}`, this.empForm)
      : this.api.post('/employees', this.empForm);

    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Employee updated' : 'Employee created');
        this.showEmployeeForm.set(false);
        this.loadEmployees();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to save employee')
    });
  }
}
