import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STORE_MANAGER' | 'EMPLOYEE';
  roleDisplayName?: string;
  employeeId?: string | null;
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = 'http://localhost:5000/api/auth';
  public currentUser = signal<UserProfile | null>(this.loadStoredUser());

  constructor(private http: HttpClient, private router: Router) {}

  private loadStoredUser(): UserProfile | null {
    const raw = localStorage.getItem('inv_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  get accessToken(): string | null {
    return localStorage.getItem('inv_access_token');
  }

  get refreshToken(): string | null {
    return localStorage.getItem('inv_refresh_token');
  }

  login(usernameOrEmail: string, password: string): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/login`, { usernameOrEmail, password })
      .pipe(
        tap((res) => {
          if (res.success && res.data) {
            localStorage.setItem('inv_access_token', res.data.accessToken);
            localStorage.setItem('inv_refresh_token', res.data.refreshToken);
            localStorage.setItem('inv_user', JSON.stringify(res.data.user));
            this.currentUser.set(res.data.user);
          }
        })
      );
  }

  refreshSession(): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/refresh`, {
        refreshToken: this.refreshToken
      })
      .pipe(
        tap((res) => {
          if (res.success && res.data) {
            localStorage.setItem('inv_access_token', res.data.accessToken);
            localStorage.setItem('inv_refresh_token', res.data.refreshToken);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem('inv_access_token');
    localStorage.removeItem('inv_refresh_token');
    localStorage.removeItem('inv_user');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(...roles: string[]): boolean {
    const u = this.currentUser();
    if (!u) return false;
    if (u.role === 'SUPER_ADMIN') return true;
    return roles.includes(u.role);
  }
}
