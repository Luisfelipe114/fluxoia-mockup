// Conversor BPMN: modelo do processo (JSON) <-> BPMN 2.0 XML.
// Código determinístico, sem IA. No sistema real pode ser um serviço Node (bpmn-moddle + elkjs)
// ou um módulo Python; aqui é JavaScript puro para rodar no navegador.

import { escapeXml, parseXml, findAll, childrenNamed, localName } from '../util/xml.js';
import { layoutModel } from './layout.js';
import { normalizeModel } from '../domain/model.js';

const TAG = { inicio: 'startEvent', fim: 'endEvent', tarefa: 'task', decisao: 'exclusiveGateway' };
const nid = (id) => `N_${String(id).replace(/[^A-Za-z0-9_\-.]/g, '_')}`;

function documentation(e) {
  const p = [];
  if (e.documentos.length) p.push(`Documentos: ${e.documentos.join('; ')}`);
  if (e.sistemas.length) p.push(`Sistemas: ${e.sistemas.join('; ')}`);
  if (e.taxas.length) p.push(`Taxas: ${e.taxas.join('; ')}`);
  if (e.prazo) p.push(`Prazo: ${e.prazo}`);
  if (e.origem) p.push(`Origem na entrevista: “${e.origem}”`);
  return p.join('\n');
}

