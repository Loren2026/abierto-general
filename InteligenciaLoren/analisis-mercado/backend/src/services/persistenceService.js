const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../config/env');

const SCHEMA_VERSION = 1;
let db;

function nowIso() {
  return new Date().toISOString();
}

function ensureDataDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDb() {
  if (db) return db;

  ensureDataDir(config.sqlitePath);
  db = new Database(config.sqlitePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_positions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      name TEXT,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(profile_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS watchlist_positions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      name TEXT,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(profile_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS valuations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      valuation_json TEXT NOT NULL,
      config_json TEXT,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(profile_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS broker_tariffs (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      tariffs_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fx_rates (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      rates_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS covered_calls (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function stableId(prefix, profileId, key) {
  return `${prefix}:${profileId}:${String(key || 'default').toUpperCase()}`;
}

function normalizeSymbol(item) {
  return String(item?.tk || item?.symbol || item?.ticker || '').trim().toUpperCase();
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function getSnapshot(profileId = config.persistenceProfileId) {
  const database = getDb();
  const profile = database.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);

  if (!profile) {
    return {
      schemaVersion: SCHEMA_VERSION,
      profileId,
      idc7: null,
      valuations: {},
      brokerTariffs: null,
      fxRates: null,
      coveredCalls: [],
      updatedAt: null
    };
  }

  const portfolio = database.prepare('SELECT payload_json FROM portfolio_positions WHERE profile_id = ? ORDER BY symbol').all(profileId).map((row) => parseJson(row.payload_json, null)).filter(Boolean);
  const watchlist = database.prepare('SELECT payload_json FROM watchlist_positions WHERE profile_id = ? ORDER BY symbol').all(profileId).map((row) => parseJson(row.payload_json, null)).filter(Boolean);
  const valuations = Object.fromEntries(database.prepare('SELECT symbol, valuation_json, config_json FROM valuations WHERE profile_id = ? ORDER BY symbol').all(profileId).map((row) => [
    `val_data_${row.symbol}`,
    JSON.stringify({ ...parseJson(row.valuation_json, {}), config: parseJson(row.config_json, parseJson(row.valuation_json, {})?.config || undefined) })
  ]));
  const brokerTariffs = database.prepare('SELECT tariffs_json FROM broker_tariffs WHERE profile_id = ?').get(profileId);
  const fxRates = database.prepare('SELECT rates_json FROM fx_rates WHERE profile_id = ?').get(profileId);
  const coveredCalls = database.prepare('SELECT payload_json FROM covered_calls WHERE profile_id = ? ORDER BY updated_at DESC, symbol').all(profileId).map((row) => parseJson(row.payload_json, null)).filter(Boolean);

  return {
    schemaVersion: profile.schema_version,
    profileId,
    idc7: JSON.stringify({ c: portfolio, p: watchlist }),
    valuations,
    brokerTariffs: brokerTariffs?.tariffs_json || null,
    fxRates: fxRates?.rates_json || null,
    coveredCalls,
    updatedAt: profile.updated_at
  };
}

function putSnapshot(snapshot, profileId = config.persistenceProfileId) {
  const database = getDb();
  const updatedAt = nowIso();
  const idc7 = parseJson(snapshot?.idc7, snapshot?.idc7 || {});
  const portfolio = Array.isArray(idc7?.c) ? idc7.c : [];
  const watchlist = Array.isArray(idc7?.p) ? idc7.p : [];
  const valuations = snapshot?.valuations && typeof snapshot.valuations === 'object' ? snapshot.valuations : {};
  const coveredCalls = Array.isArray(snapshot?.coveredCalls) ? snapshot.coveredCalls : [];

  const tx = database.transaction(() => {
    database.prepare(`
      INSERT INTO profiles (id, label, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, updated_at = excluded.updated_at
    `).run(profileId, 'Loren', SCHEMA_VERSION, updatedAt, updatedAt);

    database.prepare('DELETE FROM portfolio_positions WHERE profile_id = ?').run(profileId);
    database.prepare('DELETE FROM watchlist_positions WHERE profile_id = ?').run(profileId);
    database.prepare('DELETE FROM valuations WHERE profile_id = ?').run(profileId);
    database.prepare('DELETE FROM covered_calls WHERE profile_id = ?').run(profileId);

    const insertPortfolio = database.prepare(`
      INSERT INTO portfolio_positions (id, profile_id, symbol, name, payload_json, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of portfolio) {
      const symbol = normalizeSymbol(item);
      if (!symbol) continue;
      insertPortfolio.run(stableId('portfolio', profileId, symbol), profileId, symbol, item.name || item.n || null, JSON.stringify(item), SCHEMA_VERSION, updatedAt, updatedAt);
    }

    const insertWatchlist = database.prepare(`
      INSERT INTO watchlist_positions (id, profile_id, symbol, name, payload_json, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of watchlist) {
      const symbol = normalizeSymbol(item);
      if (!symbol) continue;
      insertWatchlist.run(stableId('watchlist', profileId, symbol), profileId, symbol, item.name || item.n || null, JSON.stringify(item), SCHEMA_VERSION, updatedAt, updatedAt);
    }

    const insertValuation = database.prepare(`
      INSERT INTO valuations (id, profile_id, symbol, valuation_json, config_json, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [key, raw] of Object.entries(valuations)) {
      const symbol = String(key).replace(/^val_data_/i, '').toUpperCase();
      const value = parseJson(raw, raw || {});
      if (!symbol) continue;
      insertValuation.run(stableId('valuation', profileId, symbol), profileId, symbol, JSON.stringify(value || {}), value?.config ? JSON.stringify(value.config) : null, SCHEMA_VERSION, updatedAt, updatedAt);
    }

    const insertCoveredCall = database.prepare(`
      INSERT INTO covered_calls (id, profile_id, symbol, status, payload_json, schema_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of coveredCalls) {
      const symbol = normalizeSymbol(item);
      if (!symbol) continue;
      const id = item.id || stableId('covered_call', profileId, `${symbol}:${item.expiration || 'no-exp'}:${item.strike || 'no-strike'}:${item.createdAt || updatedAt}`);
      const status = String(item.status || 'open');
      insertCoveredCall.run(id, profileId, symbol, status, JSON.stringify({ ...item, id }), SCHEMA_VERSION, item.createdAt || updatedAt, updatedAt);
    }

    if (snapshot?.brokerTariffs != null) {
      database.prepare(`
        INSERT INTO broker_tariffs (profile_id, tariffs_json, schema_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET tariffs_json = excluded.tariffs_json, schema_version = excluded.schema_version, updated_at = excluded.updated_at
      `).run(profileId, typeof snapshot.brokerTariffs === 'string' ? snapshot.brokerTariffs : JSON.stringify(snapshot.brokerTariffs), SCHEMA_VERSION, updatedAt, updatedAt);
    }

    if (snapshot?.fxRates != null) {
      database.prepare(`
        INSERT INTO fx_rates (profile_id, rates_json, schema_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET rates_json = excluded.rates_json, schema_version = excluded.schema_version, updated_at = excluded.updated_at
      `).run(profileId, typeof snapshot.fxRates === 'string' ? snapshot.fxRates : JSON.stringify(snapshot.fxRates), SCHEMA_VERSION, updatedAt, updatedAt);
    }
  });

  tx();
  return getSnapshot(profileId);
}

module.exports = { SCHEMA_VERSION, getSnapshot, putSnapshot };
