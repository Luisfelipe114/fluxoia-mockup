// Posicionamento automático do diagrama: uma raia por setor, colunas por "distância" do início.
import { byId } from '../domain/model.js';

export const SIZE = { tarefa: { w: 120, h: 80 }, decisao: { w: 50, h: 50 }, inicio: { w: 36, h: 36 }, fim: { w: 36, h: 36 } };
const PX = 40, PY = 40, LBL = 30, COLW = 180, X0 = PX + LBL + LBL + 50, SLOT = 110;

/** Ordena os elementos em colunas e identifica as arestas de retorno (laços). */
export function computeOrder(model) {
  const idx = byId(model);
  const out = {};
  model.fluxos.forEach((f) => { if (idx[f.de] && idx[f.para]) (out[f.de] = out[f.de] || []).push(f.para); });

  const color = {}, back = new Set();
  const dfs = (v) => {
    color[v] = 1;
    (out[v] || []).forEach((w) => {
      if (color[w] === 1) back.add(`${v}>${w}`);
      else if (!color[w]) dfs(w);
    });
    color[v] = 2;
  };
  model.elementos.filter((e) => e.tipo === 'inicio').forEach((e) => { if (!color[e.id]) dfs(e.id); });
  model.elementos.forEach((e) => { if (!color[e.id]) dfs(e.id); });

  const indeg = {}, fwd = {}, rank = {};
  model.elementos.forEach((e) => { indeg[e.id] = 0; rank[e.id] = 0; });
  model.fluxos.forEach((f) => {
    if (!idx[f.de] || !idx[f.para] || back.has(`${f.de}>${f.para}`)) return;
    (fwd[f.de] = fwd[f.de] || []).push(f.para);
    indeg[f.para]++;
  });
  const queue = model.elementos.filter((e) => indeg[e.id] === 0).map((e) => e.id);
  while (queue.length) {
    const v = queue.shift();
    (fwd[v] || []).forEach((w) => {
      rank[w] = Math.max(rank[w], rank[v] + 1);
      if (--indeg[w] === 0) queue.push(w);
    });
  }
  return { rank, back };
}

/** Geometria completa: piscina, raias, formas e caminhos das setas. */
export function layoutModel(model) {
  const { rank, back } = computeOrder(model);
  const laneIdx = {};
  model.setores.forEach((s, i) => { laneIdx[s.id] = i; });
  const lane = (e) => laneIdx[e.setor] ?? 0;

  const sorted = [...model.elementos].sort((a, b) => rank[a.id] - rank[b.id]);
  const slotCount = {}, slot = {}, laneSlots = model.setores.map(() => 1);
  sorted.forEach((e) => {
    const k = `${lane(e)}|${rank[e.id]}`;
    slot[e.id] = slotCount[k] || 0;
    slotCount[k] = slot[e.id] + 1;
    laneSlots[lane(e)] = Math.max(laneSlots[lane(e)], slotCount[k]);
  });

  const maxRank = Math.max(0, ...Object.values(rank));
  const poolW = (X0 - PX) + (maxRank + 1) * COLW + 20;
  const laneTop = [];
  let y = PY;
  model.setores.forEach((_, i) => { laneTop[i] = y; y += laneSlots[i] * SLOT + 30; });
  const poolH = y - PY;

  const pos = {};
  model.elementos.forEach((e) => {
    const s = SIZE[e.tipo];
    const cx = X0 + rank[e.id] * COLW + 60;
    const cy = laneTop[lane(e)] + 15 + 55 + slot[e.id] * SLOT;
    pos[e.id] = { cx, cy, w: s.w, h: s.h, x: cx - s.w / 2, y: cy - s.h / 2 };
  });

  const idx = byId(model);
  const edges = model.fluxos.filter((f) => pos[f.de] && pos[f.para]).map((f, i) => {
    const a = pos[f.de], b = pos[f.para], src = idx[f.de];
    let pts;
    if (back.has(`${f.de}>${f.para}`) || b.cx <= a.cx) {
      const yy = Math.max(a.y + a.h, b.y + b.h) + 16;
      pts = [[a.cx, a.y + a.h], [a.cx, yy], [b.cx, yy], [b.cx, b.y + b.h]];
    } else if (Math.abs(a.cy - b.cy) < 1) {
      pts = [[a.x + a.w, a.cy], [b.x, b.cy]];
    } else if (src.tipo === 'decisao') {
      const down = b.cy > a.cy;
      pts = [[a.cx, down ? a.y + a.h : a.y], [a.cx, b.cy], [b.x, b.cy]];
    } else {
      const mx = b.x - 28;
      pts = [[a.x + a.w, a.cy], [mx, a.cy], [mx, b.cy], [b.x, b.cy]];
    }
    return { ...f, fid: `F_${i + 1}`, pts: pts.map(([px, py]) => [Math.round(px), Math.round(py)]) };
  });

  return { PX, PY, LBL, poolW, poolH, laneTop, laneSlots, SLOT, pos, edges, rank, back };
}
