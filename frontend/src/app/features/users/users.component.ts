import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Role-Based Access Control (RBAC) & User Management
          </h1>
          <p class="text-sm text-slate-500">
            Manage Super Admin, Admin, Store Manager, and Employee accounts and backend-enforced permissions
          </p>
        </div>

        <button
          *ngIf="auth.hasRole('SUPER_ADMIN')"
          (click)="showUserForm.set(!showUserForm())"
          class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer"
        >
          + Create System User
        </button>
      </div>

      <!-- Create User Form -->
      <div
        *ngIf="showUserForm()"
        class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-lg space-y-4"
      >
        <h2 class="text-base font-bold text-slate-900">Create New System User</h2>
        <form (ngSubmit)="createUser()" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              name="username"
              [(ngModel)]="userForm.username"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              name="fullName"
              [(ngModel)]="userForm.fullName"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              [(ngModel)]="userForm.email"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              name="password"
              [(ngModel)]="userForm.password"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Assign Role *</label>
            <select
              name="roleId"
              [(ngModel)]="userForm.roleId"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option *ngFor="let r of roles()" [value]="r.id">
                {{ r.displayName }} ({{ r.name }})
              </option>
            </select>
          </div>
          <div class="flex items-end justify-end gap-2">
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>

      <!-- Roles & Permissions Matrix -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          *ngFor="let r of roles()"
          class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-1 rounded bg-slate-900 text-amber-400 font-mono-code font-bold text-xs">
              {{ r.name }}
            </span>
            <span class="text-xs font-semibold text-slate-500">
              {{ r._count?.users || 0 }} Users
            </span>
          </div>
          <h3 class="text-sm font-bold text-slate-900">{{ r.displayName }}</h3>
          <p class="text-xs text-slate-500">{{ r.description }}</p>
          <div class="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
            <span
              *ngFor="let rp of r.rolePermissions"
              class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono-code text-[10px]"
            >
              {{ rp.permission?.code }}
            </span>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-base font-bold text-slate-900">System User Accounts</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">Username</th>
                <th class="py-3 px-4">Full Name</th>
                <th class="py-3 px-4">Email</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Linked Employee</th>
                <th class="py-3 px-4">Last Login (IST)</th>
                <th class="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let u of users()">
                <td class="py-3 px-4 font-mono-code font-bold">{{ u.username }}</td>
                <td class="py-3 px-4 font-semibold">{{ u.fullName }}</td>
                <td class="py-3 px-4 text-slate-600">{{ u.email }}</td>
                <td class="py-3 px-4">
                  <span class="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono-code font-bold">
                    {{ u.role?.name }}
                  </span>
                </td>
                <td class="py-3 px-4">{{ u.employee?.name || '-' }}</td>
                <td class="py-3 px-4 text-slate-500">{{ u.lastLoginAt | istDate }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    [ngClass]="
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    "
                  >
                    {{ u.isActive ? 'ACTIVE' : 'INACTIVE' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class UsersComponent implements OnInit {
  users = signal<any[]>([]);
  roles = signal<any[]>([]);
  showUserForm = signal(false);

  userForm = {
    username: '',
    fullName: '',
    email: '',
    password: '',
    roleId: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.api.get('/users').subscribe((res) => this.users.set(res.data || []));
    this.api.get('/users/roles').subscribe((res) => {
      const r = res.data?.roles || [];
      this.roles.set(r);
      if (r.length > 0 && !this.userForm.roleId) {
        this.userForm.roleId = r[0].id;
      }
    });
  }

  createUser(): void {
    this.api.post('/users', this.userForm).subscribe({
      next: () => {
        this.notify.success('User account created');
        this.showUserForm.set(false);
        this.loadData();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to create user')
    });
  }
}
