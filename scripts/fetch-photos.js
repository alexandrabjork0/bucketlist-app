#!/usr/bin/env node
// Fetch cover photos from Unsplash and write heroImageUrl to Firestore.
//
// Usage:
//   UNSPLASH_KEY=your_access_key node scripts/fetch-photos.js
//
// Rate limits:
//   Demo app:       50 req/hour  → set PHOTO_DELAY_MS=75000 (default)
//   Production app: 5000 req/hour → set PHOTO_DELAY_MS=1000
//
// Safe to interrupt and re-run — progress is saved to scripts/seed/photo-cache.json
// after every successful fetch.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const CACHE_PATH = path.join(__dirname, 'seed', 'photo-cache.json');
const SEED_PATH = path.join(__dirname, 'seed', 'experiences.json');

const UNSPLASH_KEY = process.env.UNSPLASH_KEY || '';
const DELAY_MS = parseInt(process.env.PHOTO_DELAY_MS || '75000', 10);

// ── Validation ────────────────────────────────────────────────────────────────

if (!UNSPLASH_KEY) {
  console.error('\nMissing UNSPLASH_KEY.');
  console.error('1. Create a free account at https://unsplash.com/developers');
  console.error('2. Create a new application to get an Access Key');
  console.error('3. Run: UNSPLASH_KEY=your_access_key node scripts/fetch-photos.js\n');
  process.exit(1);
}

if (!fs.existsSync(KEY_PATH)) {
  console.error('\nMissing scripts/serviceAccountKey.json');
  console.error('Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key\n');
  process.exit(1);
}

const app = initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// Build a focused 3-4 word Unsplash query from an experience.
// Strips filler verbs/articles so the visual search is specific.
function buildQuery(experience) {
  const skip = new Set([
    'a', 'an', 'the', 'in', 'at', 'on', 'of', 'to', 'by', 'and', 'or',
    'for', 'with', 'from', 'its', 'this', 'that', 'your', 'my',
    'see', 'go', 'visit', 'watch', 'take', 'eat', 'drink', 'attend',
    'do', 'complete', 'learn', 'make', 'swim', 'hike', 'climb', 'ride',
    'walk', 'run', 'live', 'sleep', 'build', 'write', 'read', 'perform',
    'try', 'experience', 'explore', 'discover', 'find',
  ]);

  const words = experience.title
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => !skip.has(w) && w.length > 2)
    .slice(0, 4);

  return words.join(' ') || experience.category.toLowerCase();
}

function fetchPhoto(query) {
  return new Promise((resolve, reject) => {
    const url =
      `https://api.unsplash.com/photos/random` +
      `?query=${encodeURIComponent(query)}` +
      `&orientation=portrait` +
      `&content_filter=high` +
      `&client_id=${UNSPLASH_KEY}`;

    https
      .get(url, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const json = JSON.parse(raw);
            // urls.regular is 1080px wide — right size for hero images
            resolve(json.urls?.regular || null);
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`${res.statusCode}: ${raw.slice(0, 120)}`));
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad(n, width) {
  return String(n).padStart(width, ' ');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const experiences = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const cache = loadCache();

  const pending = experiences.filter((exp) => !(exp.slug in cache));
  const done = experiences.length - pending.length;

  console.log(`\n${experiences.length} experiences total`);
  console.log(`${done} already cached, ${pending.length} to fetch`);

  if (pending.length > 0) {
    const mins = Math.ceil((pending.length * DELAY_MS) / 60000);
    console.log(`Delay: ${DELAY_MS / 1000}s between requests (~${mins} min total)`);
    if (DELAY_MS >= 60000) {
      console.log('Tip: Apply for Unsplash Production access (free) to set PHOTO_DELAY_MS=1000\n');
    } else {
      console.log('');
    }
  }

  let fetched = 0;
  let missed = 0;

  for (let i = 0; i < pending.length; i++) {
    const exp = pending[i];
    const query = buildQuery(exp);
    const progress = `[${pad(i + 1, pending.length.toString().length)}/${pending.length}]`;

    process.stdout.write(`  ${progress} "${exp.title}"\n           query: "${query}" ... `);

    try {
      const url = await fetchPhoto(query);

      if (url) {
        cache[exp.slug] = url;
        fetched++;
        console.log('✓');
      } else {
        // Fallback: retry with just the category
        const fallbackUrl = await fetchPhoto(exp.category.toLowerCase());
        cache[exp.slug] = fallbackUrl || null;
        if (fallbackUrl) {
          fetched++;
          console.log('✓ (category fallback)');
        } else {
          missed++;
          console.log('no result');
        }
      }

      saveCache(cache); // persist after every fetch so progress survives interruption

    } catch (err) {
      missed++;
      console.log(`\n  Error: ${err.message}`);

      if (err.message.startsWith('401') || err.message.startsWith('403')) {
        console.error('\nAPI key rejected — check your UNSPLASH_KEY.\n');
        process.exit(1);
      }

      if (err.message.startsWith('429')) {
        console.error('\nRate limit hit. Wait an hour and re-run (cached progress is saved).\n');
        process.exit(1);
      }
    }

    // Don't sleep after the last item
    if (i < pending.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  if (pending.length > 0) {
    console.log(`\nFetch done: ${fetched} photos, ${missed} without a match`);
  }

  // ── Sync to Firestore ──────────────────────────────────────────────────────

  console.log('\nUpdating Firestore...');

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;

  for (const [slug, photoUrl] of Object.entries(cache)) {
    if (!photoUrl) continue;
    batch.update(db.collection('experiences').doc(slug), { heroImageUrl: photoUrl });
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  Updated ${updated} documents`);

  // ── Write URLs back into the seed JSON ────────────────────────────────────
  // So future re-seeds don't need a separate photo fetch pass.

  const updated_seed = experiences.map((exp) => ({
    ...exp,
    heroImageUrl: cache[exp.slug] || exp.heroImageUrl || null,
  }));
  fs.writeFileSync(SEED_PATH, JSON.stringify(updated_seed, null, 2));
  console.log('  Wrote heroImageUrl back into experiences.json');
  console.log('\nDone.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
