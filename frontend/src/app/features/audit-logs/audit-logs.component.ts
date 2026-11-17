import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          Stock History & Immutable Audit Logs
        </h1>
        <p class="text-sm text-slate-500">
          Complete immutable audit trail recording who added stock, edited inventory, issued tools, received returns, and adjusted quantities (Asia/Kolkata IST)
        </p>
      </div>

      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 text-xs">
        <input
          type="text"
          [(ngModel)]="filters.search"
          (ngModelChange)="loadLogs()"
          placeholder="Search action, description, transaction reference, or user..."
          class="flex-1 min-w-[260px] px-3.5 py-2 rounded-lg border border-slate-300"
        />
        <input
          type="date"
          [(ngModel)]="filters.startDate"
          (ngModelChange)="loadLogs()"
          class="px-3 py-2 rounded-lg border border-slate-300"
        />
        <input
          type="date"
          [(ngModel)]="filters.endDate"
          (ngModelChange)="loadLogs()"
          class="px-3 py-2 rounded-lg border border-slate-300"
        />
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">Timestamp (IST)</th>
                <th class="py-3 px-4">Action</th>
                <th class="py-3 px-4">Entity</th>
                <th class="py-3 px-4">Tx Reference</th>
                <th class="py-3 px-4">Previous &rarr; Updated Qty</th>
                <th class="py-3 px-4">Audit Description</th>
                <th class="py-3 px-4">Performed By (User & Role)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let log of logs()" class="hover:bg-slate-50">
                <td class="py-2.5 px-4 font-mono-code text-slate-600">
                  {{ log.createdAt | istDate }}
                </td>
                <td class="py-2.5 px-4">
                  <span class="px-2 py-0.5 rounded bg-slate-100 font-mono-code font-bold text-slate-800">
                    {{ log.action }}
                  </span>
                </td>
                <td class="py-2.5 px-4 text-slate-600 font-semibold">
                  {{ log.entityType }}
                </td>
                <td class="py-2.5 px-4 font-mono-code font-bold text-amber-800">
                  {{ log.transactionReference || '-' }}
                </td>
                <td class="py-2.5 px-4 font-mono-code">
                  <span *ngIf="log.previousQuantity !== null || log.updatedQuantity !== null">
                    {{ log.previousQuantity ?? '-' }} &rarr;
                    <strong class="text-slate-900">{{ log.updatedQuantity ?? '-' }}</strong>
                  </span>
                  <span *ngIf="log.previousQuantity === null && log.updatedQuantity === null">-</span>
                </td>
                <td class="py-2.5 px-4 text-slate-800 font-medium">
                  {{ log.description }}
                </td>
                <td class="py-2.5 px-4">
                  <div class="font-bold text-slate-900">{{ log.user?.fullName }}</div>
                  <div class="text-[10px] font-mono-code text-slate-500">
                    {{ log.user?.username }} ({{ log.user?.role?.name }})
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AuditLogsComponent implements OnInit {
  logs = signal<any[]>([]);
  filters = {
    search: '',
    startDate: '',
    endDate: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.api
      .get('/audit-logs', this.filters)
      .subscribe((res) => this.logs.set(res.data || []));
  }
}
