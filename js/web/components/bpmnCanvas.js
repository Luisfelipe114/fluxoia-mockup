// Editor e visualizador de diagramas (bpmn-js). Só desenha e edita; a conversão XML <-> JSON é da API.
import { vendors } from '../vendor.js';

function fit(instance) {
  const canvas = instance.get('canvas');
  canvas.zoom('fit-viewport');
  const { inner, outer } = canvas.viewbox();
  if (!inner.width || !outer.width) return;
  const padL = outer.width > 600 ? 124 : 90, pad = 28;
  const s = Math.max(0.2, Math.min((outer.width - padL - pad) / inner.width, (outer.height - 2 * pad) / inner.height, 1.35));
  canvas.viewbox({ x: inner.x - padL / s, y: inner.y - (outer.height / s - inner.height) / 2, width: outer.width / s, height: outer.height / s });
}

async function mount(Ctor, container, xml, { onChange, onSelect, editable }) {
  const instance = new Ctor({ container });
  let importing = false;
  if (editable) instance.on('commandStack.changed', () => { if (!importing) onChange?.(); });
  instance.on('element.click', (ev) => onSelect?.(ev.element));
  const resize = () => { try { fit(instance); } catch { /* sem diagrama ainda */ } };
  window.addEventListener('resize', resize);

  const controller = {
    instance,
    async load(newXml) {
      importing = true;
      try { await instance.importXML(newXml); fit(instance); } finally { importing = false; }
    },
    fit: () => fit(instance),
    zoom: (step) => instance.get('zoomScroll').stepZoom(step),
    saveXML: async () => (await instance.saveXML({ format: true })).xml,
    saveSVG: async () => (await instance.saveSVG()).svg,
    destroy() { window.removeEventListener('resize', resize); instance.destroy(); },
  };
  await controller.load(xml);
  return controller;
}

export const mountEditor = (container, xml, handlers = {}) => mount(vendors.Modeler, container, xml, { ...handlers, editable: true });
export const mountViewer = (container, xml, handlers = {}) => mount(vendors.Viewer, container, xml, { ...handlers, editable: false });

/** O bpmn-js usa ids "N_e1"; o modelo usa "e1". */
export const modelIdOf = (element) => String(element?.businessObject?.id ?? '').replace(/^N_/, '');

/** Tracejado vermelho nas etapas que não vêm da entrevista (sem origem). Devolve os ids marcados. */
export function markNoOrigin(instance, model, previous = []) {
  const canvas = instance.get('canvas');
  const registry = instance.get('elementRegistry');
  previous.forEach((id) => { try { canvas.removeMarker(id, 'sem-origem'); } catch { /* elemento removido */ } });
  const ids = [];
  for (const e of model.elementos) {
    if ((e.tipo === 'tarefa' || e.tipo === 'decisao') && !e.origem.trim() && registry.get(`N_${e.id}`)) {
      canvas.addMarker(`N_${e.id}`, 'sem-origem');
      ids.push(`N_${e.id}`);
    }
  }
  return ids;
}
