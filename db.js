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
  listInv: db.prepare(`SELECT item, qty FROM inventories WHERE character_id=? ORDER BY item`),
  upsertPending: db.prepare(`
    INSERT INTO pending (message_id,user_id,name) VALUES (?,?,?)
    ON CONFLICT(message_id) DO UPDATE SET user_id=excluded.user_id, name=excluded.name
  `),
  getPending: db.prepare(`SELECT user_id, name FROM pending WHERE message_id=?`),
  delPending: db.prepare(`DELETE FROM pending WHERE message_id=?`),
  top25: db.prepare(`SELECT name, money, user_id, slot FROM characters ORDER BY money DESC, id ASC LIMIT 25`),
  listShop: db.prepare(`SELECT name, price, COALESCE(description,'') AS description, COALESCE(one_time,0) AS one_time FROM shop_items ORDER BY name`),
  getShopItemByName: db.prepare(`SELECT id, name, price, COALESCE(description,'') AS description, COALESCE(one_time,0) AS one_time FROM shop_items WHERE name = ? COLLATE NOCASE`),

  upsertInventory: db.prepare(`
    INSERT INTO inventories (character_id, item, qty) VALUES (?,?,?)
    ON CONFLICT(character_id,item) DO UPDATE SET qty = inventories.qty + excluded.qty
  `),
  setInventoryToOne: db.prepare(`
    INSERT INTO inventories (character_id, item, qty) VALUES (?,?,1)
    ON CONFLICT(character_id,item) DO UPDATE SET qty = 1
  `),
  checkOwned: db.prepare(`SELECT 1 FROM inventories WHERE character_id=? AND item=? LIMIT 1`),
  trySpend: db.prepare(`UPDATE characters SET money = money - ? WHERE id = ? AND money >= ?`),
  getInvQty: db.prepare(`SELECT qty FROM inventories WHERE character_id=? AND item=?`),
  decInventory: db.prepare(`UPDATE inventories SET qty = qty - ? WHERE character_id=? AND item=?`),
  delInventoryRow: db.prepare(`DELETE FROM inventories WHERE character_id=? AND item=?`),
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

// Add/Remove inventory transactions
const addItemTx = db.transaction((charId, item, qty) => {
  q.upsertInventory.run(charId, item, qty);
  const row = q.getInvQty.get(charId, item);
  return { ok: true, qty: row?.qty ?? 0 };
});

const removeItemTx = db.transaction((charId, item, qty) => {
  const row = q.getInvQty.get(charId, item);
  const current = row?.qty ?? 0;
  if (!row) return { ok: false, reason: "not_owned", qty: 0 };
  if (current < qty) return { ok: false, reason: "not_enough", qty: current };

  if (current === qty) {
    q.delInventoryRow.run(charId, item);
    return { ok: true, qty: 0, removedAll: true };
  } else {
    q.decInventory.run(qty, charId, item);
    return { ok: true, qty: current - qty, removedAll: false };
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
export function giveItem(charId, item, qty) {
  return addItemTx(charId, item, qty);
}

export function removeItem(charId, item, qty) {
  return removeItemTx(charId, item, qty);
}