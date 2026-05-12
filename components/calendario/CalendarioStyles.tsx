/**
 * Shared FullCalendar CSS styles for all calendar views.
 * Renders a <style> tag that themes FullCalendar using the app's CSS variables.
 *
 * Usage: <CalendarioStyles containerClass=".calendario-profesor" />
 */
export function CalendarioStyles({ containerClass }: { containerClass: string }) {
  return (
    <style>{`
      ${containerClass} .fc {
        --fc-border-color: var(--color-border);
        --fc-page-bg-color: var(--color-bg);
        --fc-neutral-bg-color: var(--color-bg-secondary);
        --fc-today-bg-color: color-mix(in srgb, var(--color-brand-gold) 8%, transparent);
        --fc-event-border-color: transparent;
        font-family: var(--font-body);
      }
      ${containerClass} .fc .fc-toolbar-title {
        font-family: var(--font-display);
        font-size: 1.25rem;
        color: var(--color-text-primary);
        text-transform: capitalize;
      }
      ${containerClass} .fc .fc-button {
        background: var(--color-bg-secondary);
        border-color: var(--color-border);
        color: var(--color-text-primary);
        font-size: 0.8rem;
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-md);
        font-weight: 500;
      }
      ${containerClass} .fc .fc-button:hover {
        background: var(--color-brand-gold-muted);
        border-color: var(--color-brand-gold);
      }
      ${containerClass} .fc .fc-button-active,
      ${containerClass} .fc .fc-button.fc-button-active {
        background: var(--color-brand-gold) !important;
        border-color: var(--color-brand-gold) !important;
        color: var(--color-brand-black) !important;
      }
      ${containerClass} .fc .fc-col-header-cell {
        padding: 0.5rem 0;
        font-weight: 600;
        text-transform: capitalize;
        color: var(--color-text-secondary);
        font-size: 0.8rem;
      }
      ${containerClass} .fc .fc-daygrid-day-number {
        color: var(--color-text-primary);
        font-size: 0.85rem;
        padding: 4px 8px;
      }
      ${containerClass} .fc .fc-event {
        border-radius: 6px;
        padding: 2px 6px;
        font-size: 0.75rem;
        cursor: pointer;
        border: none;
      }
      ${containerClass} .fc .fc-list-event:hover td {
        background: var(--color-bg-secondary);
      }
      ${containerClass} .fc .fc-list-table {
        width: 100%;
      }
      ${containerClass} .fc .fc-list-event-time {
        white-space: nowrap;
      }
      ${containerClass} .fc .fc-list-event-graphic {
        width: 1.5rem;
        text-align: center;
      }
      ${containerClass} .fc .fc-list-event-title {
        overflow: hidden;
      }
      ${containerClass} .fc .fc-scrollgrid {
        border-color: var(--color-border);
      }
      ${containerClass} .fc .fc-descargar-button {
        padding: 0.25rem 0.5rem;
      }
      @media (max-width: 640px) {
        ${containerClass} .fc .fc-toolbar-title {
          font-size: 0.95rem;
        }
        ${containerClass} .fc .fc-button {
          font-size: 0.7rem;
          padding: 0.2rem 0.45rem;
        }
        ${containerClass} .fc .fc-toolbar.fc-header-toolbar {
          gap: 0.35rem;
        }
      }
    `}</style>
  );
}
