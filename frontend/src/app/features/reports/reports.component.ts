import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Reports & Analytics Center (Excel & PDF Export)
          </h1>
          <p class="text-sm text-slate-500">
            Generate, filter, and download all 12 industrial inventory reports in Excel (.xlsx) and PDF (.pdf)
          </p>
        </div>

        <div class="flex gap-2">
          <button
            (click)="downloadReport('excel')"
            class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <span class="material-icons text-base">table_view</span>
            <span>Download Excel (.xlsx)</span>
          </button>
          <button
            (click)="downloadReport('pdf')"
            class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <span class="material-icons text-base">picture_as_pdf</span>
            <span>Download PDF (.pdf)</span>
          </button>
        </div>
      </div>

      <!-- 12 Report Selector Pills -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
        <button
          *ngFor="let r of reportCatalog"
          (click)="selectReport(r.key)"
          class="p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between"
          [ngClass]="
            selectedReportKey() === r.key
              ? 'bg-slate-900 text-white border-slate-900 font-bold shadow'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
          "
        >
          <span>{{ r.label }}</span>
          <span class="material-icons text-base opacity-70">chevron_right</span>
        </button>
      </div>

      <!-- Date Range & Search Filter Bar -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4 text-xs">
        <div class="flex-1 min-w-[220px]">
          <label class="block font-semibold text-slate-600 mb-1">Search Within Report</label>
          <input
            type="text"
            [(ngModel)]="filters.search"
            (ngModelChange)="loadReport()"
            placeholder="Filter by Category (10bolt), Subcategory (10-100), Tool #, Employee, SKU..."
            class="w-full px-3.5 py-2 rounded-lg border border-slate-300"
          />
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            [(ngModel)]="filters.startDate"
            (ngModelChange)="loadReport()"
            class="px-3 py-2 rounded-lg border border-slate-300"
          />
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            [(ngModel)]="filters.endDate"
            (ngModelChange)="loadReport()"
            class="px-3 py-2 rounded-lg border border-slate-300"
          />
        </div>
        <button
          (click)="clearFilters()"
          class="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
        >
          Reset Filters
        </button>
      </div>

      <!-- Report Data Preview Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-slate-900">{{ reportData()?.title }}</h2>
            <p class="text-xs text-slate-500">
              Generated (IST): {{ reportData()?.generatedAtIST }} | Total Rows:
              <strong>{{ reportData()?.totalRecords || 0 }}</strong>
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th *ngFor="let col of reportData()?.columns" class="py-3 px-4">
                  {{ col.header }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let row of reportData()?.rows" class="hover:bg-slate-50">
                <td *ngFor="let col of reportData()?.columns" class="py-2.5 px-4 text-slate-800">
                  {{ row[col.key] }}
                </td>
              </tr>
              <tr *ngIf="!reportData()?.rows?.length">
                <td
                  [attr.colspan]="reportData()?.columns?.length || 1"
                  class="py-8 text-center text-slate-400"
                >
                  No records match the current report filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ReportsComponent implements OnInit {
  reportCatalog = [
    { key: 'current-stock', label: '1. Current Stock Report' },
    { key: 'available-stock', label: '2. Available Stock Report' },
    { key: 'issued-stock', label: '3. Issued Stock Report' },
    { key: 'employee-wise', label: '4. Employee-wise Inventory Report' },
    { key: 'pending-returns', label: '5. Pending Return Report' },
    { key: 'overdue-returns', label: '6. Overdue Return Report' },
    { key: 'damaged-lost', label: '7. Damaged & Lost Items Report' },
    { key: 'stock-in', label: '8. Stock In Report' },
    { key: 'stock-out', label: '9. Stock Out Report' },
    { key: 'category-wise', label: '10. Category-wise Stock Report' },
    { key: 'machine-wise', label: '11. Machine-wise Tools Report' },
    { key: 'monthly-transactions', label: '12. Monthly Transactions Report' }
  ];

  selectedReportKey = signal('current-stock');
  reportData = signal<any | null>(null);

  filters = {
    search: '',
    startDate: '',
    endDate: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  selectReport(key: string): void {
    this.selectedReportKey.set(key);
    this.loadReport();
  }

  clearFilters(): void {
    this.filters = { search: '', startDate: '', endDate: '' };
    this.loadReport();
  }

  loadReport(): void {
    this.api
      .get(`/reports/${this.selectedReportKey()}`, {
        ...this.filters,
        format: 'json'
      })
      .subscribe({
        next: (res) => this.reportData.set(res.data)
      });
  }

  downloadReport(format: 'excel' | 'pdf'): void {
    const key = this.selectedReportKey();
    this.api
      .downloadBlob(`/reports/${key}`, {
        ...this.filters,
        format
      })
      .subscribe({
        next: (blob) => {
          const ext = format === 'excel' ? 'xlsx' : 'pdf';
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${key}-report.${ext}`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.notify.success(`Downloaded ${key}-report.${ext}`);
        },
        error: () => this.notify.error('Failed to export report')
      });
  }
}
