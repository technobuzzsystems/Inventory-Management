import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-stock-ops',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Stock In / Stock Out & Adjustments
          </h1>
          <p class="text-sm text-slate-500">
            Record purchased stock, supplier invoices, direct stock out, and authorized stock adjustments
          </p>
        </div>

        <div class="flex gap-2">
          <button
            (click)="activeTab.set('in')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            [ngClass]="
              activeTab() === 'in'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            + Stock IN (Purchase / Return)
          </button>
          <button
            (click)="activeTab.set('out')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            [ngClass]="
              activeTab() === 'out'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            - Direct Stock OUT
          </button>
          <button
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
            (click)="activeTab.set('adjust')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            [ngClass]="
              activeTab() === 'adjust'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            Authorized Stock Adjustment
          </button>
          <button
            (click)="activeTab.set('suppliers')"
            class="px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            [ngClass]="
              activeTab() === 'suppliers'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            Suppliers ({{ suppliers().length }})
          </button>
        </div>
      </div>

      <!-- TAB 1: STOCK IN -->
      <div
        *ngIf="activeTab() === 'in'"
        class="bg-white p-6 rounded-xl border-2 border-emerald-500 shadow-sm space-y-4"
      >
        <h2 class="text-base font-bold text-emerald-900 border-b border-slate-200 pb-2">
          Record Stock IN (New Purchased Stock or Returned Stock)
        </h2>
        <form (ngSubmit)="submitStockIn()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">
              Select Inventory Item / Tool *
            </label>
            <select
              name="inItemId"
              [(ngModel)]="stockInForm.inventoryItemId"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="" disabled>Select Item (Category &rarr; Subcategory &rarr; Tool #)</option>
              <option *ngFor="let i of items()" [value]="i.id">
                [{{ i.category?.name }} &rarr; {{ i.subcategory?.name || '-' }} | Tool #{{ i.toolNumber || '-' }}] {{ i.itemName }} (Avail: {{ i.availableStock }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Stock IN Type *</label>
            <select
              name="inType"
              [(ngModel)]="stockInForm.transactionType"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="PURCHASE_IN">PURCHASE_IN (New Purchase)</option>
              <option value="RETURN_IN">RETURN_IN (Stock Return)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Supplier</label>
            <select
              name="inSupplier"
              [(ngModel)]="stockInForm.supplierId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">Select Supplier</option>
              <option *ngFor="let s of suppliers()" [value]="s.id">
                {{ s.name }} ({{ s.code }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Quantity to Add *</label>
            <input
              type="number"
              name="inQty"
              [(ngModel)]="stockInForm.quantity"
              min="1"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
            <input
              type="number"
              name="inPrice"
              [(ngModel)]="stockInForm.unitPrice"
              min="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Invoice / Reference No.</label>
            <input
              type="text"
              name="inInvoice"
              [(ngModel)]="stockInForm.invoiceReference"
              placeholder="e.g. INV-2026-108"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Purchase Date</label>
            <input
              type="date"
              name="inDate"
              [(ngModel)]="stockInForm.purchaseDate"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="md:col-span-3">
            <label class="block font-semibold text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              name="inRemarks"
              [(ngModel)]="stockInForm.remarks"
              placeholder="Batch number, quality inspection notes..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="flex items-end justify-end">
            <button
              type="submit"
              class="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              Add Stock IN
            </button>
          </div>
        </form>
      </div>

      <!-- TAB 2: DIRECT STOCK OUT -->
      <div
        *ngIf="activeTab() === 'out'"
        class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-sm space-y-4"
      >
        <h2 class="text-base font-bold text-amber-900 border-b border-slate-200 pb-2">
          Direct Stock OUT (Consumables / Direct Shop-Floor Usage)
        </h2>
        <form (ngSubmit)="submitStockOut()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">
              Select Inventory Item / Tool *
            </label>
            <select
              name="outItemId"
              [(ngModel)]="stockOutForm.inventoryItemId"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="" disabled>Select Item</option>
              <option *ngFor="let i of items()" [value]="i.id">
                [{{ i.category?.name }} &rarr; {{ i.subcategory?.name || '-' }} | Tool #{{ i.toolNumber || '-' }}] {{ i.itemName }} (Avail: {{ i.availableStock }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Employee (Optional)</label>
            <select
              name="outEmpId"
              [(ngModel)]="stockOutForm.employeeId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">General Shop Floor</option>
              <option *ngFor="let e of employees()" [value]="e.id">
                {{ e.name }} ({{ e.employeeCode }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Quantity Out *</label>
            <input
              type="number"
              name="outQty"
              [(ngModel)]="stockOutForm.quantity"
              min="1"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div class="md:col-span-3">
            <label class="block font-semibold text-slate-700 mb-1">Purpose / Remarks *</label>
            <input
              type="text"
              name="outRemarks"
              [(ngModel)]="stockOutForm.remarks"
              required
              placeholder="Reason for direct stock deduction"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="flex items-end justify-end">
            <button
              type="submit"
              class="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
            >
              Record Stock OUT
            </button>
          </div>
        </form>
      </div>

      <!-- TAB 3: AUTHORIZED STOCK ADJUSTMENT -->
      <div
        *ngIf="activeTab() === 'adjust'"
        class="bg-white p-6 rounded-xl border-2 border-slate-800 shadow-sm space-y-4"
      >
        <h2 class="text-base font-bold text-slate-900 border-b border-slate-200 pb-2">
          Authorized Stock Adjustment (Requires Mandatory Audit Reason)
        </h2>
        <form (ngSubmit)="submitAdjustment()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Inventory Item *</label>
            <select
              name="adjItemId"
              [(ngModel)]="adjustForm.inventoryItemId"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="" disabled>Select Item</option>
              <option *ngFor="let i of items()" [value]="i.id">
                [{{ i.category?.name }} &rarr; {{ i.subcategory?.name || '-' }} | Tool #{{ i.toolNumber || '-' }}] {{ i.itemName }} (Avail: {{ i.availableStock }}, Dmg: {{ i.damagedStock }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Adjustment Action *</label>
            <select
              name="adjType"
              [(ngModel)]="adjustForm.adjustmentType"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="ADD">ADD (Increase Available & Total)</option>
              <option value="DEDUCT">DEDUCT (Reduce Available & Total)</option>
              <option value="MARK_DAMAGED">MARK_DAMAGED (Move Avail &rarr; Damaged)</option>
              <option value="MARK_LOST">MARK_LOST (Move Avail &rarr; Lost)</option>
              <option value="RECOVER">RECOVER (Repair Damaged &rarr; Avail)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Quantity *</label>
            <input
              type="number"
              name="adjQty"
              [(ngModel)]="adjustForm.quantity"
              min="1"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div class="md:col-span-3">
            <label class="block font-semibold text-slate-700 mb-1">
              Mandatory Audit Reason *
            </label>
            <input
              type="text"
              name="adjReason"
              [(ngModel)]="adjustForm.reason"
              required
              placeholder="Physical stock audit reconciliation / re-grinding recovery..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="flex items-end justify-end">
            <button
              type="submit"
              class="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
            >
              Authorize Adjustment
            </button>
          </div>
        </form>
      </div>

      <!-- TAB 4: SUPPLIERS -->
      <div
        *ngIf="activeTab() === 'suppliers'"
        class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
      >
        <h2 class="text-base font-bold text-slate-900">Register New Supplier</h2>
        <form (ngSubmit)="saveSupplier()" class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <input
            type="text"
            name="supName"
            [(ngModel)]="supplierForm.name"
            required
            placeholder="Supplier Company Name *"
            class="px-3 py-2 rounded-lg border border-slate-300"
          />
          <input
            type="text"
            name="supPerson"
            [(ngModel)]="supplierForm.contactPerson"
            placeholder="Contact Person"
            class="px-3 py-2 rounded-lg border border-slate-300"
          />
          <input
            type="text"
            name="supPhone"
            [(ngModel)]="supplierForm.phone"
            placeholder="Phone Number"
            class="px-3 py-2 rounded-lg border border-slate-300"
          />
          <button
            type="submit"
            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
          >
            + Save Supplier
          </button>
        </form>
      </div>

      <!-- Complete Stock Transaction Ledger -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-base font-bold text-slate-900">Stock Movement Transactions Ledger</h3>
          <input
            type="text"
            [(ngModel)]="txSearch"
            (ngModelChange)="loadTransactions()"
            placeholder="Filter by Tx Ref, Invoice, Item, or Tool #..."
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-72"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">Tx Ref</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Category &rarr; Sub &rarr; Tool</th>
                <th class="py-3 px-4">Qty</th>
                <th class="py-3 px-4">Avail Before &rarr; After</th>
                <th class="py-3 px-4">Supplier / Employee</th>
                <th class="py-3 px-4">Invoice / Remarks</th>
                <th class="py-3 px-4">By User</th>
                <th class="py-3 px-4">Date & Time (IST)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let tx of transactions()" class="hover:bg-slate-50">
                <td class="py-2.5 px-4 font-mono-code font-bold">{{ tx.transactionRef }}</td>
                <td class="py-2.5 px-4">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                    [ngClass]="{
                      'bg-emerald-100 text-emerald-800': tx.transactionType === 'PURCHASE_IN' || tx.transactionType === 'RETURN_IN' || tx.transactionType === 'OPENING',
                      'bg-amber-100 text-amber-800': tx.transactionType === 'ISSUE_OUT' || tx.transactionType === 'DIRECT_OUT',
                      'bg-red-100 text-red-800': tx.transactionType === 'DAMAGED' || tx.transactionType === 'LOST'
                    }"
                  >
                    {{ tx.transactionType }}
                  </span>
                </td>
                <td class="py-2.5 px-4">
                  <div class="font-bold text-slate-900">{{ tx.inventoryItem?.itemName }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ tx.inventoryItem?.category?.name }} &rarr; {{ tx.inventoryItem?.subcategory?.name || '-' }} | Tool #{{ tx.inventoryItem?.toolNumber || '-' }}
                  </div>
                </td>
                <td class="py-2.5 px-4 font-bold text-slate-900">{{ tx.quantity }}</td>
                <td class="py-2.5 px-4 font-mono-code">
                  {{ tx.previousAvailableStock }} &rarr; <strong>{{ tx.newAvailableStock }}</strong>
                </td>
                <td class="py-2.5 px-4">{{ tx.supplier?.name || tx.employee?.name || '-' }}</td>
                <td class="py-2.5 px-4 text-slate-600">
                  <span *ngIf="tx.invoiceReference" class="font-mono-code font-bold text-slate-800">
                    [{{ tx.invoiceReference }}]
                  </span>
                  {{ tx.remarks || '-' }}
                </td>
                <td class="py-2.5 px-4">{{ tx.performedBy?.fullName }}</td>
                <td class="py-2.5 px-4 text-slate-500">{{ tx.createdAt | istDate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class StockOpsComponent implements OnInit {
  activeTab = signal<'in' | 'out' | 'adjust' | 'suppliers'>('in');
  items = signal<any[]>([]);
  suppliers = signal<any[]>([]);
  employees = signal<any[]>([]);
  transactions = signal<any[]>([]);
  txSearch = '';

  stockInForm = {
    inventoryItemId: '',
    transactionType: 'PURCHASE_IN',
    supplierId: '',
    quantity: 20,
    unitPrice: 350,
    invoiceReference: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    remarks: ''
  };

  stockOutForm = {
    inventoryItemId: '',
    employeeId: '',
    quantity: 1,
    remarks: ''
  };

  adjustForm = {
    inventoryItemId: '',
    adjustmentType: 'ADD',
    quantity: 1,
    reason: ''
  };

  supplierForm = {
    name: '',
    contactPerson: '',
    phone: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMasterData();
    this.loadTransactions();
  }

  loadMasterData(): void {
    this.api.get('/inventory').subscribe((res) => {
      const list = res.data || [];
      this.items.set(list);
      if (list.length > 0 && !this.stockInForm.inventoryItemId) {
        this.stockInForm.inventoryItemId = list[0].id;
        this.stockOutForm.inventoryItemId = list[0].id;
        this.adjustForm.inventoryItemId = list[0].id;
      }
    });
    this.api.get('/stock/suppliers').subscribe((res) => {
      this.suppliers.set(res.data || []);
    });
    this.api.get('/employees').subscribe((res) => {
      this.employees.set(res.data || []);
    });
  }

  loadTransactions(): void {
    this.api
      .get('/stock/transactions', { search: this.txSearch })
      .subscribe((res) => this.transactions.set(res.data || []));
  }

  submitStockIn(): void {
    const payload = {
      ...this.stockInForm,
      supplierId: this.stockInForm.supplierId || null,
      quantity: Number(this.stockInForm.quantity),
      unitPrice: Number(this.stockInForm.unitPrice || 0)
    };
    this.api.post('/stock/in', payload).subscribe({
      next: () => {
        this.notify.success('Stock IN recorded and available stock updated');
        this.loadMasterData();
        this.loadTransactions();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Stock IN failed')
    });
  }

  submitStockOut(): void {
    const payload = {
      ...this.stockOutForm,
      employeeId: this.stockOutForm.employeeId || null,
      quantity: Number(this.stockOutForm.quantity)
    };
    this.api.post('/stock/out', payload).subscribe({
      next: () => {
        this.notify.success('Direct Stock OUT recorded');
        this.loadMasterData();
        this.loadTransactions();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Stock OUT failed')
    });
  }

  submitAdjustment(): void {
    const payload = {
      ...this.adjustForm,
      quantity: Number(this.adjustForm.quantity)
    };
    this.api.post('/stock/adjustments', payload).subscribe({
      next: () => {
        this.notify.success('Authorized stock adjustment completed');
        this.adjustForm.reason = '';
        this.loadMasterData();
        this.loadTransactions();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Stock adjustment failed')
    });
  }

  saveSupplier(): void {
    this.api.post('/stock/suppliers', this.supplierForm).subscribe({
      next: () => {
        this.notify.success('Supplier added');
        this.supplierForm = { name: '', contactPerson: '', phone: '' };
        this.loadMasterData();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to add supplier')
    });
  }
}
