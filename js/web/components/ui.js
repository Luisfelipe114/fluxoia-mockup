import { h } from '../dom.js';

export const STATUS_LABEL = { rascunho: 'Rascunho', em_validacao: 'Em validação', aprovado: 'Aprovado' };

export function stamp(status, { pop = false } = {}) {
  return h('span', { class: `stamp ${status}${pop ? ' pop' : ''}`, 'data-status': status }, STATUS_LABEL[status] ?? status);
}

let toastRoot = null;
export function initToasts(root) { toastRoot = root; }

export function toast(message, kind = 'info') {
  if (!toastRoot) return;
  const el = h('div', { class: `toast ${kind === 'err' ? 'err' : ''}`, role: kind === 'err' ? 'alert' : 'status' }, message);
  toastRoot.append(el);
  while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
  setTimeout(() => el.remove(), kind === 'err' ? 7000 : 3800);
}

/**
 * Caixa de diálogo com formulário. Resolve com os valores ou null (cancelado).
 * fields: [{ name, label, type?: 'text'|'textarea', required?, placeholder?, value? }]
 */
export function formDialog({ title, description = '', fields, submit = 'Confirmar', tone = 'primary' }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { 'aria-labelledby': 'dlg-title' });
    const form = h('form', { method: 'dialog' },
      h('h3', { id: 'dlg-title' }, title),
      description && h('p', { class: 'muted small' }, description),
      fields.map((f, i) => {
        const id = `dlg-f-${i}`;
        const control = f.type === 'textarea'
          ? h('textarea', { class: 'textarea', id, name: f.name, required: f.required, placeholder: f.placeholder ?? '', value: f.value ?? '' })
          : h('input', { class: 'input', id, name: f.name, type: 'text', required: f.required, placeholder: f.placeholder ?? '', value: f.value ?? '' });
        return [h('label', { class: 'field', for: id }, f.label), control];
      }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => dlg.close('cancel') }, 'Cancelar'),
        h('button', { class: `btn ${tone}`, type: 'submit', value: 'ok' }, submit)));
    dlg.append(form);
    dlg.addEventListener('close', () => {
      const ok = dlg.returnValue === 'ok';
      const values = ok ? Object.fromEntries(new FormData(form).entries()) : null;
      dlg.remove();
      resolve(values);
    });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector('input, textarea')?.focus();
  });
}

export function confirmDialog({ title, description, submit = 'Confirmar', tone = 'danger' }) {
  return formDialog({ title, description, fields: [], submit, tone }).then((v) => v !== null);
}
