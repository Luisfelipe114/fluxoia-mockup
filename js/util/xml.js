// Parser XML mínimo (sem dependências), suficiente para arquivos BPMN 2.0.
// Funciona no navegador e no Node, o que permite testar o conversor sem DOM.

export function escapeXml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function unescapeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** Nome local (sem prefixo de namespace). */
export const localName = (name) => String(name).replace(/^.*:/, '');

/**
 * @returns {{name:string, attrs:Record<string,string>, children:any[], text:string}}
 */
export function parseXml(xml) {
  let i = 0;
  const s = String(xml);
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];

  while (i < s.length) {
    if (s[i] !== '<') {
      const j = s.indexOf('<', i);
      const end = j === -1 ? s.length : j;
      const txt = s.slice(i, end);
      if (txt.trim()) stack[stack.length - 1].text += unescapeXml(txt);
      i = end;
      continue;
    }
    if (s.startsWith('<!--', i)) { i = s.indexOf('-->', i) + 3; continue; }
    if (s.startsWith('<![CDATA[', i)) {
      const j = s.indexOf(']]>', i);
      stack[stack.length - 1].text += s.slice(i + 9, j);
      i = j + 3; continue;
    }
    if (s.startsWith('<?', i)) { i = s.indexOf('?>', i) + 2; continue; }
    if (s.startsWith('<!', i)) { i = s.indexOf('>', i) + 1; continue; }
    if (s[i + 1] === '/') {
      stack.pop();
      i = s.indexOf('>', i) + 1;
      continue;
    }
    // tag de abertura
    let j = i + 1, inQuote = null;
    while (j < s.length) {
      const c = s[j];
      if (inQuote) { if (c === inQuote) inQuote = null; }
      else if (c === '"' || c === "'") inQuote = c;
      else if (c === '>') break;
      j++;
    }
    let inner = s.slice(i + 1, j);
    const selfClose = inner.endsWith('/');
    if (selfClose) inner = inner.slice(0, -1);
    const m = inner.match(/^\s*([^\s/>]+)/);
    const node = { name: m[1], attrs: {}, children: [], text: '' };
    const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    const rest = inner.slice(m[0].length);
    while ((a = attrRe.exec(rest))) node.attrs[a[1]] = unescapeXml(a[3] ?? a[4] ?? '');
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
    i = j + 1;
  }
  return root.children[0] || root;
}

/** Todos os descendentes cujo nome local é `name`. */
export function findAll(node, name, out = []) {
  for (const c of node.children) {
    if (localName(c.name) === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
}

export function childrenNamed(node, name) {
  return node.children.filter((c) => localName(c.name) === name);
}
