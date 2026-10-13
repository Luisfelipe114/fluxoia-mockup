// Carrega as bibliotecas de terceiros (copiadas em /vendor). As duas versões do bpmn-js expõem o
// mesmo global `BpmnJS`, então capturamos cada uma logo após o carregamento.
const load = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = resolve;
  s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
  document.head.appendChild(s);
});

export const vendors = { Modeler: null, Viewer: null, jsPDF: null };

export async function loadVendors() {
  await load('vendor/bpmn-js/bpmn-modeler.production.min.js');
  vendors.Modeler = window.BpmnJS;
  await load('vendor/bpmn-js/bpmn-navigated-viewer.production.min.js');
  vendors.Viewer = window.BpmnJS;
  await load('vendor/jspdf/jspdf.umd.min.js');
  vendors.jsPDF = window.jspdf?.jsPDF ?? null;
}
