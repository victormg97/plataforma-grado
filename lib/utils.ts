import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags from a string, returning plain text. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
