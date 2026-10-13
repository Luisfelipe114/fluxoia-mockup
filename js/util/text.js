// Utilitários de texto em português: normalização, radicais e listas.

/** Minúsculas e sem acentos. */
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Radical simples (5 primeiras letras normalizadas) para comparar palavras parecidas. */
export function stem(word) {
  return norm(word).replace(/[^a-z0-9]/g, '').slice(0, 5);
}

export function words(s, min = 4) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= min);
}

export function capitalize(s) {
  const t = String(s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

export function limitWords(s, n = 6) {
  return String(s ?? '').trim().split(/\s+/).slice(0, n).join(' ');
}

export function uniq(list) {
  return [...new Set(list)];
}

/** "a, b e c" -> ["a","b","c"] */
export function splitList(text) {
  return String(text ?? '')
    .split(/\s*(?:,|;|\n|\se\s)\s*/i)
    .map((x) => x.replace(/^[\s•\-–]+/, '').replace(/[.\s]+$/, '').trim())
    .filter(Boolean);
}

/** Quebra em frases (., ;, ?, !, quebras de linha e marcadores). */
export function sentences(text) {
  return String(text ?? '')
    .replace(/([.;!?])\s+/g, '$1§')
    .replace(/\n+/g, '§')
    .split('§')
    .map((x) => x.replace(/^[\s•\-–]+/, '').replace(/^\d+[.)]\s+/, '').replace(/[.;!?\s]+$/, '').trim())
    .filter(Boolean);
}

/** Estimativa grosseira de tokens (≈ 4 caracteres por token). */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

export function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'processo';
}
