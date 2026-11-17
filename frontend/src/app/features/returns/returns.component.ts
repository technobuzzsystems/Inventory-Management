import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Return Management</h1>
          <p class="text-sm text-slate-500">
            Process Full Returns, Partial Returns, Damaged or Lost items. Automatically calculates Pending Quantity & Days Held.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            (click)="overdueOnly.set(false); loadPendingItems()"
            class="px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
            [ngClass]="
              !overdueOnly()
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700'
            "
          >
            All Pending Returns ({{ pendingItems().length }})
          </button>
          <button
            (click)="overdueOnly.set(true); loadPendingItems()"
            class="px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer"
            [ngClass]="
              overdueOnly()
                ? 'bg-red-600 text-white'
                : 'bg-red-50 border border-red-200 text-red-700'
            "
          >
            Overdue Only
          </button>
        </div>
      </div>

      <!-- Return Processing Modal / Card -->
      <div
        *ngIf="selectedIssueItem()"
        class="bg-white p-6 rounded-xl border-2 border-emerald-500 shadow-xl space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">
              Record Tool Return: {{ selectedIssueItem()?.inventoryItem?.itemName }}
            </h2>
            <p class="text-xs text-slate-500">
              Issue Ref: <strong class="font-mono-code">{{ selectedIssueItem()?.issue?.issueReference }}</strong> |
              Employee: <strong>{{ selectedIssueItem()?.issue?.employee?.name }}</strong> |
              Pending Quantity: <strong class="text-amber-700">{{ selectedIssueItem()?.pendingQuantity }}</strong>
            </p>
          </div>
          <button (click)="selectedIssueItem.set(null)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="submitReturn()" class="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">
              Returned Quantity (Max: {{ selectedIssueItem()?.pendingQuantity }}) *
            </label>
            <input
              type="number"
              name="returnedQuantity"
              [(ngModel)]="returnForm.returnedQuantity"
              min="1"
              [max]="selectedIssueItem()?.pendingQuantity"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Item Condition *</label>
            <select
              name="condition"
              [(ngModel)]="returnForm.condition"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            >
              <option value="GOOD">GOOD (Restores Available Stock)</option>
              <option value="DAMAGED">DAMAGED (No Avail Stock Increase)</option>
              <option value="LOST">LOST (No Avail Stock Increase)</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Actual Return Date *</label>
            <input
              type="date"
              name="returnDate"
              [(ngModel)]="returnForm.returnDate"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Actual Return Time *</label>
            <input
              type="time"
              name="returnTime"
              [(ngModel)]="returnForm.returnTime"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Inspection Remarks</label>
            <input
              type="text"
              name="remarks"
              [(ngModel)]="returnForm.remarks"
              placeholder="Wear level, chip condition..."
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="md:col-span-5 flex items-center justify-between pt-2">
            <div class="text-xs text-slate-600">
              <span *ngIf="returnForm.condition !== 'GOOD'" class="text-red-700 font-semibold">
                Note: {{ returnForm.condition }} items are tracked separately and will NOT be added back to Available Stock.
              </span>
              <span *ngIf="returnForm.condition === 'GOOD'" class="text-emerald-700 font-semibold">
                Note: GOOD return will immediately increase Available Stock by {{ returnForm.returnedQuantity }}.
              </span>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="selectedIssueItem.set(null)"
                class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                Confirm & Record Return
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Active Issued Items Pending Return -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-base font-bold text-slate-900">
            Currently Issued Items Pending Return
          </h3>
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="loadPendingItems()"
            placeholder="Search Employee, Issue Ref, or Tool #..."
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs w-72"
          />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">Issue Ref</th>
                <th class="py-3 px-4">Employee</th>
                <th class="py-3 px-4">Category &rarr; Sub &rarr; Tool #</th>
                <th class="py-3 px-4 text-center">Issued Qty</th>
                <th class="py-3 px-4 text-center">Accepted Returned</th>
                <th class="py-3 px-4 text-center">Pending Qty</th>
                <th class="py-3 px-4">Issue Date</th>
                <th class="py-3 px-4">Expected Return</th>
                <th class="py-3 px-4">Days Held</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr
                *ngFor="let ii of pendingItems()"
                [ngClass]="ii.isOverdue ? 'bg-red-50/40 hover:bg-red-50/80' : 'hover:bg-slate-50'"
              >
                <td class="py-3 px-4 font-mono-code font-bold">{{ ii.issue?.issueReference }}</td>
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ ii.issue?.employee?.name }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ ii.issue?.employee?.employeeCode }} | {{ ii.issue?.department }}
                  </div>
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ ii.inventoryItem?.itemName }}</div>
                  <div class="text-[11px] text-slate-600 font-mono-code">
                    {{ ii.inventoryItem?.category?.name }} &rarr; {{ ii.inventoryItem?.subcategory?.name || '-' }} | Tool #{{ ii.inventoryItem?.toolNumber || '-' }}
                  </div>
                </td>
                <td class="py-3 px-4 text-center font-bold">{{ ii.issuedQuantity }}</td>
                <td class="py-3 px-4 text-center font-semibold text-emerald-700">
                  {{ ii.acceptedReturnedQuantity }}
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold">
                    {{ ii.pendingQuantity }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ ii.issue?.issueDate | istDate:'date' }}</td>
                <td class="py-3 px-4 font-semibold" [ngClass]="ii.isOverdue ? 'text-red-700' : 'text-slate-700'">
                  {{ ii.issue?.expectedReturnDate | istDate:'date' }}
                </td>
                <td class="py-3 px-4 font-bold" [ngClass]="ii.isOverdue ? 'text-red-800' : 'text-slate-800'">
                  {{ ii.daysHeld }} days
                </td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    [ngClass]="{
                      'bg-red-100 text-red-800 border border-red-300': ii.effectiveStatus === 'OVERDUE',
                      'bg-amber-100 text-amber-800': ii.effectiveStatus === 'PENDING',
                      'bg-blue-100 text-blue-800': ii.effectiveStatus === 'PARTIALLY_RETURNED'
                    }"
                  >
                    {{ ii.effectiveStatus }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
                    (click)="openReturnModal(ii)"
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Receive Return
                  </button>
                </td>
              </tr>
              <tr *ngIf="!pendingItems().length">
                <td colspan="11" class="py-8 text-center text-slate-400">
                  No pending tool returns match the current filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Complete Return History Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-base font-bold text-slate-900">Complete Return History</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 text-slate-700 uppercase">
                <th class="py-2.5 px-4">Return Ref</th>
                <th class="py-2.5 px-4">Issue Ref</th>
                <th class="py-2.5 px-4">Employee</th>
                <th class="py-2.5 px-4">Returned Items & Condition</th>
                <th class="py-2.5 px-4">Return Date & Time</th>
                <th class="py-2.5 px-4">Received By</th>
                <th class="py-2.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let ret of returnHistory()">
                <td class="py-2.5 px-4 font-mono-code font-bold">{{ ret.returnReference }}</td>
                <td class="py-2.5 px-4 font-mono-code">{{ ret.issue?.issueReference }}</td>
                <td class="py-2.5 px-4 font-semibold">{{ ret.employee?.name }}</td>
                <td class="py-2.5 px-4 space-y-1">
                  <div *ngFor="let ri of ret.items" class="flex items-center gap-2">
                    <span class="font-semibold">{{ ri.inventoryItem?.itemName }}</span>
                    <span class="font-mono-code font-bold">Qty: {{ ri.returnedQuantity }}</span>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800': ri.condition === 'GOOD',
                        'bg-orange-100 text-orange-800': ri.condition === 'DAMAGED',
                        'bg-rose-100 text-rose-800': ri.condition === 'LOST'
                      }"
                    >
                      {{ ri.condition }}
                    </span>
                  </div>
                </td>
                <td class="py-2.5 px-4">
                  {{ ret.returnDate | istDate:'date' }} {{ ret.returnTime }}
                </td>
                <td class="py-2.5 px-4">{{ ret.receivedBy?.fullName }}</td>
                <td class="py-2.5 px-4 text-slate-500">{{ ret.remarks || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ReturnsComponent implements OnInit {
  pendingItems = signal<any[]>([]);
  returnHistory = signal<any[]>([]);
  overdueOnly = signal(false);
  search = '';

  selectedIssueItem = signal<any | null>(null);
  returnForm = {
    returnedQuantity: 1,
    condition: 'GOOD',
    returnDate: new Date().toISOString().slice(0, 10),
    returnTime: '17:00',
    remarks: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPendingItems();
    this.loadReturnHistory();
  }

  loadPendingItems(): void {
    this.api
      .get('/returns/pending-items', {
        overdueOnly: this.overdueOnly() ? 'true' : '',
        search: this.search
      })
      .subscribe((res) => this.pendingItems.set(res.data || []));
  }

  loadReturnHistory(): void {
    this.api
      .get('/returns')
      .subscribe((res) => this.returnHistory.set(res.data || []));
  }

  openReturnModal(issueItem: any): void {
    this.selectedIssueItem.set(issueItem);
    this.returnForm = {
      returnedQuantity: issueItem.pendingQuantity,
      condition: 'GOOD',
      returnDate: new Date().toISOString().slice(0, 10),
      returnTime: '17:00',
      remarks: ''
    };
  }

  submitReturn(): void {
    const ii = this.selectedIssueItem();
    if (!ii) return;

    const payload = {
      issueId: ii.issueId,
      returnDate: this.returnForm.returnDate,
      returnTime: this.returnForm.returnTime,
      remarks: this.returnForm.remarks,
      items: [
        {
          issueItemId: ii.id,
          returnedQuantity: Number(this.returnForm.returnedQuantity),
          condition: this.returnForm.condition,
          remarks: this.returnForm.remarks
        }
      ]
    };

    this.api.post('/returns', payload).subscribe({
      next: () => {
        this.notify.success('Return processed and stock quantities updated!');
        this.selectedIssueItem.set(null);
        this.loadPendingItems();
        this.loadReturnHistory();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to record return')
    });
  }
}
