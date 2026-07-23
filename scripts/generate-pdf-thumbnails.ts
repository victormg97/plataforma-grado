/**
 * Script: Generate thumbnails for all existing PDF resources.
 *
 * This script calls the batch API endpoint repeatedly until all PDFs
 * have thumbnails. It works against a running instance of the app
 * (local dev server or production Vercel deployment).
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. In another terminal: npx tsx scripts/generate-pdf-thumbnails.ts
 *
 *   Or against production (after deploy):
 *   npx tsx scripts/generate-pdf-thumbnails.ts https://your-app.vercel.app
 *
 * Requirements:
 *   - The app must be running (local or production)
 *   - You must be logged in as admin (the script uses a session cookie)
 *
 * Alternative: Use the admin panel directly — the endpoint can be called
 * from the browser console while logged in as admin:
 *
 *   async function generateAll() {
 *     let remaining = 1;
 *     while (remaining > 0) {
 *       const res = await fetch('/api/recursos/generate-all-thumbnails?limit=5', { method: 'POST' });
 *       const data = await res.json();
 *       console.log(data);
 *       remaining = data.remaining ?? 0;
 *       if (data.failed > 0) await new Promise(r => setTimeout(r, 2000));
 *     }
 *     console.log('✅ Done!');
 *   }
 *   generateAll();
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 1000;

async function main() {
  console.log(`🚀 Generating PDF thumbnails via: ${BASE_URL}`);
  console.log(`   Batch size: ${BATCH_SIZE}\n`);

  let remaining = Infinity;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batch = 1;

  while (remaining > 0) {
    console.log(`📦 Batch ${batch}...`);

    const res = await fetch(`${BASE_URL}/api/recursos/generate-all-thumbnails?limit=${BATCH_SIZE}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      console.error(`❌ Request failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(text);
      break;
    }

    const data = await res.json();
    remaining = data.remaining ?? 0;
    totalSuccess += data.success ?? 0;
    totalFailed += data.failed ?? 0;

    if (data.processed?.length) {
      data.processed.forEach((t: string) => console.log(`   ✅ ${t}`));
    }
    if (data.failed > 0) {
      console.log(`   ⚠️  ${data.failed} failed in this batch`);
    }

    console.log(`   → ${remaining} remaining\n`);

    if (remaining > 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
    batch++;
  }

  console.log(`\n🏁 Complete! ${totalSuccess} generated, ${totalFailed} failed.`);
}

main().catch(console.error);
