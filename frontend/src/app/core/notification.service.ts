import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  public toasts = signal<ToastMessage[]>([]);
  private nextId = 1;

  show(text: string, type: 'success' | 'error' | 'info' = 'success'): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, text }]);
    setTimeout(() => this.dismiss(id), 4500);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
