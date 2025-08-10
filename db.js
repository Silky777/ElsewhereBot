import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "data.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = wal");
db.pragma("foreign_keys = ON");

export function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT NOT NULL,
      slot      INTEGER NOT NULL CHECK (slot IN (1,2,3)),
      name      TEXT NOT NULL,
      money     INTEGER NOT NULL DEFAULT 0,
      UNIQUE (user_id, slot)
    );
    CREATE TABLE IF NOT EXISTS inventories (
      character_id INTEGER NOT NULL,
      item   TEXT NOT NULL,
      qty    INTEGER NOT NULL CHECK (qty >= 0),
      one_time INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (character_id, item),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pending (
      message_id TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      price INTEGER NOT NULL CHECK(price >= 0),
      description TEXT
      one_time INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventories_char_item
      ON inventories(character_id, item);
  `);
  // Migrate older DBs missing inventories.one_time
  try { db.exec(`ALTER TABLE inventories ADD COLUMN one_time INTEGER NOT NULL DEFAULT 0`); } catch {}
}

init();

export const q = {
  getCharsByUser: db.prepare(`SELECT id, slot, name, money FROM characters WHERE user_id=? ORDER BY slot`),
  getCharByUserSlot: db.prepare(`SELECT * FROM characters WHERE user_id=? AND slot=?`),
  insertChar: db.prepare(`INSERT INTO characters (user_id,slot,name,money) VALUES (?,?,?,0)`),
  findCharByName: db.prepare(`SELECT id, slot FROM characters WHERE user_id=? AND name=?`),
  deleteInvByChar: db.prepare(`DELETE FROM inventories WHERE character_id=?`),
  deleteCharById: db.prepare(`DELETE FROM characters WHERE id=?`),
  renameCharBySlot: db.prepare(`UPDATE characters SET name=? WHERE user_id=? AND slot=?`),
  listInv: db.prepare(`SELECT item, qty, one_time FROM inventories WHERE character_id=? ORDER BY item`),
  upsertInventory: db.prepare(`
    INSERT INTO inventories (character_id, item, qty, one_time) VALUES (?,?,?,0)
    ON CONFLICT(character_id,item) DO UPDATE SET
      qty = CASE WHEN inventories.one_time = 1 THEN inventories.qty ELSE inventories.qty + excluded.qty END,
      one_time = inventories.one_time
  `),
  setInventoryToOne: db.prepare(`
    INSERT INTO inventories (character_id, item, qty, one_time) VALUES (?,?,1,1)
    ON CONFLICT(character_id,item) DO UPDATE SET qty = 1, one_time = 1
  `),
  getInvQty: db.prepare(`SELECT qty FROM inventories WHERE character_id=? AND item=?`),
  decInventory: db.prepare(`UPDATE inventories SET qty = qty - ? WHERE character_id=? AND item=?`),
  delInventoryRow: db.prepare(`DELETE FROM inventories WHERE character_id=? AND item=?`),
  findInvNameNoCase: db.prepare(`SELECT item FROM inventories WHERE character_id=? AND item = ? COLLATE NOCASE LIMIT 1`),
  getInvRowNoCase: db.prepare(`SELECT item, qty, one_time FROM inventories WHERE character_id=? AND item = ? COLLATE NOCASE LIMIT 1`),
};

// Atomic purchase: deduct if enough, then add inventory
const purchaseTx = db.transaction((charId, itemName, qty, totalCost, oneTime) => {
  if (oneTime) {
    const owned = q.checkOwned.get(charId, itemName);
    if (owned) return { ok: false, reason: "already_owned" };
  }
  const res = q.trySpend.run(totalCost, charId, totalCost);
  if (res.changes === 0) return { ok: false, reason: "insufficient_funds" };

  if (oneTime) q.setInventoryToOne.run(charId, itemName);
  else q.upsertInventory.run(charId, itemName, qty);

  return { ok: true };
});

// Replace add/remove item transactions with case-insensitive resolution
const addItemTx = db.transaction((charId, rawItem, qty, oneTime) => {
  const item = (rawItem ?? "").trim();
  const existing = q.findInvNameNoCase.get(charId, item);
  const actual = existing?.item ?? item;
  if (oneTime) q.setInventoryToOne.run(charId, actual);
  else q.upsertInventory.run(charId, actual, qty);
  const row = q.getInvRowNoCase.get(charId, actual);
  return { ok: true, qty: row?.qty ?? 0, item: actual, one_time: !!row?.one_time };
});

const removeItemTx = db.transaction((charId, rawItem, qty) => {
  const item = (rawItem ?? "").trim();
  const row = q.getInvRowNoCase.get(charId, item);
  if (!row) return { ok: false, reason: "not_owned", qty: 0 };
  const actual = row.item;

  if (row.one_time) {
    q.delInventoryRow.run(charId, actual);
    return { ok: true, qty: 0, removedAll: true, one_time: true, item: actual };
  }

  if (row.qty < qty) return { ok: false, reason: "not_enough", qty: row.qty };

  if (row.qty === qty) {
    q.delInventoryRow.run(charId, actual);
    return { ok: true, qty: 0, removedAll: true, item: actual };
  } else {
    q.decInventory.run(qty, charId, actual);
    return { ok: true, qty: row.qty - qty, removedAll: false, item: actual };
  }
});

export const getCharsByUser = (uid) => q.getCharsByUser.all(uid);
export const getCharByUserSlot = (uid, slot) => q.getCharByUserSlot.get(uid, slot);
export const createChar = (uid, slot, name) => { q.insertChar.run(uid, slot, name); return getCharByUserSlot(uid, slot); };
export const deleteCharByName = (uid, name) => {
  const row = q.findCharByName.get(uid, name);
  if (!row) return { deleted:false };
  const txn = db.transaction((id)=>{ q.deleteInvByChar.run(id); q.deleteCharById.run(id); });
  txn(row.id);
  return { deleted:true, slot: row.slot };
};
export const renameChar = (uid, slot, newName) => ({ ok: q.renameCharBySlot.run(newName, uid, slot).changes > 0 });
export const listInventory = (charId) => q.listInv.all(charId);
export const savePending = (msgId, uid, name) => q.upsertPending.run(msgId, uid, name);
export const getPending = (msgId) => q.getPending.get(msgId);
export const clearPending = (msgId) => q.delPending.run(msgId);
export function top25Characters() {
  return q.top25.all();
}
export const listShopItems = () => q.listShop.all();
export const getShopItemByName = (name) => q.getShopItemByName.get(name);
export function purchaseItem(charId, itemName, qty, totalCost, oneTime = false) { return purchaseTx(charId, itemName, qty, totalCost, !!oneTime); }
export function giveItem(charId, item, qty, oneTime = false) {
  return addItemTx(charId, item, qty, !!oneTime);
}

export function removeItem(charId, item, qty) {
  return removeItemTx(charId, item, qty);
}