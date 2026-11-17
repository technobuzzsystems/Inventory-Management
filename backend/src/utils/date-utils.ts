import { env } from '../config/env';

/**
 * Formats a Date into Asia/Kolkata display string: DD-MM-YYYY HH:mm:ss IST
 */
export function formatISTDateTime(date?: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: env.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Formats a Date into Asia/Kolkata date string: YYYY-MM-DD
 */
export function formatISTDateOnly(date?: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
  return parts;
}

/**
 * Returns current time string in Asia/Kolkata (HH:mm)
 */
export function getCurrentISTTimeString(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: env.TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

/**
 * Calculates Days Held according to business rules:
 * - Active/Unreturned: Current Date - Issue Date
 * - Completed return: Actual Final Return Date - Issue Date
 */
export function calculateDaysHeld(
  issueDate: Date | string,
  actualFinalReturnDate?: Date | string | null
): number {
  const startStr = formatISTDateOnly(issueDate);
  const endStr = actualFinalReturnDate
    ? formatISTDateOnly(actualFinalReturnDate)
    : formatISTDateOnly(new Date());

  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Checks if an issue or item with pending quantity > 0 is past its expected return date in Asia/Kolkata
 */
export function isPastExpectedDate(
  expectedReturnDate: Date | string,
  pendingQuantity: number
): boolean {
  if (pendingQuantity <= 0) return false;
  const expectedStr = formatISTDateOnly(expectedReturnDate);
  const todayStr = formatISTDateOnly(new Date());
  return todayStr > expectedStr;
}

/**
 * Generates unique reference codes for SKU, Transactions, Issues, Returns, Adjustments
 */
export function generateReferenceCode(prefix: string): string {
  const now = new Date();
  const datePart = formatISTDateOnly(now).replace(/-/g, '');
  const randPart = Math.floor(1000 + Math.random() * 9000);
  const msPart = String(now.getMilliseconds()).padStart(3, '0');
  return `${prefix}-${datePart}-${msPart}${randPart}`;
}
