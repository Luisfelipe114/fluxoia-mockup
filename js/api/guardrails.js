// Guardrail de entrada: alerta de dados pessoais nas respostas da entrevista (LGPD).
// A entrevista deve descrever setores e etapas, nunca pessoas ou documentos de pessoas reais.

const PATTERNS = [
  { tipo: 'CPF', re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { tipo: 'e-mail', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { tipo: 'telefone', re: /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g },
];

const mask = (s) => `${s.slice(0, 3)}…`;

/** @returns {{campo:string, tipo:string, trecho:string}[]} */
export function detectPersonalData(valores = {}) {
  const alerts = [];
  for (const [campo, texto] of Object.entries(valores)) {
    for (const { tipo, re } of PATTERNS) {
      for (const m of String(texto ?? '').matchAll(re)) alerts.push({ campo, tipo, trecho: mask(m[0]) });
    }
  }
  return alerts;
}
