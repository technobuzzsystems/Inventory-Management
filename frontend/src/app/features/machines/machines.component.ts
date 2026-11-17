import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Machine Management</h1>
          <p class="text-sm text-slate-500">
            Manage shop-floor machines, activate/deactivate status, and view associated categories & tools
          </p>
        </div>
        <button
          *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
          (click)="openCreate()"
          class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span class="material-icons text-base">add</span>
          <span>Add New Machine</span>
        </button>
      </div>

      <!-- Search and Filters -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <input
          type="text"
          [(ngModel)]="search"
          (ngModelChange)="loadMachines()"
          placeholder="Search machine name, code, type, or location..."
          class="flex-1 min-w-[240px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:border-amber-500"
        />
        <select
          [(ngModel)]="statusFilter"
          (ngModelChange)="loadMachines()"
          class="px-3.5 py-2 rounded-lg border border-slate-300 text-xs outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
      </div>

      <!-- Form Modal / Card -->
      <div
        *ngIf="showForm()"
        class="bg-white p-6 rounded-xl border-2 border-amber-400 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 class="text-base font-bold text-slate-900">
            {{ editingId() ? 'Edit Machine Details' : 'Register New Industrial Machine' }}
          </h2>
          <button (click)="showForm.set(false)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="saveMachine()" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Machine Name *</label>
            <input
              type="text"
              name="machineName"
              [(ngModel)]="form.machineName"
              required
              placeholder="e.g. Cold Header Multi-Station #10"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Machine Code (Auto if blank)</label>
            <input
              type="text"
              name="machineCode"
              [(ngModel)]="form.machineCode"
              placeholder="e.g. MCH-HDR-10"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Machine Type *</label>
            <input
              type="text"
              name="machineType"
              [(ngModel)]="form.machineType"
              required
              placeholder="e.g. Bolt Former / Cold Header"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Location *</label>
            <input
              type="text"
              name="location"
              [(ngModel)]="form.location"
              required
              placeholder="e.g. Bay A - Shop Floor 1"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status</label>
            <select
              name="status"
              [(ngModel)]="form.status"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              name="description"
              [(ngModel)]="form.description"
              placeholder="Machine specifications & notes"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div class="md:col-span-3 flex justify-end gap-2 pt-2">
            <button
              type="button"
              (click)="showForm.set(false)"
              class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              {{ editingId() ? 'Update Machine' : 'Save Machine' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Machines Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          *ngFor="let m of machines()"
          class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
        >
          <div class="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-slate-100 font-mono-code text-xs font-bold text-slate-800">
                  {{ m.machineCode }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  [ngClass]="
                    m.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  "
                >
                  {{ m.status }}
                </span>
              </div>
              <h3 class="mt-1.5 text-base font-bold text-slate-900">{{ m.machineName }}</h3>
              <p class="text-xs text-slate-500">
                Type: <strong class="text-slate-700">{{ m.machineType }}</strong> | Location:
                <strong class="text-slate-700">{{ m.location }}</strong>
              </p>
              <p *ngIf="m.description" class="mt-1 text-xs text-slate-500">{{ m.description }}</p>
            </div>

            <div *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')" class="flex items-center gap-1.5 shrink-0">
              <button
                (click)="openEdit(m)"
                class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Edit
              </button>
              <button
                (click)="toggleStatus(m)"
                class="px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
                [ngClass]="
                  m.status === 'ACTIVE'
                    ? 'border-red-200 text-red-700 hover:bg-red-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                "
              >
                {{ m.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </div>

          <!-- Associated Categories & Tools Summary -->
          <div class="p-4 bg-slate-50 flex-1 space-y-3 text-xs">
            <div class="flex items-center justify-between font-semibold text-slate-700">
              <span>Associated Categories: {{ m.categories?.length || 0 }}</span>
              <span>Associated Tools: {{ m.inventoryItems?.length || 0 }}</span>
            </div>

            <div *ngIf="m.inventoryItems?.length" class="overflow-x-auto">
              <table class="w-full text-left border-collapse bg-white rounded-lg overflow-hidden border border-slate-200">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 text-[11px] uppercase">
                    <th class="py-1.5 px-2.5">Category &rarr; Sub</th>
                    <th class="py-1.5 px-2.5">Tool #</th>
                    <th class="py-1.5 px-2.5">Item Name</th>
                    <th class="py-1.5 px-2.5">Avail / Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let t of m.inventoryItems">
                    <td class="py-1.5 px-2.5 font-medium text-slate-700">
                      {{ t.category?.name }} &rarr; {{ t.subcategory?.name || '-' }}
                    </td>
                    <td class="py-1.5 px-2.5 font-mono-code font-bold text-amber-700">
                      {{ t.toolNumber || '-' }}
                    </td>
                    <td class="py-1.5 px-2.5 text-slate-800">{{ t.itemName }}</td>
                    <td class="py-1.5 px-2.5 font-semibold">
                      <span class="text-emerald-700">{{ t.availableStock }}</span> / {{ t.totalStock }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MachinesComponent implements OnInit {
  machines = signal<any[]>([]);
  search = '';
  statusFilter = '';
  showForm = signal(false);
  editingId = signal<string | null>(null);

  form = {
    machineName: '',
    machineCode: '',
    machineType: '',
    location: '',
    description: '',
    status: 'ACTIVE'
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMachines();
  }

  loadMachines(): void {
    this.api
      .get('/machines', {
        search: this.search,
        status: this.statusFilter
      })
      .subscribe({
        next: (res) => this.machines.set(res.data || [])
      });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = {
      machineName: '',
      machineCode: '',
      machineType: '',
      location: '',
      description: '',
      status: 'ACTIVE'
    };
    this.showForm.set(true);
  }

  openEdit(m: any): void {
    this.editingId.set(m.id);
    this.form = {
      machineName: m.machineName,
      machineCode: m.machineCode,
      machineType: m.machineType,
      location: m.location,
      description: m.description || '',
      status: m.status
    };
    this.showForm.set(true);
  }

  saveMachine(): void {
    const id = this.editingId();
    const req$ = id
      ? this.api.put(`/machines/${id}`, this.form)
      : this.api.post('/machines', this.form);

    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Machine updated' : 'Machine added');
        this.showForm.set(false);
        this.loadMachines();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to save machine')
    });
  }

  toggleStatus(m: any): void {
    const nextStatus = m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.patch(`/machines/${m.id}/status`, { status: nextStatus }).subscribe({
      next: () => {
        this.notify.success(`Machine status changed to ${nextStatus}`);
        this.loadMachines();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Status update failed')
    });
  }
}