/** Modelo -> BPMN 2.0 XML (com diagrama e uma raia por setor). */
export function modelToXml(model) {
  const g = layoutModel(model);
  const laneIdx = {};
  model.setores.forEach((s, i) => { laneIdx[s.id] = i; });
  const lane = (e) => laneIdx[e.setor] ?? 0;

  const inc = {}, outg = {};
  g.edges.forEach((f) => { (outg[f.de] = outg[f.de] || []).push(f.fid); (inc[f.para] = inc[f.para] || []).push(f.fid); });

  let proc = '<bpmn:laneSet id="LaneSet_1">';
  model.setores.forEach((s, i) => {
    proc += `<bpmn:lane id="Lane_${i + 1}" name="${escapeXml(s.nome)}">`
      + model.elementos.filter((e) => lane(e) === i).map((e) => `<bpmn:flowNodeRef>${nid(e.id)}</bpmn:flowNodeRef>`).join('')
      + '</bpmn:lane>';
  });
  proc += '</bpmn:laneSet>';

  model.elementos.forEach((e) => {
    const d = documentation(e);
    proc += `<bpmn:${TAG[e.tipo]} id="${nid(e.id)}" name="${escapeXml(e.nome)}">`
      + (d ? `<bpmn:documentation>${escapeXml(d)}</bpmn:documentation>` : '')
      + (inc[e.id] || []).map((x) => `<bpmn:incoming>${x}</bpmn:incoming>`).join('')
      + (outg[e.id] || []).map((x) => `<bpmn:outgoing>${x}</bpmn:outgoing>`).join('')
      + `</bpmn:${TAG[e.tipo]}>`;
  });
  g.edges.forEach((f) => {
    proc += `<bpmn:sequenceFlow id="${f.fid}"${f.condicao ? ` name="${escapeXml(f.condicao)}"` : ''} sourceRef="${nid(f.de)}" targetRef="${nid(f.para)}"/>`;
  });

  let di = `<bpmndi:BPMNShape id="Part_1_di" bpmnElement="Part_1" isHorizontal="true"><dc:Bounds x="${g.PX}" y="${g.PY}" width="${g.poolW}" height="${g.poolH}"/></bpmndi:BPMNShape>`;
  model.setores.forEach((s, i) => {
    di += `<bpmndi:BPMNShape id="Lane_${i + 1}_di" bpmnElement="Lane_${i + 1}" isHorizontal="true"><dc:Bounds x="${g.PX + g.LBL}" y="${g.laneTop[i]}" width="${g.poolW - g.LBL}" height="${g.laneSlots[i] * g.SLOT + 30}"/></bpmndi:BPMNShape>`;
  });
  model.elementos.forEach((e) => {
    const p = g.pos[e.id];
    let lbl = '';
    if (e.tipo !== 'tarefa') {
      const up = e.tipo === 'decisao' && g.edges.some((f) => f.de === e.id && g.pos[f.para].cy < p.cy - 1 && g.pos[f.para].cx > p.cx);
      const below = e.tipo !== 'decisao' || up;
      lbl = `<bpmndi:BPMNLabel><dc:Bounds x="${p.cx - 55}" y="${below ? p.y + p.h + 6 : p.y - 33}" width="110" height="27"/></bpmndi:BPMNLabel>`;
    }
    di += `<bpmndi:BPMNShape id="${nid(e.id)}_di" bpmnElement="${nid(e.id)}"${e.tipo === 'decisao' ? ' isMarkerVisible="true"' : ''}><dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>${lbl}</bpmndi:BPMNShape>`;
  });
  g.edges.forEach((f) => {
    const [first, second] = f.pts;
    const vertical = first[0] === second[0];
    const lx = vertical ? first[0] + 6 : first[0] + 4;
    const ly = vertical ? (second[1] > first[1] ? first[1] + 2 : first[1] - 16) : first[1] - 18;
    const lbl = f.condicao ? `<bpmndi:BPMNLabel><dc:Bounds x="${lx}" y="${ly}" width="${Math.max(24, f.condicao.length * 7)}" height="14"/></bpmndi:BPMNLabel>` : '';
    di += `<bpmndi:BPMNEdge id="${f.fid}_di" bpmnElement="${f.fid}">${f.pts.map(([x, y]) => `<di:waypoint x="${x}" y="${y}"/>`).join('')}${lbl}</bpmndi:BPMNEdge>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="FluxoIA" exporterVersion="0.1">
<bpmn:collaboration id="Collab_1"><bpmn:participant id="Part_1" name="${escapeXml(model.processo)}" processRef="Proc_1"/></bpmn:collaboration>
<bpmn:process id="Proc_1" isExecutable="false">${proc}</bpmn:process>
<bpmndi:BPMNDiagram id="Diag_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">${di}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

const KIND = (t) => {
  if (t === 'startEvent') return 'inicio';
  if (t === 'endEvent') return 'fim';
  if (/Gateway$/.test(t)) return 'decisao';
  if (/(Task|SubProcess|CallActivity|IntermediateThrowEvent|IntermediateCatchEvent)$/i.test(t) || t === 'task') return 'tarefa';
  return null;
};

function parseDocumentation(text) {
  const out = { documentos: [], sistemas: [], taxas: [], prazo: '', origem: '' };
  const list = (v) => v.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
  for (const line of String(text || '').split(/\n+/)) {
    const m = line.match(/^\s*(Documentos|Sistemas|Taxas|Prazo|Origem na entrevista)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'documentos') out.documentos = list(m[2]);
    else if (k === 'sistemas') out.sistemas = list(m[2]);
    else if (k === 'taxas') out.taxas = list(m[2]);
    else if (k === 'prazo') out.prazo = m[2].trim();
    else out.origem = m[2].replace(/^[“"]|[”"]$/g, '').trim();
  }
  return out;
}

/** BPMN 2.0 XML -> modelo. Lê arquivos exportados pelo FluxoIA e BPMNs de outras ferramentas. */
export function xmlToModel(xml, prev = null) {
  const root = parseXml(xml);
  const proc = findAll(root, 'process')[0];
  if (!proc) throw new Error('Arquivo sem <process>: não parece um BPMN 2.0 válido.');

  const participant = findAll(root, 'participant')[0];
  const processo = participant?.attrs.name || proc.attrs.name || prev?.processo || 'Processo importado';

  const nodes = proc.children.filter((c) => KIND(localName(c.name)));
  const ownIds = nodes.length > 0 && nodes.every((n) => String(n.attrs.id || '').startsWith('N_'));
  const clean = (id) => (ownIds ? String(id).slice(2) : String(id));

  const lanes = findAll(proc, 'lane');
  const setores = lanes.map((l, i) => ({ id: `s${i + 1}`, nome: l.attrs.name || `Setor ${i + 1}` }));
  const laneOfNode = {};
  lanes.forEach((l, i) => findAll(l, 'flowNodeRef').forEach((r) => { laneOfNode[r.text.trim()] = `s${i + 1}`; }));
  if (!setores.length) setores.push({ id: 's1', nome: 'Setor' });
  const prevById = Object.fromEntries((prev?.elementos ?? []).map((e) => [e.id, e]));

  const elementos = nodes.map((n) => {
    const id = clean(n.attrs.id);
    const doc = parseDocumentation(childrenNamed(n, 'documentation')[0]?.text);
    const p = prevById[id] || {};
    return {
      id, tipo: KIND(localName(n.name)), nome: n.attrs.name || '',
      setor: laneOfNode[n.attrs.id] || setores[0].id,
      documentos: doc.documentos.length ? doc.documentos : p.documentos || [],
      sistemas: doc.sistemas.length ? doc.sistemas : p.sistemas || [],
      taxas: doc.taxas.length ? doc.taxas : p.taxas || [],
      prazo: doc.prazo || p.prazo || '',
      origem: doc.origem || p.origem || '',
    };
  });
  const valid = new Set(elementos.map((e) => e.id));
  const fluxos = findAll(proc, 'sequenceFlow')
    .map((f) => ({ de: clean(f.attrs.sourceRef), para: clean(f.attrs.targetRef), condicao: f.attrs.name || '' }))
    .filter((f) => valid.has(f.de) && valid.has(f.para));

  return normalizeModel({ processo, objetivo: prev?.objetivo || '', setores, elementos, fluxos }, processo);
}
