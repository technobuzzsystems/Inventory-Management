import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'istDate',
  standalone: true
})
export class IstDatePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    mode: 'datetime' | 'date' = 'datetime'
  ): string {
    if (!value) return '-';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '-';

    if (mode === 'date') {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);
    }

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  }
}
