import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">
            Category, Subcategory & Tool Hierarchy Management
          </h1>
          <p class="text-sm text-slate-500">
            Manage the dynamic flow:
            <strong class="text-slate-800">Machine / Product Type &rarr; Category (e.g. 10bolt) &rarr; Subcategory (e.g. 10-100, 10-70) &rarr; Tools (e.g. 21, 34, 70)</strong>
          </p>
        </div>

        <div *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')" class="flex flex-wrap gap-2">
          <button
            (click)="activeModal.set('quickBuilder')"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span class="material-icons text-base">bolt</span>
            <span>Quick Flow Builder (10bolt &rarr; 10-100 &rarr; Tools 21, 34, 70)</span>
          </button>
          <button
            (click)="openCategoryModal()"
            class="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span class="material-icons text-base">create_new_folder</span>
            <span>+ Add Category</span>
          </button>
          <button
            (click)="openSubcategoryModal()"
            class="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span class="material-icons text-base">subdirectory_arrow_right</span>
            <span>+ Add Subcategory</span>
          </button>
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <input
          type="text"
          [(ngModel)]="search"
          (ngModelChange)="loadHierarchy()"
          placeholder="Search category (10bolt), subcategory (10-100, 10-70), or tool (21, 34, 70)..."
          class="flex-1 min-w-[260px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:border-amber-500"
        />
        <select
          [(ngModel)]="machineFilter"
          (ngModelChange)="loadHierarchy()"
          class="px-3.5 py-2 rounded-lg border border-slate-300 text-xs outline-none"
        >
          <option value="">All Machines / Product Types</option>
          <option *ngFor="let m of machines()" [value]="m.id">
            {{ m.machineName }} ({{ m.machineCode }})
          </option>
        </select>
      </div>

      <!-- 1. QUICK HIERARCHY FLOW BUILDER MODAL (Category -> Subcategory -> Multiple Tools like 21, 34, 70) -->
      <div
        *ngIf="activeModal() === 'quickBuilder'"
        class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-xl space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">
              Rapid Hierarchy Flow Builder (Category &rarr; Subcategory &rarr; Tools)
            </h2>
            <p class="text-xs text-slate-500">
              Create or extend a Category (e.g. <code class="font-mono-code font-bold">10bolt</code>), Subcategory (e.g. <code class="font-mono-code font-bold">10-100</code> or <code class="font-mono-code font-bold">10-70</code>), and its Tools (e.g. <code class="font-mono-code font-bold">21, 34, 70</code>) in one step.
            </p>
          </div>
          <button (click)="activeModal.set(null)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="submitQuickHierarchy()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Associated Machine (Optional)</label>
            <select
              name="qbMachineId"
              [(ngModel)]="quickForm.machineId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">General / All Machines</option>
              <option *ngFor="let m of machines()" [value]="m.id">
                {{ m.machineName }} ({{ m.machineCode }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Category Name *</label>
            <input
              type="text"
              name="qbCategoryName"
              [(ngModel)]="quickForm.categoryName"
              required
              placeholder="e.g. 10bolt"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Subcategory Specification *</label>
            <input
              type="text"
              name="qbSubcategoryName"
              [(ngModel)]="quickForm.subcategoryName"
              required
              placeholder="e.g. 10-100 or 10-70"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">
              Tool Numbers (Comma-separated) *
            </label>
            <input
              type="text"
              name="qbToolNumbers"
              [(ngModel)]="quickForm.toolNumbersCsv"
              required
              placeholder="e.g. 21, 34, 70"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code font-bold text-amber-800"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Opening Stock per Tool</label>
            <input
              type="number"
              name="qbOpeningStock"
              [(ngModel)]="quickForm.openingStock"
              min="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Min Stock Alert Level</label>
            <input
              type="number"
              name="qbMinStock"
              [(ngModel)]="quickForm.minimumStockLevel"
              min="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Storage Rack / Location</label>
            <input
              type="text"
              name="qbLocation"
              [(ngModel)]="quickForm.storageLocation"
              placeholder="e.g. Rack A1"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="flex items-end justify-end gap-2">
            <button
              type="button"
              (click)="activeModal.set(null)"
              class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
            >
              Create Flow & Tools
            </button>
          </div>
        </form>
      </div>

      <!-- 2. ADD / EDIT CATEGORY MODAL -->
      <div
        *ngIf="activeModal() === 'category'"
        class="bg-white p-6 rounded-xl border-2 border-slate-800 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 class="text-base font-bold text-slate-900">
            {{ editingCategoryId() ? 'Edit Category' : 'Add New Category (e.g. 10bolt, 12bolt)' }}
          </h2>
          <button (click)="activeModal.set(null)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="saveCategory()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Category Name *</label>
            <input
              type="text"
              name="catName"
              [(ngModel)]="categoryForm.name"
              required
              placeholder="e.g. 10bolt"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Target Type</label>
            <select
              name="catTargetType"
              [(ngModel)]="categoryForm.targetType"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="MACHINE">MACHINE</option>
              <option value="PRODUCT">PRODUCT</option>
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Associated Machine</label>
            <select
              name="catMachineId"
              [(ngModel)]="categoryForm.machineId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">None / General</option>
              <option *ngFor="let m of machines()" [value]="m.id">
                {{ m.machineName }} ({{ m.machineCode }})
              </option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              name="catDesc"
              [(ngModel)]="categoryForm.description"
              placeholder="Description"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div class="md:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              (click)="activeModal.set(null)"
              class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
            >
              Save Category
            </button>
          </div>
        </form>
      </div>

      <!-- 3. ADD / EDIT SUBCATEGORY MODAL -->
      <div
        *ngIf="activeModal() === 'subcategory'"
        class="bg-white p-6 rounded-xl border-2 border-blue-500 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 class="text-base font-bold text-slate-900">
            {{ editingSubcategoryId() ? 'Edit Subcategory' : 'Add Subcategory Under Category (e.g. 10-100, 10-70)' }}
          </h2>
          <button (click)="activeModal.set(null)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="saveSubcategory()" class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Parent Category *</label>
            <select
              name="subCatId"
              [(ngModel)]="subcategoryForm.categoryId"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="" disabled>Select Category</option>
              <option *ngFor="let c of categories()" [value]="c.id">
                {{ c.name }} ({{ c.machine?.machineName || c.targetType }})
              </option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">
              Subcategory Name / Size *
            </label>
            <input
              type="text"
              name="subName"
              [(ngModel)]="subcategoryForm.name"
              required
              placeholder="e.g. 10-100 or 10-70"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
            />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              name="subDesc"
              [(ngModel)]="subcategoryForm.description"
              placeholder="Specification details"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div class="md:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              (click)="activeModal.set(null)"
              class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              Save Subcategory
            </button>
          </div>
        </form>
      </div>

      <!-- Interactive Hierarchy Cards: Category (10bolt) -> Subcategories (10-100, 10-70) -> Tools (21, 34, 70) -->
      <div class="space-y-5">
        <div
          *ngFor="let cat of categories()"
          class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <!-- Category Header -->
          <div class="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono-code font-bold text-sm">
                {{ cat.name }}
              </span>
              <div>
                <div class="text-xs text-slate-300">
                  Parent Machine / Scope:
                  <strong class="text-white">{{ cat.machine?.machineName || cat.targetType }}</strong>
                  <span *ngIf="cat.machine?.machineCode" class="font-mono-code text-amber-400">
                    ({{ cat.machine.machineCode }})
                  </span>
                </div>
                <div *ngIf="cat.description" class="text-[11px] text-slate-400">
                  {{ cat.description }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                [ngClass]="
                  cat.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300'
                "
              >
                {{ cat.status }}
              </span>
              <button
                *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                (click)="openSubcategoryModal(cat.id)"
                class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-400 border border-slate-700 cursor-pointer"
              >
                + Add Subcategory (e.g. 10-100)
              </button>
              <button
                *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                (click)="openCategoryModal(cat)"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                Edit
              </button>
              <button
                *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                (click)="toggleCategoryStatus(cat)"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                {{ cat.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </div>

          <!-- Subcategories Grid inside Category -->
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/60">
            <div
              *ngFor="let sub of cat.subcategories"
              class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-slate-400">{{ cat.name }} &rarr;</span>
                    <span class="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 font-mono-code font-bold text-xs">
                      {{ sub.name }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] font-semibold text-slate-500">
                      {{ sub.inventoryItems?.length || 0 }} Tools
                    </span>
                    <button
                      *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                      (click)="openSubcategoryEdit(sub)"
                      class="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <!-- Tools Badges & Quick Stock Table (e.g. Tools 21, 34, 70) -->
                <div *ngIf="sub.inventoryItems?.length; else noToolsTpl" class="space-y-2">
                  <div class="flex flex-wrap gap-1.5 mb-2">
                    <span
                      *ngFor="let tool of sub.inventoryItems"
                      class="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-slate-900 text-xs font-mono-code font-bold flex items-center gap-1.5"
                    >
                      <span>Tool #{{ tool.toolNumber || tool.itemCode }}</span>
                      <span class="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                        Avail: {{ tool.availableStock }}
                      </span>
                    </span>
                  </div>

                  <table class="w-full text-left border-collapse text-xs border border-slate-100 rounded overflow-hidden">
                    <thead>
                      <tr class="bg-slate-100 text-slate-600 text-[10px] uppercase">
                        <th class="py-1.5 px-2">Tool #</th>
                        <th class="py-1.5 px-2">Item Name</th>
                        <th class="py-1.5 px-2">Avail</th>
                        <th class="py-1.5 px-2">Issued</th>
                        <th class="py-1.5 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr *ngFor="let tool of sub.inventoryItems">
                        <td class="py-1.5 px-2 font-mono-code font-bold text-amber-800">
                          {{ tool.toolNumber || '-' }}
                        </td>
                        <td class="py-1.5 px-2 font-medium text-slate-800">{{ tool.itemName }}</td>
                        <td class="py-1.5 px-2 font-bold text-emerald-700">{{ tool.availableStock }}</td>
                        <td class="py-1.5 px-2 text-amber-700">{{ tool.issuedStock }}</td>
                        <td class="py-1.5 px-2 text-slate-600">{{ tool.totalStock }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ng-template #noToolsTpl>
                  <div class="py-4 text-center text-xs text-slate-400">
                    No tools registered under {{ sub.name }} yet.
                  </div>
                </ng-template>
              </div>

              <!-- Quick Inline Add Tool under this Subcategory -->
              <div
                *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
                class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2"
              >
                <input
                  type="text"
                  #toolNoInput
                  placeholder="Tool # (e.g. 21, 34, 70)"
                  class="w-36 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-mono-code"
                />
                <input
                  type="number"
                  #toolStockInput
                  placeholder="Opening Qty"
                  value="25"
                  class="w-24 px-2.5 py-1.5 rounded border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  (click)="quickAddSingleTool(cat, sub, toolNoInput.value, toolStockInput.value); toolNoInput.value = ''"
                  class="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  + Add Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CategoriesComponent implements OnInit {
  categories = signal<any[]>([]);
  machines = signal<any[]>([]);
  search = '';
  machineFilter = '';

  activeModal = signal<'quickBuilder' | 'category' | 'subcategory' | null>(
    null
  );
  editingCategoryId = signal<string | null>(null);
  editingSubcategoryId = signal<string | null>(null);

  quickForm = {
    machineId: '',
    categoryName: '10bolt',
    subcategoryName: '10-100',
    toolNumbersCsv: '21, 34, 70',
    openingStock: 50,
    minimumStockLevel: 10,
    storageLocation: 'Rack A1'
  };

  categoryForm = {
    name: '',
    targetType: 'MACHINE',
    machineId: '',
    description: ''
  };

  subcategoryForm = {
    categoryId: '',
    name: '',
    description: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMachines();
    this.loadHierarchy();
  }

  loadMachines(): void {
    this.api.get('/machines').subscribe({
      next: (res) => this.machines.set(res.data || [])
    });
  }

  loadHierarchy(): void {
    this.api
      .get('/categories/hierarchy', {
        search: this.search,
        machineId: this.machineFilter
      })
      .subscribe({
        next: (res) => this.categories.set(res.data || [])
      });
  }

  openCategoryModal(cat?: any): void {
    if (cat) {
      this.editingCategoryId.set(cat.id);
      this.categoryForm = {
        name: cat.name,
        targetType: cat.targetType || 'MACHINE',
        machineId: cat.machineId || '',
        description: cat.description || ''
      };
    } else {
      this.editingCategoryId.set(null);
      this.categoryForm = {
        name: '',
        targetType: 'MACHINE',
        machineId: '',
        description: ''
      };
    }
    this.activeModal.set('category');
  }

  saveCategory(): void {
    const id = this.editingCategoryId();
    const payload = {
      ...this.categoryForm,
      machineId: this.categoryForm.machineId || null
    };
    const req$ = id
      ? this.api.put(`/categories/${id}`, payload)
      : this.api.post('/categories', payload);

    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Category updated' : 'Category created');
        this.activeModal.set(null);
        this.loadHierarchy();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to save category')
    });
  }

  toggleCategoryStatus(cat: any): void {
    const status = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.patch(`/categories/${cat.id}/status`, { status }).subscribe({
      next: () => {
        this.notify.success(`Category ${cat.name} set to ${status}`);
        this.loadHierarchy();
      }
    });
  }

  openSubcategoryModal(defaultCategoryId = ''): void {
    this.editingSubcategoryId.set(null);
    this.subcategoryForm = {
      categoryId: defaultCategoryId || (this.categories()[0]?.id ?? ''),
      name: '',
      description: ''
    };
    this.activeModal.set('subcategory');
  }

  openSubcategoryEdit(sub: any): void {
    this.editingSubcategoryId.set(sub.id);
    this.subcategoryForm = {
      categoryId: sub.categoryId,
      name: sub.name,
      description: sub.description || ''
    };
    this.activeModal.set('subcategory');
  }

  saveSubcategory(): void {
    const id = this.editingSubcategoryId();
    const req$ = id
      ? this.api.put(`/categories/subcategories/${id}`, this.subcategoryForm)
      : this.api.post('/categories/subcategories', this.subcategoryForm);

    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Subcategory updated' : 'Subcategory added');
        this.activeModal.set(null);
        this.loadHierarchy();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to save subcategory')
    });
  }

  submitQuickHierarchy(): void {
    const toolNumbers = this.quickForm.toolNumbersCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      machineId: this.quickForm.machineId || null,
      targetType: 'MACHINE',
      categoryName: this.quickForm.categoryName,
      subcategoryName: this.quickForm.subcategoryName,
      tools: toolNumbers.map((tn) => ({
        toolNumber: tn,
        itemName: `${this.quickForm.categoryName} (${this.quickForm.subcategoryName}) Tool #${tn}`,
        openingStock: Number(this.quickForm.openingStock || 0),
        minimumStockLevel: Number(this.quickForm.minimumStockLevel || 5),
        storageLocation: this.quickForm.storageLocation
      }))
    };

    this.api.post('/categories/quick-hierarchy', payload).subscribe({
      next: () => {
        this.notify.success(
          `Created hierarchy ${this.quickForm.categoryName} -> ${this.quickForm.subcategoryName} with ${toolNumbers.length} tools`
        );
        this.activeModal.set(null);
        this.loadHierarchy();
      },
      error: (err) =>
        this.notify.error(
          err.error?.message || 'Failed to build quick hierarchy'
        )
    });
  }

  quickAddSingleTool(
    cat: any,
    sub: any,
    toolNo: string,
    openingStockStr: string
  ): void {
    if (!toolNo || !toolNo.trim()) {
      this.notify.error('Please enter a Tool Number (e.g. 21, 34, 70)');
      return;
    }
    const toolNumbers = toolNo
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const openingStock = Number(openingStockStr || 0);

    const payload = {
      machineId: cat.machineId || null,
      targetType: cat.targetType || 'MACHINE',
      categoryName: cat.name,
      subcategoryName: sub.name,
      tools: toolNumbers.map((tn) => ({
        toolNumber: tn,
        openingStock,
        minimumStockLevel: 5
      }))
    };

    this.api.post('/categories/quick-hierarchy', payload).subscribe({
      next: () => {
        this.notify.success(
          `Added ${toolNumbers.length} tool(s) (${toolNumbers.join(', ')}) under ${cat.name} -> ${sub.name}`
        );
        this.loadHierarchy();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to add tool(s)')
    });
  }
}
