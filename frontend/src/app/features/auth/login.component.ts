import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <!-- Header -->
        <div class="bg-slate-800 px-8 py-6 text-white border-b border-slate-700">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-xl shadow">
              <span class="material-icons">precision_manufacturing</span>
            </div>
            <div>
              <h1 class="text-lg font-bold tracking-tight">INDUS-STOCK PRO</h1>
              <p class="text-xs text-slate-300">Industrial Inventory & Tooling Control System</p>
            </div>
          </div>
        </div>

        <form (ngSubmit)="onSubmit()" class="p-8 space-y-5">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              name="usernameOrEmail"
              [(ngModel)]="usernameOrEmail"
              required
              placeholder="Enter username (e.g. superadmin)"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            [disabled]="loading()"
            class="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg shadow transition flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <span class="material-icons text-base" *ngIf="!loading()">login</span>
            <span>{{ loading() ? 'Authenticating...' : 'Sign In to Plant Console' }}</span>
          </button>

          <!-- Role Quick-Login Buttons for Instant Testing -->
          <div class="pt-4 border-t border-slate-200">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Quick Role Demo Accounts (Password: Admin&#64;123)
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="quickFill('superadmin')"
                class="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-left transition cursor-pointer"
              >
                <div class="font-bold text-slate-900">Super Admin</div>
                <div class="text-[11px] text-slate-500">Full System & RBAC</div>
              </button>
              <button
                type="button"
                (click)="quickFill('admin')"
                class="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-left transition cursor-pointer"
              >
                <div class="font-bold text-slate-900">Plant Admin</div>
                <div class="text-[11px] text-slate-500">Machines, Stock & Reports</div>
              </button>
              <button
                type="button"
                (click)="quickFill('storemanager')"
                class="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-left transition cursor-pointer"
              >
                <div class="font-bold text-slate-900">Store Manager</div>
                <div class="text-[11px] text-slate-500">Stock In/Out, Issue & Return</div>
              </button>
              <button
                type="button"
                (click)="quickFill('employee')"
                class="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 text-left transition cursor-pointer"
              >
                <div class="font-bold text-slate-900">Employee Portal</div>
                <div class="text-[11px] text-slate-500">Own Issued Tools & Returns</div>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  usernameOrEmail = 'superadmin';
  password = 'Admin@123';
  loading = signal(false);

  constructor(
    private auth: AuthService,
    private notify: NotificationService,
    private router: Router
  ) {}

  quickFill(username: string): void {
    this.usernameOrEmail = username;
    this.password = 'Admin@123';
    this.onSubmit();
  }

  onSubmit(): void {
    if (!this.usernameOrEmail || !this.password) return;
    this.loading.set(true);
    this.auth.login(this.usernameOrEmail, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.notify.success('Signed in successfully');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error(err.error?.message || 'Login failed');
      }
    });
  }
}
