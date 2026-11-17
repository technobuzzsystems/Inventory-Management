import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  public readonly baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  private buildParams(query?: Record<string, any>): HttpParams {
    let params = new HttpParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params = params.set(k, String(v));
        }
      });
    }
    return params;
  }

  get<T = any>(path: string, query?: Record<string, any>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      params: this.buildParams(query)
    });
  }

  post<T = any>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  put<T = any>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T = any>(path: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  downloadBlob(path: string, query?: Record<string, any>): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, {
      params: this.buildParams(query),
      responseType: 'blob'
    });
  }
}
