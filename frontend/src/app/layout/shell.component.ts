import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterModule,
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';
import { AuthService } from '../core/auth.service';
import { NotificationService } from '../core/notification.service';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex bg-slate-100 text-slate-900">
      <!-- Industrial Sidebar -->
      <aside class="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 border-r border-slate-800">
        <div class="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950">
          <div class="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
            <span class="material-icons text-xl">precision_manufacturing</span>
          </div>
          <div>
            <div class="font-bold text-white text-sm tracking-wide">INDUS-STOCK</div>
            <div class="text-[11px] text-amber-400 font-mono-code">IST (Asia/Kolkata)</div>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1 text-sm">
          <a
            routerLink="/dashboard"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">dashboard</span>
            <span>Admin Dashboard</span>
          </a>

          <div class="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Master Hierarchy
          </div>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
            routerLink="/machines"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">settings_suggest</span>
            <span>Machines & Tools</span>
          </a>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
            routerLink="/categories"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">account_tree</span>
            <span>Categories (10bolt Flow)</span>
          </a>

          <a
            routerLink="/inventory"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">inventory_2</span>
            <span>Inventory Master</span>
          </a>

          <div class="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Stock & Floor Operations
          </div>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
            routerLink="/stock-ops"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">sync_alt</span>
            <span>Stock In / Out / Adjust</span>
          </a>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
            routerLink="/issues"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">outbox</span>
            <span>Issue / Checkout Tools</span>
          </a>

          <a
            routerLink="/returns"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <div class="flex items-center gap-3">
              <span class="material-icons text-lg">assignment_return</span>
              <span>Return Management</span>
            </div>
            <span
              *ngIf="overdueCount() > 0"
              class="px-1.5 py-0.5 text-[11px] font-bold rounded bg-red-600 text-white"
            >
              {{ overdueCount() }}
            </span>
          </a>

          <a
            routerLink="/employees"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">badge</span>
            <span>Employees & Tracking</span>
          </a>

          <div class="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Governance & Analytics
          </div>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
            routerLink="/reports"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">summarize</span>
            <span>Reports & Exports (12)</span>
          </a>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
            routerLink="/audit-logs"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">policy</span>
            <span>Stock Audit Trail</span>
          </a>

          <a
            *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
            routerLink="/users"
            routerLinkActive="bg-amber-500 text-slate-950 font-semibold"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            <span class="material-icons text-lg">admin_panel_settings</span>
            <span>Users & Permissions</span>
          </a>
        </nav>

        <div class="p-4 border-t border-slate-800 bg-slate-950">
          <div class="flex items-center justify-between">
            <div class="truncate">
              <div class="text-xs font-bold text-white truncate">
                {{ auth.currentUser()?.fullName }}
              </div>
              <div class="text-[11px] text-amber-400 font-mono-code">
                {{ auth.currentUser()?.role }}
              </div>
            </div>
            <button
              (click)="auth.logout()"
              title="Sign Out"
              class="p-2 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white transition cursor-pointer"
            >
              <span class="material-icons text-base">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top Header Bar -->
        <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div class="flex items-center gap-3">
            <span class="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              Hierarchy: Machine &rarr; Category (10bolt) &rarr; Subcategory (10-100) &rarr; Tools (21, 34, 70)
            </span>
          </div>

          <div class="flex items-center gap-4">
            <a
              routerLink="/returns"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
              [ngClass]="
                overdueCount() > 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              "
            >
              <span class="material-icons text-base">notifications_active</span>
              <span>Overdue Returns: {{ overdueCount() }}</span>
            </a>

            <a
              routerLink="/inventory"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
              [ngClass]="
                lowStockCount() > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              "
            >
              <span class="material-icons text-base">warning_amber</span>
              <span>Low Stock: {{ lowStockCount() }}</span>
            </a>
          </div>
        </header>

        <!-- Toast Notifications -->
        <div class="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          <div
            *ngFor="let t of notify.toasts()"
            class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium"
            [ngClass]="{
              'bg-emerald-900 text-white border-emerald-700': t.type === 'success',
              'bg-red-900 text-white border-red-700': t.type === 'error',
              'bg-slate-900 text-white border-slate-700': t.type === 'info'
            }"
          >
            <span>{{ t.text }}</span>
            <button (click)="notify.dismiss(t.id)" class="text-xs opacity-75 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <main class="flex-1 p-6 overflow-x-hidden">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class ShellComponent implements OnInit {
  overdueCount = signal(0);
  lowStockCount = signal(0);

  constructor(
    public auth: AuthService,
    public notify: NotificationService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.api.get('/dashboard/summary').subscribe({
      next: (res) => {
        if (res?.data?.cards) {
          this.overdueCount.set(res.data.cards.overdueReturns || 0);
          this.lowStockCount.set(res.data.cards.lowStockAlertsCount || 0);
        }
      }
    });
  }
}
