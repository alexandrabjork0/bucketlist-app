#!/usr/bin/env node
// Run: node scripts/seed-experiences.js
// Requires: scripts/serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts

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

const app = initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore(app);

const BATCH_SIZE = 400;

function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

async function seedFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(raw) ? raw : [raw];

  console.log(`\nSeeding ${records.length} records from ${path.basename(filePath)}`);

  let batch = db.batch();
  let written = 0;
  let skipped = 0;
  let batchCount = 0;

  for (const record of records) {
    const slug = record.slug || toSlug(record.title);
    const ref = db.collection('experiences').doc(slug);

    const snap = await ref.get();
    if (snap.exists) {
      skipped++;
      continue;
    }

    batch.set(ref, {
      title: record.title,
      slug,
      category: record.category,
      country: record.country || null,
      continent: record.continent || null,
      region: record.region || null,
      city: record.city || null,
      description: record.description || '',
      tags: record.tags || [],
      heroImageUrl: record.heroImageUrl || null,
      savesCount: 0,
      completionsCount: 0,
      trending: record.trending || false,
      relatedIds: [],
      isVerified: true,
      source: 'curated',
      difficulty: record.difficulty || null,
      priceRange: record.priceRange || null,
      season: record.season || null,
      duration: record.duration || null,
      bookingUrl: null,
      affiliateUrl: null,
      partnerName: null,
      monetizationType: null,
      createdBy: null,
      createdAt: new Date(),
    });

    written++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed ${written} docs...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  Done: ${written} written, ${skipped} already existed`);
  return { written, skipped };
}

async function main() {
  const seedDir = path.join(__dirname, 'seed');

  if (!fs.existsSync(seedDir)) {
    console.error(`Seed directory not found: ${seedDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(seedDir).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.error('No JSON files found in scripts/seed/');
    process.exit(1);
  }

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const { written, skipped } = await seedFile(path.join(seedDir, file));
    totalWritten += written;
    totalSkipped += skipped;
  }

  console.log(`\nFinished: ${totalWritten} written, ${totalSkipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
