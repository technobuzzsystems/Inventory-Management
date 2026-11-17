import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  signal,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Industrial Inventory & Stock Command Center
          </h1>
          <p class="text-sm text-slate-500">
            Live stock metrics, tool checkout tracking, overdue alerts, and monthly stock analytics (Asia/Kolkata IST)
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a
            routerLink="/categories"
            class="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span class="material-icons text-base">account_tree</span>
            <span>Manage 10bolt Hierarchy</span>
          </a>
          <a
            routerLink="/issues"
            class="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span class="material-icons text-base">outbox</span>
            <span>Issue Tools to Employee</span>
          </a>
          <button
            (click)="loadDashboard()"
            class="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span class="material-icons text-base">refresh</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <!-- 10 KPI Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Total Inventory Items</span>
            <span class="material-icons text-slate-400 text-lg">inventory_2</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-slate-900">
            {{ data()?.cards?.totalInventoryItems ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">Active SKU / Tool definitions</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Total Machines</span>
            <span class="material-icons text-blue-500 text-lg">precision_manufacturing</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-slate-900">
            {{ data()?.cards?.totalMachines ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">Active shop-floor machines</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Total Stock Qty</span>
            <span class="material-icons text-indigo-500 text-lg">layers</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-slate-900">
            {{ data()?.cards?.totalStockQuantity ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">Aggregate plant inventory</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <div class="flex items-center justify-between text-xs font-semibold text-emerald-700 uppercase">
            <span>Available Stock</span>
            <span class="material-icons text-emerald-600 text-lg">check_circle</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-emerald-700">
            {{ data()?.cards?.availableStock ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-emerald-600">Ready for immediate issue</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div class="flex items-center justify-between text-xs font-semibold text-amber-800 uppercase">
            <span>Issued Stock</span>
            <span class="material-icons text-amber-600 text-lg">outbox</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-amber-800">
            {{ data()?.cards?.issuedStock ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-amber-700">Currently with employees</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
            <span>Pending Returns</span>
            <span class="material-icons text-blue-600 text-lg">schedule</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-slate-900">
            {{ data()?.cards?.pendingReturns ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">
            {{ data()?.cards?.pendingReturnsQuantity ?? 0 }} total units pending
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-red-300 shadow-sm bg-red-50/50">
          <div class="flex items-center justify-between text-xs font-semibold text-red-700 uppercase">
            <span>Overdue Returns</span>
            <span class="material-icons text-red-600 text-lg">notification_important</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-red-700">
            {{ data()?.cards?.overdueReturns ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-red-600 font-medium">
            {{ data()?.cards?.overdueReturnsQuantity ?? 0 }} units past expected date
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-orange-700 uppercase">
            <span>Damaged Items</span>
            <span class="material-icons text-orange-500 text-lg">build_circle</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-orange-700">
            {{ data()?.cards?.damagedItems ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">Excluded from available stock</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-rose-700 uppercase">
            <span>Lost Items</span>
            <span class="material-icons text-rose-500 text-lg">report_off</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-rose-700">
            {{ data()?.cards?.lostItems ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">Excluded from available stock</div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-amber-300 shadow-sm">
          <div class="flex items-center justify-between text-xs font-semibold text-amber-800 uppercase">
            <span>Low Stock Alerts</span>
            <span class="material-icons text-amber-600 text-lg">warning</span>
          </div>
          <div class="mt-2 text-2xl font-bold text-amber-700">
            {{ data()?.cards?.lowStockAlertsCount ?? 0 }}
          </div>
          <div class="mt-1 text-xs text-slate-500">At or below minimum level</div>
        </div>
      </div>

      <!-- Analytics Chart & Overdue Returns Highlight Panel -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-bold text-slate-900">
                Monthly Stock In / Stock Out & Returns Analytics
              </h2>
              <p class="text-xs text-slate-500">12-month movement volume across all categories & tools</p>
            </div>
          </div>
          <div class="h-72 relative">
            <canvas #analyticsCanvas></canvas>
          </div>
        </div>

        <!-- Low Stock Alerts Panel -->
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span class="material-icons text-amber-500 text-lg">warning_amber</span>
              <span>Low Stock Alerts</span>
            </h2>
            <a routerLink="/stock-ops" class="text-xs font-semibold text-blue-600 hover:underline">
              + Stock In
            </a>
          </div>
          <div class="flex-1 overflow-y-auto space-y-2.5 max-h-72">
            <div
              *ngFor="let item of data()?.lowStockAlerts"
              class="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-2"
            >
              <div>
                <div class="text-xs font-bold text-slate-900">
                  {{ item.itemName }}
                </div>
                <div class="text-[11px] text-slate-600 font-mono-code">
                  {{ item.category?.name }} &rarr; {{ item.subcategory?.name || '-' }} | Tool #{{ item.toolNumber || '-' }}
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs font-bold text-red-700">
                  Avail: {{ item.availableStock }} {{ item.unitOfMeasurement }}
                </div>
                <div class="text-[10px] text-slate-500">
                  Min: {{ item.minimumStockLevel }}
                </div>
              </div>
            </div>
            <div
              *ngIf="!data()?.lowStockAlerts?.length"
              class="py-10 text-center text-xs text-slate-400"
            >
              All inventory items are above minimum stock levels.
            </div>
          </div>
        </div>
      </div>

      <!-- Highlighted Overdue Returns Table -->
      <div class="bg-white rounded-xl border border-red-300 shadow-sm overflow-hidden">
        <div class="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-icons text-red-600">error</span>
            <div>
              <h2 class="text-sm font-bold text-red-900">
                Overdue Tool Returns Requiring Immediate Action
              </h2>
              <p class="text-xs text-red-700">
                Automatically highlighted items kept past their expected return date
              </p>
            </div>
          </div>
          <a
            routerLink="/returns"
            class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
          >
            Process Returns
          </a>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                <th class="py-3 px-4">Issue Ref</th>
                <th class="py-3 px-4">Employee</th>
                <th class="py-3 px-4">Department</th>
                <th class="py-3 px-4">Hierarchy / Tool</th>
                <th class="py-3 px-4">Pending Qty</th>
                <th class="py-3 px-4">Issue Date</th>
                <th class="py-3 px-4">Expected Return</th>
                <th class="py-3 px-4">Days Held</th>
                <th class="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr
                *ngFor="let ov of data()?.overdueReturnsList"
                class="bg-red-50/30 hover:bg-red-50/70 transition"
              >
                <td class="py-3 px-4 font-mono-code font-semibold text-slate-900">
                  {{ ov.issueReference }}
                </td>
                <td class="py-3 px-4 font-medium text-slate-900">
                  {{ ov.employee?.name }}
                  <span class="block text-[10px] text-slate-500 font-mono-code">
                    {{ ov.employee?.employeeCode }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ ov.department }}</td>
                <td class="py-3 px-4">
                  <span class="font-semibold text-slate-900">{{ ov.inventoryItem?.itemName }}</span>
                  <span class="block text-[11px] text-slate-500">
                    {{ ov.inventoryItem?.category?.name }} &rarr; {{ ov.inventoryItem?.subcategory?.name || '-' }} (Tool #{{ ov.inventoryItem?.toolNumber || '-' }})
                  </span>
                </td>
                <td class="py-3 px-4 font-bold text-red-700">
                  {{ ov.pendingQuantity }} / {{ ov.issuedQuantity }}
                </td>
                <td class="py-3 px-4 text-slate-600">{{ ov.issueDate | istDate:'date' }}</td>
                <td class="py-3 px-4 font-semibold text-red-700">
                  {{ ov.expectedReturnDate | istDate:'date' }}
                </td>
                <td class="py-3 px-4 font-bold text-red-800">{{ ov.daysHeld }} days</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                    OVERDUE
                  </span>
                </td>
              </tr>
              <tr *ngIf="!data()?.overdueReturnsList?.length">
                <td colspan="9" class="py-6 text-center text-slate-400">
                  No overdue returns currently. All issued tools are within expected return dates.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Inventory Transactions -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">Recent Inventory Transactions</h2>
          <a routerLink="/audit-logs" class="text-xs font-semibold text-blue-600 hover:underline">
            View Full Audit Trail &rarr;
          </a>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase">
                <th class="py-3 px-4">Tx Ref</th>
                <th class="py-3 px-4">Type</th>
                <th class="py-3 px-4">Category / Subcategory / Tool</th>
                <th class="py-3 px-4">Qty</th>
                <th class="py-3 px-4">Avail Stock Change</th>
                <th class="py-3 px-4">Employee / Supplier</th>
                <th class="py-3 px-4">By User</th>
                <th class="py-3 px-4">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let tx of data()?.recentTransactions" class="hover:bg-slate-50">
                <td class="py-3 px-4 font-mono-code font-medium text-slate-800">
                  {{ tx.transactionRef }}
                </td>
                <td class="py-3 px-4">
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
                <td class="py-3 px-4">
                  <div class="font-semibold text-slate-900">{{ tx.inventoryItem?.itemName }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ tx.inventoryItem?.category?.name }} &rarr; {{ tx.inventoryItem?.subcategory?.name || '-' }} | Tool #{{ tx.inventoryItem?.toolNumber || '-' }}
                  </div>
                </td>
                <td class="py-3 px-4 font-bold text-slate-900">{{ tx.quantity }}</td>
                <td class="py-3 px-4 font-mono-code text-slate-600">
                  {{ tx.previousAvailableStock }} &rarr; <strong class="text-slate-900">{{ tx.newAvailableStock }}</strong>
                </td>
                <td class="py-3 px-4 text-slate-600">
                  {{ tx.employee?.name || tx.supplier?.name || '-' }}
                </td>
                <td class="py-3 px-4 text-slate-600">{{ tx.performedBy?.fullName }}</td>
                <td class="py-3 px-4 text-slate-500">{{ tx.createdAt | istDate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('analyticsCanvas') analyticsCanvas!: ElementRef<HTMLCanvasElement>;
  data = signal<any>(null);
  private chartInstance?: Chart;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    if (this.data()?.monthlyAnalytics) {
      this.renderChart(this.data().monthlyAnalytics);
    }
  }

  loadDashboard(): void {
    this.api.get('/dashboard/summary').subscribe({
      next: (res) => {
        this.data.set(res.data);
        if (this.analyticsCanvas && res.data?.monthlyAnalytics) {
          this.renderChart(res.data.monthlyAnalytics);
        }
      }
    });
  }

  private renderChart(monthly: any[]): void {
    if (!this.analyticsCanvas) return;
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = monthly.map((m) => m.month);
    const stockIn = monthly.map((m) => m.stockIn);
    const stockOut = monthly.map((m) => m.stockOut);
    const returnsIn = monthly.map((m) => m.returnsIn);

    this.chartInstance = new Chart(this.analyticsCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Stock IN (Purchase / Opening)',
            data: stockIn,
            backgroundColor: '#10b981'
          },
          {
            label: 'Stock OUT (Issued / Direct)',
            data: stockOut,
            backgroundColor: '#f59e0b'
          },
          {
            label: 'Accepted Returns IN',
            data: returnsIn,
            backgroundColor: '#3b82f6'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}
