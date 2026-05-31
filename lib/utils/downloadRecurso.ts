/**
 * Robust file download for shared resources.
 *
 * Flow:
 *  1. Request a short-lived signed URL from the download API.
 *     The API sets Content-Disposition: attachment, so the browser
 *     downloads the file instead of navigating to it.
 *  2. Trigger the download.
 *
 * Why not just `a.click()` after an awaited fetch?
 *  After an `await`, some browsers/security configs (e.g. hardened Edge,
 *  certain extensions) drop the "user activation" from the original click,
 *  so a synthetic `a.click()` is silently blocked.
 *
 *  Because the signed URL already carries Content-Disposition: attachment,
 *  assigning it to a hidden iframe (or window.location) reliably starts the
 *  download without depending on a trusted synthetic click. The iframe
 *  approach keeps the current page/SPA state intact.
 */
export async function downloadRecurso(recursoId: string): Promise<void> {
  const res = await fetch(`/api/recursos/${recursoId}/download?action=download`);
  if (!res.ok) throw new Error('download_failed');
  const { url } = await res.json();
  if (!url) throw new Error('no_url');

  triggerBrowserDownload(url);
}

/**
 * Starts a browser download for a URL that responds with
 * Content-Disposition: attachment.
 *
 * Uses a hidden iframe so the SPA isn't navigated away. Falls back to
 * an anchor click if iframe creation fails for any reason.
 */
export function triggerBrowserDownload(url: string): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    // Clean up after the download has had time to start.
    window.setTimeout(() => {
      iframe.remove();
    }, 60_000);
  } catch {
    // Fallback: direct navigation in a new context.
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
