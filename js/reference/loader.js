// Carga inicial do catálogo institucional e dos exemplos de processos (dados FICTÍCIOS).
// O catálogo alimenta o prompt e os avisos da verificação; os exemplos entram no prompt (few-shot).
import { CATALOG_SEED, EXAMPLES_SEED } from './seed.js';

const CATALOG_TABLES = { setores: 'catalogo_setores', sistemas: 'catalogo_sistemas', taxas: 'catalogo_taxas', documentos: 'catalogo_documentos' };

async function insertIfMissing(db, table, row) {
  if (await db.get(table, row.id)) return false;
  await db.insert(table, row);
  return true;
}

export async function loadInitial(db, trace) {
  trace?.call('reference', 'db', 'carga inicial do catálogo e dos exemplos');
  const prev = db.source;
  db.source = 'reference';
  const report = { inseridos: {}, exemplos: 0 };
  try {
    for (const [key, table] of Object.entries(CATALOG_TABLES)) {
      let n = 0;
      for (const row of CATALOG_SEED[key]) if (await insertIfMissing(db, table, row)) n++;
      report.inseridos[key] = n;
    }
    for (const ex of EXAMPLES_SEED) if (await insertIfMissing(db, 'exemplos', ex)) report.exemplos++;
  } finally { db.source = prev; }
  trace?.reply('db', 'reference', `${Object.values(report.inseridos).reduce((a, b) => a + b, 0)} itens de catálogo e ${report.exemplos} exemplos`);
  return report;
}
