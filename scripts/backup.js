#!/usr/bin/env node
/**
 * Equishow Backup Script
 * Exports local data to JSON format for backup
 * Usage: node scripts/backup.js
 */

const fs = require('fs');
const path = require('path');

// Import store data
const {
  userStore,
  chevauxStore,
  concoursStore,
  coachAnnoncesStore,
  transportsStore,
  boxesStore
} = require('../expo_app/data/store.ts');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'backups');

// Create backup directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Backup data structure
const backupData = {
  timestamp: new Date().toISOString(),
  version: '1.0.0',
  data: {
    user: userStore,
    chevaux: chevauxStore.list,
    concours: concoursStore.list,
    coachAnnonces: coachAnnoncesStore.list,
    transports: transportsStore.list,
    boxes: boxesStore.list,
  }
};

// Write backup file
const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

// Keep only last 10 backups
const files = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('backup-'))
  .sort()
  .reverse();

if (files.length > 10) {
  files.slice(10).forEach(file => {
    fs.unlinkSync(path.join(backupDir, file));
  });
}

console.log(`✅ Backup created: ${backupFile}`);
console.log(`📊 Data summary:`);
console.log(`   - Chevaux: ${backupData.data.chevaux.length}`);
console.log(`   - Concours: ${backupData.data.concours.length}`);
console.log(`   - Coach Annonces: ${backupData.data.coachAnnonces.length}`);
console.log(`   - Transports: ${backupData.data.transports.length}`);
console.log(`   - Boxes: ${backupData.data.boxes.length}`);
console.log(`📂 Kept last 10 backups (${files.length} total)`);
