const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { SCHEMA } = require('./schema');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'docexchange.db');

let db;

function getDb() {
    if (!db) {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.exec(SCHEMA);
        console.log('✅ Database initialized');
    }
    return db;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = { getDb, closeDb };
