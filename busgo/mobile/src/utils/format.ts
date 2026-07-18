export function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function money(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return `৳${Number.isInteger(amount) ? amount.toLocaleString() : amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortTime(value: string | null | undefined): string {
  if (!value) return '--:--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 5);
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function reference(value: string | null | undefined): string {
  return value ? value.slice(0, 8).toUpperCase() : '--------';
}

export function secondsRemaining(expiresAt?: string): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Same fallback chain the web app uses for naming the coach on a trip card. */
export function busDisplayName(trip: { bus_name?: string | null; bus_registration_no?: string | null }): string {
  return trip.bus_name?.trim() || trip.bus_registration_no?.trim() || 'Coach assignment pending';
}

export function durationBetween(departure?: string | null, arrival?: string | null): string {
  if (!departure || !arrival) return '';
  const start = new Date(departure).getTime();
  const end = new Date(arrival).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '';
  const totalMinutes = Math.round((end - start) / 60000);
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
