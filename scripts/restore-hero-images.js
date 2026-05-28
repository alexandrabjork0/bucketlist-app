#!/usr/bin/env node
// Restores heroImageUrl for curated experiences that were corrupted by user-upload overwriting.
// Safe to re-run: skips docs where heroImageUrl already matches the curated value.
//
// Run: node scripts/restore-hero-images.js
// Requires: scripts/serviceAccountKey.json

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('\nError: serviceAccountKey.json not found.');
  console.error('Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key');
  console.error('Save it to: scripts/serviceAccountKey.json\n');
  process.exit(1);
}

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

async function main() {
  const photoCache = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed/photo-cache.json'), 'utf8')
  );
  const seedExperiences = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'seed/experiences.json'), 'utf8')
  );

  // Build slug → curated URL map.
  // photo-cache.json is primary (fresh Unsplash fetches); experiences.json is fallback.
  const curatedImages = {};

  for (const exp of seedExperiences) {
    if (exp.heroImageUrl) curatedImages[exp.slug] = exp.heroImageUrl;
  }
  // photo-cache overrides seed file (more recent fetches)
  for (const [slug, url] of Object.entries(photoCache)) {
    if (url) curatedImages[slug] = url;
  }

  const slugs = Object.keys(curatedImages);
  console.log(`\nChecking ${slugs.length} curated experience slugs…\n`);

  let updated = 0;
  let alreadyCorrect = 0;
  let skippedUserCreated = 0;
  let notFound = 0;

  for (const slug of slugs) {
    const targetUrl = curatedImages[slug];
    const ref = db.collection('experiences').doc(slug);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`  NOT FOUND   ${slug}`);
      notFound++;
      continue;
    }

    const data = snap.data();

    // Never touch user-created experiences
    if (data.source === 'user') {
      console.log(`  USER-SKIP   ${slug}`);
      skippedUserCreated++;
      continue;
    }

    if (data.heroImageUrl === targetUrl) {
      alreadyCorrect++;
      continue;
    }

    const oldUrl = data.heroImageUrl
      ? data.heroImageUrl.slice(0, 60) + '…'
      : '(none)';
    const newUrl = targetUrl.slice(0, 60) + '…';

    await ref.update({ heroImageUrl: targetUrl });
    console.log(`  UPDATED     ${slug}`);
    console.log(`    was: ${oldUrl}`);
    console.log(`    now: ${newUrl}`);
    updated++;
  }

  console.log(`
─────────────────────────────────────────
  Updated:          ${updated}
  Already correct:  ${alreadyCorrect}
  Skipped (user):   ${skippedUserCreated}
  Not found:        ${notFound}
─────────────────────────────────────────
Done.
`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
