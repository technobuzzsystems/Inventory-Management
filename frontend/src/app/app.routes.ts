import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MachinesComponent } from './features/machines/machines.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { InventoryComponent } from './features/inventory/inventory.component';
import { StockOpsComponent } from './features/stock-ops/stock-ops.component';
import { IssuesComponent } from './features/issues/issues.component';
import { ReturnsComponent } from './features/returns/returns.component';
import { EmployeesComponent } from './features/employees/employees.component';
import { ReportsComponent } from './features/reports/reports.component';
import { AuditLogsComponent } from './features/audit-logs/audit-logs.component';
import { UsersComponent } from './features/users/users.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'machines', component: MachinesComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'stock-ops', component: StockOpsComponent },
      { path: 'issues', component: IssuesComponent },
      { path: 'returns', component: ReturnsComponent },
      { path: 'employees', component: EmployeesComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
      { path: 'users', component: UsersComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
