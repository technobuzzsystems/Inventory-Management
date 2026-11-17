import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NotificationService } from '../../core/notification.service';
import { AuthService } from '../../core/auth.service';
import { IstDatePipe } from '../../shared/ist-date.pipe';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, IstDatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Inventory Item Master</h1>
          <p class="text-sm text-slate-500">
            Manage all tools & products across Categories (e.g. 10bolt) &rarr; Subcategories (e.g. 10-100, 10-70) &rarr; Tools (e.g. 21, 34, 70)
          </p>
        </div>

        <div *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')" class="flex flex-wrap items-center gap-2">
          <button
            (click)="downloadBulkTemplate()"
            class="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span class="material-icons text-base text-emerald-600">download</span>
            <span>Download Excel Template</span>
          </button>

          <button
            (click)="showBulkExcelModal.set(!showBulkExcelModal())"
            class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span class="material-icons text-base">upload_file</span>
            <span>Bulk Upload via Excel (.xlsx)</span>
          </button>

          <button
            (click)="openCreate()"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span class="material-icons text-base">add</span>
            <span>+ Add Single Tool</span>
          </button>
        </div>
      </div>

      <!-- BULK EXCEL UPLOAD PANEL -->
      <div
        *ngIf="showBulkExcelModal()"
        class="bg-white p-6 rounded-xl border-2 border-emerald-500 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
              <span class="material-icons text-emerald-600">table_view</span>
              <span>Bulk Import Tools & Opening Stock from Excel (.xlsx)</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Automatically creates Machines, Categories (e.g. <code class="font-mono-code font-bold">10bolt</code>), Subcategories (e.g. <code class="font-mono-code font-bold">10-100</code>, <code class="font-mono-code font-bold">10-70</code>), and Tools (e.g. <code class="font-mono-code font-bold">21, 34, 70</code>) with Opening Stock in a single upload.
            </p>
          </div>
          <button (click)="showBulkExcelModal.set(false)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
          <div class="space-y-1">
            <div class="font-bold text-emerald-950">Step 1: Get the Excel Format</div>
            <p class="text-slate-600">
              Download the pre-formatted <code class="font-mono-code">.xlsx</code> sheet containing columns for Machine, Category, Subcategory, Tool #, Item Name, and Opening Stock.
            </p>
            <button
              type="button"
              (click)="downloadBulkTemplate()"
              class="mt-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100 cursor-pointer"
            >
              Download Sample Excel (.xlsx)
            </button>
          </div>

          <div class="space-y-1">
            <div class="font-bold text-emerald-950">Step 2: Select Your Filled Excel File</div>
            <input
              type="file"
              accept=".xlsx"
              (change)="onExcelFileSelected($event)"
              class="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer"
            />
            <div *ngIf="selectedFileName()" class="text-[11px] text-emerald-800 font-mono-code">
              Selected: {{ selectedFileName() }}
            </div>
          </div>

          <div class="flex flex-col items-end justify-center gap-2">
            <button
              type="button"
              [disabled]="!excelBase64() || uploadingExcel()"
              (click)="uploadBulkExcel()"
              class="w-full py-2.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow cursor-pointer flex items-center justify-center gap-2"
            >
              <span class="material-icons text-base">cloud_upload</span>
              <span>{{ uploadingExcel() ? 'Importing Excel Rows...' : 'Start Bulk Import Now' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Cascading Hierarchy Filters -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <input
          type="text"
          [(ngModel)]="filters.search"
          (ngModelChange)="loadItems()"
          placeholder="Search name, SKU, Tool # (21, 34, 70)..."
          class="lg:col-span-2 px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-amber-500"
        />
        <select
          [(ngModel)]="filters.machineId"
          (ngModelChange)="loadItems()"
          class="px-3 py-2 rounded-lg border border-slate-300"
        >
          <option value="">All Machines</option>
          <option *ngFor="let m of machines()" [value]="m.id">
            {{ m.machineName }}
          </option>
        </select>
        <select
          [(ngModel)]="filters.categoryId"
          (ngModelChange)="onFilterCategoryChange()"
          class="px-3 py-2 rounded-lg border border-slate-300 font-semibold"
        >
          <option value="">All Categories (e.g. 10bolt)</option>
          <option *ngFor="let c of categories()" [value]="c.id">
            {{ c.name }}
          </option>
        </select>
        <select
          [(ngModel)]="filters.subcategoryId"
          (ngModelChange)="loadItems()"
          class="px-3 py-2 rounded-lg border border-slate-300 font-semibold"
        >
          <option value="">All Subcategories (e.g. 10-100)</option>
          <option *ngFor="let s of filterSubcategories()" [value]="s.id">
            {{ s.name }}
          </option>
        </select>
        <label class="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-900 font-semibold cursor-pointer">
          <input
            type="checkbox"
            [(ngModel)]="filters.lowStockOnly"
            (ngModelChange)="loadItems()"
          />
          <span>Low Stock Only</span>
        </label>
      </div>

      <!-- Add / Edit Form -->
      <div
        *ngIf="showForm()"
        class="bg-white p-6 rounded-xl border-2 border-amber-500 shadow-lg space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 class="text-base font-bold text-slate-900">
            {{ editingId() ? 'Edit Inventory Item' : 'Add New Inventory Item / Tool' }}
          </h2>
          <button (click)="showForm.set(false)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>

        <form (ngSubmit)="saveItem()" class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Category (e.g. 10bolt) *</label>
            <select
              name="categoryId"
              [(ngModel)]="form.categoryId"
              (ngModelChange)="onFormCategoryChange()"
              required
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="" disabled>Select Category</option>
              <option *ngFor="let c of categories()" [value]="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Subcategory (e.g. 10-100, 10-70)</label>
            <select
              name="subcategoryId"
              [(ngModel)]="form.subcategoryId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
            >
              <option value="">None</option>
              <option *ngFor="let s of formSubcategories()" [value]="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tool Number (e.g. 21, 34, 70)</label>
            <input
              type="text"
              name="toolNumber"
              [(ngModel)]="form.toolNumber"
              placeholder="e.g. 21, 34, 70"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code font-bold text-amber-800"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Item Name *</label>
            <input
              type="text"
              name="itemName"
              [(ngModel)]="form.itemName"
              required
              placeholder="e.g. 10bolt (10-100) Tool #21 Heading Die"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Item Code / SKU (Auto if blank)</label>
            <input
              type="text"
              name="itemCode"
              [(ngModel)]="form.itemCode"
              placeholder="Auto-generated if left empty"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono-code"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Machine (Optional)</label>
            <select
              name="machineId"
              [(ngModel)]="form.machineId"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="">None / General</option>
              <option *ngFor="let m of machines()" [value]="m.id">
                {{ m.machineName }} ({{ m.machineCode }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Unit of Measurement *</label>
            <select
              name="unitOfMeasurement"
              [(ngModel)]="form.unitOfMeasurement"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="PCS">PCS</option>
              <option value="SET">SET</option>
              <option value="BOX">BOX</option>
              <option value="KG">KG</option>
              <option value="LITER">LITER</option>
              <option value="METER">METER</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tracking Type</label>
            <select
              name="trackingType"
              [(ngModel)]="form.trackingType"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            >
              <option value="QUANTITY">Quantity-based</option>
              <option value="SERIAL">Serial-based</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Brand</label>
            <input
              type="text"
              name="brand"
              [(ngModel)]="form.brand"
              placeholder="e.g. Bharat Carbide"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Model Number</label>
            <input
              type="text"
              name="modelNumber"
              [(ngModel)]="form.modelNumber"
              placeholder="e.g. BC-10100-21"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Minimum Stock Level *</label>
            <input
              type="number"
              name="minimumStockLevel"
              [(ngModel)]="form.minimumStockLevel"
              min="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div *ngIf="!editingId()">
            <label class="block font-semibold text-slate-700 mb-1">Opening Stock Quantity</label>
            <input
              type="number"
              name="openingStock"
              [(ngModel)]="form.openingStock"
              min="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Storage Location</label>
            <input
              type="text"
              name="storageLocation"
              [(ngModel)]="form.storageLocation"
              placeholder="e.g. Rack A1 - Bin 21"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              name="description"
              [(ngModel)]="form.description"
              placeholder="Tool dimensions, coating, or usage notes"
              class="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          <div class="md:col-span-4 flex justify-end gap-2 pt-2">
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
              {{ editingId() ? 'Update Item' : 'Create Inventory Item' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Inventory Master Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white uppercase text-[11px]">
                <th class="py-3 px-4">SKU / Code</th>
                <th class="py-3 px-4">Hierarchy (Cat &rarr; Sub &rarr; Tool #)</th>
                <th class="py-3 px-4">Item Name & Brand</th>
                <th class="py-3 px-4">Machine</th>
                <th class="py-3 px-4 text-center">Total</th>
                <th class="py-3 px-4 text-center">Available</th>
                <th class="py-3 px-4 text-center">Issued</th>
                <th class="py-3 px-4 text-center">Damaged / Lost</th>
                <th class="py-3 px-4">Location</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let item of items()" class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono-code font-bold text-slate-800">
                  {{ item.itemCode }}
                </td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                      {{ item.category?.name }}
                    </span>
                    <span class="text-slate-400">&rarr;</span>
                    <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono-code font-semibold">
                      {{ item.subcategory?.name || '-' }}
                    </span>
                    <span *ngIf="item.toolNumber" class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono-code font-bold">
                      Tool #{{ item.toolNumber }}
                    </span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900">{{ item.itemName }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ item.brand || 'Standard' }} | {{ item.unitOfMeasurement }} ({{ item.trackingType }})
                  </div>
                </td>
                <td class="py-3 px-4 text-slate-600">
                  {{ item.machine?.machineName || 'General' }}
                </td>
                <td class="py-3 px-4 text-center font-bold text-slate-800">
                  {{ item.totalStock }}
                </td>
                <td class="py-3 px-4 text-center">
                  <span
                    class="px-2.5 py-1 rounded-full font-bold"
                    [ngClass]="
                      item.availableStock <= item.minimumStockLevel
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-emerald-100 text-emerald-800'
                    "
                  >
                    {{ item.availableStock }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-amber-700">
                  {{ item.issuedStock }}
                </td>
                <td class="py-3 px-4 text-center">
                  <span class="text-orange-700 font-semibold">{{ item.damagedStock }}</span> /
                  <span class="text-rose-700 font-semibold">{{ item.lostStock }}</span>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ item.storageLocation || '-' }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    [ngClass]="
                      item.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    "
                  >
                    {{ item.status }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button
                    (click)="viewHistory(item)"
                    class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                  >
                    History
                  </button>
                  <button
                    *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER')"
                    (click)="openEdit(item)"
                    class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    *ngIf="auth.hasRole('SUPER_ADMIN', 'ADMIN')"
                    (click)="toggleStatus(item)"
                    class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    {{ item.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="!items().length">
                <td colspan="11" class="py-10 text-center text-slate-400">
                  No inventory tools found. Click <strong>"Bulk Upload via Excel (.xlsx)"</strong> or <strong>"+ Add Single Tool"</strong> to add your inventory.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Stock Movement History Modal -->
      <div
        *ngIf="selectedItemHistory()"
        class="bg-white p-6 rounded-xl border-2 border-slate-800 shadow-xl space-y-4"
      >
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 class="text-base font-bold text-slate-900">
              Stock Movement Ledger: {{ selectedItemHistory()?.item?.itemName }}
            </h3>
            <p class="text-xs text-slate-500 font-mono-code">
              SKU: {{ selectedItemHistory()?.item?.itemCode }} | Available: {{ selectedItemHistory()?.item?.availableStock }} | Issued: {{ selectedItemHistory()?.item?.issuedStock }}
            </p>
          </div>
          <button (click)="selectedItemHistory.set(null)" class="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕ Close
          </button>
        </div>

        <div class="overflow-x-auto max-h-80">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 text-slate-700 uppercase">
                <th class="py-2 px-3">Tx Ref</th>
                <th class="py-2 px-3">Type</th>
                <th class="py-2 px-3">Qty</th>
                <th class="py-2 px-3">Available Before &rarr; After</th>
                <th class="py-2 px-3">Party</th>
                <th class="py-2 px-3">Remarks</th>
                <th class="py-2 px-3">By User</th>
                <th class="py-2 px-3">Date (IST)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr *ngFor="let m of selectedItemHistory()?.movements">
                <td class="py-2 px-3 font-mono-code font-semibold">{{ m.transactionRef }}</td>
                <td class="py-2 px-3 font-bold">{{ m.transactionType }}</td>
                <td class="py-2 px-3 font-bold">{{ m.quantity }}</td>
                <td class="py-2 px-3 font-mono-code">
                  {{ m.previousAvailableStock }} &rarr; <strong>{{ m.newAvailableStock }}</strong>
                </td>
                <td class="py-2 px-3">{{ m.employee?.name || m.supplier?.name || '-' }}</td>
                <td class="py-2 px-3 text-slate-600">{{ m.remarks || '-' }}</td>
                <td class="py-2 px-3">{{ m.performedBy?.fullName }}</td>
                <td class="py-2 px-3">{{ m.createdAt | istDate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class InventoryComponent implements OnInit {
  items = signal<any[]>([]);
  machines = signal<any[]>([]);
  categories = signal<any[]>([]);
  filterSubcategories = signal<any[]>([]);
  formSubcategories = signal<any[]>([]);

  showForm = signal(false);
  showBulkExcelModal = signal(false);
  selectedFileName = signal('');
  excelBase64 = signal('');
  uploadingExcel = signal(false);

  editingId = signal<string | null>(null);
  selectedItemHistory = signal<{ item: any; movements: any[] } | null>(null);

  filters = {
    search: '',
    machineId: '',
    categoryId: '',
    subcategoryId: '',
    lowStockOnly: false
  };

  form = {
    itemName: '',
    itemCode: '',
    toolNumber: '',
    machineId: '',
    categoryId: '',
    subcategoryId: '',
    brand: '',
    modelNumber: '',
    unitOfMeasurement: 'PCS',
    trackingType: 'QUANTITY',
    minimumStockLevel: 10,
    openingStock: 0,
    storageLocation: '',
    description: ''
  };

  constructor(
    private api: ApiService,
    private notify: NotificationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMasterLookups();
    this.loadItems();
  }

  loadMasterLookups(): void {
    this.api.get('/machines').subscribe((res) => this.machines.set(res.data || []));
    this.api.get('/categories').subscribe((res) => this.categories.set(res.data || []));
  }

  onFilterCategoryChange(): void {
    this.filters.subcategoryId = '';
    const cat = this.categories().find((c) => c.id === this.filters.categoryId);
    this.filterSubcategories.set(cat?.subcategories || []);
    this.loadItems();
  }

  onFormCategoryChange(): void {
    const cat = this.categories().find((c) => c.id === this.form.categoryId);
    this.formSubcategories.set(cat?.subcategories || []);
    if (cat?.machineId && !this.form.machineId) {
      this.form.machineId = cat.machineId;
    }
  }

  loadItems(): void {
    this.api
      .get('/inventory', {
        search: this.filters.search,
        machineId: this.filters.machineId,
        categoryId: this.filters.categoryId,
        subcategoryId: this.filters.subcategoryId,
        lowStockOnly: this.filters.lowStockOnly ? 'true' : ''
      })
      .subscribe({
        next: (res) => this.items.set(res.data || [])
      });
  }

  downloadBulkTemplate(): void {
    this.api.downloadBlob('/inventory/bulk-template').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk-inventory-tools-template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        this.notify.success('Downloaded bulk-inventory-tools-template.xlsx');
      },
      error: () => this.notify.error('Failed to download Excel template')
    });
  }

  onExcelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.excelBase64.set(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  }

  uploadBulkExcel(): void {
    if (!this.excelBase64()) return;
    this.uploadingExcel.set(true);

    this.api
      .post('/inventory/bulk-excel', { fileBase64: this.excelBase64() })
      .subscribe({
        next: (res) => {
          this.uploadingExcel.set(false);
          this.notify.success(res.message || 'Bulk Excel import completed!');
          this.showBulkExcelModal.set(false);
          this.selectedFileName.set('');
          this.excelBase64.set('');
          this.loadMasterLookups();
          this.loadItems();
        },
        error: (err) => {
          this.uploadingExcel.set(false);
          this.notify.error(err.error?.message || 'Bulk Excel upload failed');
        }
      });
  }

  openCreate(): void {
    this.editingId.set(null);
    const defaultCat = this.categories()[0];
    this.form = {
      itemName: '',
      itemCode: '',
      toolNumber: '',
      machineId: defaultCat?.machineId || '',
      categoryId: defaultCat?.id || '',
      subcategoryId: defaultCat?.subcategories?.[0]?.id || '',
      brand: '',
      modelNumber: '',
      unitOfMeasurement: 'PCS',
      trackingType: 'QUANTITY',
      minimumStockLevel: 10,
      openingStock: 0,
      storageLocation: '',
      description: ''
    };
    this.formSubcategories.set(defaultCat?.subcategories || []);
    this.showForm.set(true);
  }

  openEdit(item: any): void {
    this.editingId.set(item.id);
    const cat = this.categories().find((c) => c.id === item.categoryId);
    this.formSubcategories.set(cat?.subcategories || []);
    this.form = {
      itemName: item.itemName,
      itemCode: item.itemCode,
      toolNumber: item.toolNumber || '',
      machineId: item.machineId || '',
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId || '',
      brand: item.brand || '',
      modelNumber: item.modelNumber || '',
      unitOfMeasurement: item.unitOfMeasurement,
      trackingType: item.trackingType,
      minimumStockLevel: item.minimumStockLevel,
      openingStock: item.openingStock,
      storageLocation: item.storageLocation || '',
      description: item.description || ''
    };
    this.showForm.set(true);
  }

  saveItem(): void {
    const id = this.editingId();
    const payload = {
      ...this.form,
      machineId: this.form.machineId || null,
      subcategoryId: this.form.subcategoryId || null,
      minimumStockLevel: Number(this.form.minimumStockLevel),
      openingStock: Number(this.form.openingStock)
    };

    const req$ = id
      ? this.api.put(`/inventory/${id}`, payload)
      : this.api.post('/inventory', payload);

    req$.subscribe({
      next: () => {
        this.notify.success(
          id ? 'Inventory item updated' : 'Inventory item added'
        );
        this.showForm.set(false);
        this.loadItems();
      },
      error: (err) =>
        this.notify.error(err.error?.message || 'Failed to save inventory item')
    });
  }

  toggleStatus(item: any): void {
    const status = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.api.patch(`/inventory/${item.id}/status`, { status }).subscribe({
      next: () => {
        this.notify.success(`Item ${item.itemName} set to ${status}`);
        this.loadItems();
      }
    });
  }

  viewHistory(item: any): void {
    this.api.get(`/inventory/${item.id}/movements`).subscribe({
      next: (res) => {
        this.selectedItemHistory.set({
          item,
          movements: res.data || []
        });
      }
    });
  }
}
