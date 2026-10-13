// Armazenamento estruturado no navegador para o mockup.
// Substitui a complexidade de um banco relacional por coleções diretas em memória/armazenamento local.

import { TABLE_NAMES } from './schema.js';

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

function emptyData() {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, {}]));
}

export class Database {
  /**
   * @param {{load:Function, save:Function, clear:Function}} adapter
   * @param {{onStatement?:(sql:string, source?:string)=>void}} [opts]
   */
  constructor(adapter, { onStatement = () => {} } = {}) {
    this.adapter = adapter;
    this.onStatement = onStatement;
    this.source = 'api';
    const loaded = adapter.load();
    this.data = { ...emptyData(), ...(loaded || {}) };
  }

  _table(name) {
    if (!(name in this.data)) throw new Error(`Tabela inexistente: ${name}`);
    return this.data[name];
  }

  _persist() {
    this.adapter.save(this.data);
  }

  _log(action) {
    this.onStatement(action, this.source);
  }

  async insert(table, row) {
    const t = this._table(table);
    if (row.id == null) throw new Error(`INSERT em ${table} sem id`);
    if (t[row.id]) throw new Error(`Chave duplicada em ${table}: ${row.id}`);
    t[row.id] = clone(row);
    this._persist();
    this._log(`insert:${table}`);
    return clone(row);
  }

  async upsert(table, row) {
    const t = this._table(table);
    t[row.id] = clone({ ...(t[row.id] || {}), ...row });
    this._persist();
    this._log(`upsert:${table}`);
    return clone(t[row.id]);
  }

  async get(table, id) {
    this._log(`get:${table}`);
    return clone(this._table(table)[id] ?? null);
  }

  async all(table) {
    this._log(`all:${table}`);
    return Object.values(this._table(table)).map(clone);
  }

  async where(table, cond) {
    this._log(`where:${table}`);
    const keys = Object.keys(cond);
    return Object.values(this._table(table)).filter((r) => keys.every((k) => r[k] === cond[k])).map(clone);
  }

  async update(table, id, patch) {
    const t = this._table(table);
    if (!t[id]) throw new Error(`Linha inexistente em ${table}: ${id}`);
    t[id] = clone({ ...t[id], ...patch });
    this._persist();
    this._log(`update:${table}`);
    return clone(t[id]);
  }

  async remove(table, id) {
    delete this._table(table)[id];
    this._persist();
    this._log(`delete:${table}`);
  }

  async count(table) {
    return Object.keys(this._table(table)).length;
  }

  dump() {
    return clone(this.data);
  }

  reset() {
    this.data = emptyData();
    this.adapter.clear();
    this._log('reset');
  }
}
