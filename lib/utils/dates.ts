import { format, parseISO, isToday, isTomorrow, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatFecha(fecha: string): string {
  return format(parseISO(fecha), "d 'de' MMMM, yyyy", { locale: es });
}

export function formatFechaCorta(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy', { locale: es });
}

export function formatHora(hora: string): string {
  return hora.slice(0, 5);
}

export function formatRangoHora(inicio: string, fin: string): string {
  return `${formatHora(inicio)} - ${formatHora(fin)}`;
}

export function esHoy(fecha: string): boolean {
  return isToday(parseISO(fecha));
}

export function esManana(fecha: string): boolean {
  return isTomorrow(parseISO(fecha));
}

export function esPasado(fecha: string): boolean {
  return isPast(parseISO(fecha));
}

export function esFuturo(fecha: string): boolean {
  return isFuture(parseISO(fecha));
}
