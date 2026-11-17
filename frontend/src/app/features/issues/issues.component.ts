import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

export interface IssueLineItem {
  categoryId: string;
  subcategoryId: string;
  inventoryItemId: string;
  issueQuantity: number;
  remarks: string;
}

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Inventory Issue / Multi-Tool Checkout Management
          </h1>
          <p class="text-sm text-slate-500">
            An employee can take <strong>1 or multiple tools/products</strong> in a single checkout transaction (filter by Category &rarr; Subcategory &rarr; Tool #)
          </p>
        </div>

        <a
          routerLink="/returns"
          class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <span class="material-icons text-base">assignment_return</span>
          <span>Go to Return Management</span>
        </a>
      </div>

      <!-- Multi-Product Employee Checkout Form -->
      <div class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-sm space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">
              Issue Multiple Tools / Products to Employee
            </h2>
            <p class="text-xs text-slate-500">
              Select the employee and add as many tool rows as needed. Duplicates are automatically merged and validated against live Available Stock.
            </p>
          </div>
          <span class="text-xs font-mono-code text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
            Issued By: <strong>{{ auth.currentUser()?.fullName }}</strong>
          </span>
        </div>

        <form (ngSubmit)="submitIssue()" class="space-y-5 text-xs">
          <!-- Employee & Dates Header -->
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Employee *</label>
              <select
                name="employeeId"
                [(ngModel)]="form.employeeId"
                (ngModelChange)="onEmployeeChange()"
                required
                class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
              >
                <option value="" disabled>Select Employee</option>
                <option *ngFor="let e of employees()" [value]="e.id">
                  {{ e.name }} ({{ e.employeeCode }})
                </option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                name="department"
                [(ngModel)]="form.department"
                placeholder="Auto-filled from employee"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Issue Date *</label>
              <input
                type="date"
                name="issueDate"
                [(ngModel)]="form.issueDate"
                required
                class="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Issue Time (IST) *</label>
              <input
                type="time"
                name="issueTime"
                [(ngModel)]="form.issueTime"
                required
                class="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Expected Return Date *</label>
              <input
                type="date"
                name="expectedReturnDate"
                [(ngModel)]="form.expectedReturnDate"
                required
                class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-amber-900"
              />
            </div>
          </div>

          <!-- Multi-Tool Cart Section -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Tools / Products Cart ({{ lineItems.length }} Item Line{{ lineItems.length > 1 ? 's' : '' }} | Total Units: {{ getTotalRequestedUnits() }})
                </span>
              </div>
              <button
                type="button"
                (click)="addLineItem()"
                class="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span class="material-icons text-sm">add_circle</span>
                <span>+ Add Another Tool / Product</span>
              </button>
            </div>

            <div
              *ngFor="let line of lineItems; let idx = index"
              class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs"
            >
              <!-- Optional Category Filter per Row -->
              <div class="md:col-span-2">
                <label class="block text-[11px] font-semibold text-slate-500 mb-1">
                  1. Category (e.g. 10bolt)
                </label>
                <select
                  [name]="'cat_' + idx"
                  [(ngModel)]="line.categoryId"
                  (ngModelChange)="onRowCategoryChange(line)"
                  class="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="">All Categories</option>
                  <option *ngFor="let c of categories()" [value]="c.id">
                    {{ c.name }}
                  </option>
                </select>
              </div>

              <!-- Optional Subcategory Filter per Row -->
              <div class="md:col-span-2">
                <label class="block text-[11px] font-semibold text-slate-500 mb-1">
                  2. Subcategory (e.g. 10-100)
                </label>
                <select
                  [name]="'sub_' + idx"
                  [(ngModel)]="line.subcategoryId"
                  (ngModelChange)="onRowSubcategoryChange(line)"
                  class="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  <option value="">All Subcategories</option>
                  <option *ngFor="let s of getSubcategoriesForRow(line.categoryId)" [value]="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>

              <!-- Tool / Inventory Item Selector -->
              <div class="md:col-span-4">
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  3. Select Tool / Product *
                </label>
                <select
                  [name]="'item_' + idx"
                  [(ngModel)]="line.inventoryItemId"
                  required
                  class="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                >
                  <option value="" disabled>Choose Tool / Item</option>
                  <option
                    *ngFor="let item of getFilteredItemsForRow(line)"
                    [value]="item.id"
                    [disabled]="item.availableStock <= 0"
                  >
                    [{{ item.category?.name }} &rarr; {{ item.subcategory?.name || '-' }} | Tool #{{ item.toolNumber || '-' }}] {{ item.itemName }} (Avail: {{ item.availableStock }})
                  </option>
                </select>
              </div>

              <!-- Live Available Badge -->
              <div class="md:col-span-1">
                <label class="block text-[11px] font-semibold text-slate-500 mb-1 text-center">
                  Avail
                </label>
                <div class="px-2 py-2 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-800 text-center">
                  {{ getAvailableFor(line.inventoryItemId) }}
                </div>
              </div>

              <!-- Issue Qty -->
              <div class="md:col-span-2">
                <label class="block text-[11px] font-semibold text-slate-700 mb-1">
                  Issue Quantity *
                </label>
                <input
                  type="number"
                  [name]="'qty_' + idx"
                  [(ngModel)]="line.issueQuantity"
                  min="1"
                  [max]="getAvailableFor(line.inventoryItemId)"
                  required
                  class="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-bold text-center"
                />
              </div>

              <!-- Remove Line Button -->
              <div class="md:col-span-1 flex justify-end">
                <button
                  *ngIf="lineItems.length > 1"
                  type="button"
                  (click)="removeLineItem(idx)"
                  title="Remove this tool row"
                  class="w-full py-2 px-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div class="md:col-span-2">
              <label class="block font-semibold text-slate-700 mb-1">Purpose / Shift / Remarks</label>
              <input
                type="text"
                name="purposeRemarks"
                [(ngModel)]="form.purposeRemarks"
                placeholder="e.g. Shift A production tooling set"
                class="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">
                Issue Ref No. (Auto if blank)
              </label>
              <input
                type="text"
                name="issueReference"
                [(ngModel)]="form.issueReference"
                placeholder="Auto-generated"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code"
              />
            </div>
            <button
              type="submit"
              class="py-2.5 px-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow cursor-pointer"
            >
              Issue {{ lineItems.length }} Tool(s) to Employee
            </button>
          </div>
        </form>
      </div>

      <!-- Issued Transactions History -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-base font-bold text-slate-900">Issued Tool Transactions Registry</h3>
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="loadIssues()"
            placeholder="Search Issue Ref, Employee, or Tool #..."
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-72"
          />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">Issue Ref</th>
                <th class="py-3 px-4">Employee & Dept</th>
                <th class="py-3 px-4">Issued Tools (Cat &rarr; Sub &rarr; Tool #)</th>
                <th class="py-3 px-4">Issue Date & Time</th>
                <th class="py-3 px-4">Expected Return</th>
                <th class="py-3 px-4">Days Held</th>
                <th class="py-3 px-4">Pending / Issued</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Issued By</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let iss of issues()" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono-code font-bold text-slate-900">
                  {{ iss.issueReference }}
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ iss.employee?.name }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ iss.employee?.employeeCode }} | {{ iss.department }}
                  </div>
                </td>
                <td class="py-3 px-4 space-y-1">
                  <div
                    *ngFor="let ii of iss.items"
                    class="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <span>
                      <strong>{{ ii.inventoryItem?.category?.name }} &rarr; {{ ii.inventoryItem?.subcategory?.name || '-' }}</strong>
                      (Tool #{{ ii.inventoryItem?.toolNumber || '-' }}) - {{ ii.inventoryItem?.itemName }}
                    </span>
                    <span class="font-mono-code font-bold text-slate-900">
                      Qty: {{ ii.issuedQuantity }} (Pend: {{ ii.pendingQuantity }})
                    </span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  {{ iss.issueDate | istDate:'date' }} <span class="text-slate-500">{{ iss.issueTime }}</span>
                </td>
                <td class="py-3 px-4 font-semibold">
                  {{ iss.expectedReturnDate | istDate:'date' }}
                </td>
                <td class="py-3 px-4 font-bold">{{ iss.daysHeld }} days</td>
                <td class="py-3 px-4 font-bold">
                  <span class="text-amber-700">{{ iss.totalPendingQty }}</span> / {{ iss.totalIssuedQty }}
                </td>
                <td class="py-3 px-4">
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    [ngClass]="{
                      'bg-red-100 text-red-800 border border-red-300': iss.status === 'OVERDUE',
                      'bg-amber-100 text-amber-800': iss.status === 'PENDING',
                      'bg-blue-100 text-blue-800': iss.status === 'PARTIALLY_RETURNED',
                      'bg-emerald-100 text-emerald-800': iss.status === 'FULLY_RETURNED',
                      'bg-orange-100 text-orange-800': iss.status === 'DAMAGED',
                      'bg-rose-100 text-rose-800': iss.status === 'LOST'
                    }"
                  >
                    {{ iss.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ iss.issuedBy?.fullName }}</td>
              </tr>
              <tr *ngIf="!issues().length">
                <td colspan="9" class="py-8 text-center text-slate-400">
                  No tool issue transactions recorded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class IssuesComponent implements OnInit {
  employees = signal<any[]>([]);
  categories = signal<any[]>([]);
  items = signal<any[]>([]);
  issues = signal<any[]>([]);
  search = '';

  form = {
    employeeId: '',
    department: '',
    issueDate: new Date().toISOString().slice(0, 10),
    issueTime: '09:30',
    expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    purposeRemarks: '',
    issueReference: ''
  };

  lineItems: IssueLineItem[] = [
    {
      categoryId: '',
      subcategoryId: '',
      inventoryItemId: '',
      issueQuantity: 1,
      remarks: ''
    }
  ];

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMaster();
    this.loadIssues();
  }

  loadMaster(): void {
    this.api.get('/employees').subscribe((res) => {
      const emps = res.data || [];
      this.employees.set(emps);
      if (emps.length > 0 && !this.form.employeeId) {
        this.form.employeeId = emps[0].id;
        this.form.department = emps[0].department;
      }
    });

    this.api.get('/categories').subscribe((res) => {
      this.categories.set(res.data || []);
    });

    this.api.get('/inventory').subscribe((res) => {
      const inv = res.data || [];
      this.items.set(inv);
      if (inv.length > 0 && !this.lineItems[0]?.inventoryItemId) {
        this.lineItems[0].inventoryItemId = inv[0].id;
      }
    });
  }

  loadIssues(): void {
    this.api
      .get('/issues', { search: this.search })
      .subscribe((res) => this.issues.set(res.data || []));
  }

  onEmployeeChange(): void {
    const emp = this.employees().find((e) => e.id === this.form.employeeId);
    if (emp) {
      this.form.department = emp.department;
    }
  }

  getSubcategoriesForRow(categoryId: string): any[] {
    if (!categoryId) return [];
    const cat = this.categories().find((c) => c.id === categoryId);
    return cat?.subcategories || [];
  }

  getFilteredItemsForRow(line: IssueLineItem): any[] {
    return this.items().filter((item) => {
      if (line.categoryId && item.categoryId !== line.categoryId) return false;
      if (line.subcategoryId && item.subcategoryId !== line.subcategoryId)
        return false;
      return true;
    });
  }

  onRowCategoryChange(line: IssueLineItem): void {
    line.subcategoryId = '';
    const matching = this.getFilteredItemsForRow(line);
    line.inventoryItemId = matching[0]?.id || '';
  }

  onRowSubcategoryChange(line: IssueLineItem): void {
    const matching = this.getFilteredItemsForRow(line);
    line.inventoryItemId = matching[0]?.id || '';
  }

  getAvailableFor(itemId: string): number {
    const found = this.items().find((i) => i.id === itemId);
    return found ? found.availableStock : 0;
  }

  getTotalRequestedUnits(): number {
    return this.lineItems.reduce(
      (sum, l) => sum + Number(l.issueQuantity || 0),
      0
    );
  }

  addLineItem(): void {
    const first = this.items()[0];
    this.lineItems.push({
      categoryId: '',
      subcategoryId: '',
      inventoryItemId: first?.id || '',
      issueQuantity: 1,
      remarks: ''
    });
  }

  removeLineItem(idx: number): void {
    this.lineItems.splice(idx, 1);
  }

  submitIssue(): void {
    if (!this.form.employeeId) {
      this.notify.error('Please select an employee first');
      return;
    }

    // Consolidate duplicate items in cart if same tool selected twice
    const mergedMap = new Map<
      string,
      { inventoryItemId: string; issueQuantity: number }
    >();
    for (const l of this.lineItems) {
      if (!l.inventoryItemId) {
        this.notify.error('Please select a tool/product for every line');
        return;
      }
      const qty = Number(l.issueQuantity || 0);
      if (qty <= 0) {
        this.notify.error('Issue quantity must be at least 1');
        return;
      }
      const existing = mergedMap.get(l.inventoryItemId);
      if (existing) {
        existing.issueQuantity += qty;
      } else {
        mergedMap.set(l.inventoryItemId, {
          inventoryItemId: l.inventoryItemId,
          issueQuantity: qty
        });
      }
    }

    const payload = {
      ...this.form,
      items: Array.from(mergedMap.values())
    };

    this.api.post('/issues', payload).subscribe({
      next: () => {
        this.notify.success(
          `Successfully issued ${mergedMap.size} tool type(s) to employee!`
        );
        this.form.purposeRemarks = '';
        this.form.issueReference = '';
        const first = this.items()[0];
        this.lineItems = [
          {
            categoryId: '',
            subcategoryId: '',
            inventoryItemId: first?.id || '',
            issueQuantity: 1,
            remarks: ''
          }
        ];
        this.loadMaster();
        this.loadIssues();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to issue tools')
    });
  }
}
