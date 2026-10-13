// Exportações feitas no navegador: .bpmn (texto) e PDF (diagrama + ficha).
// No sistema real, o PDF seria gerado pela API; aqui usamos o jsPDF.
import { vendors } from '../vendor.js';
import { slug } from '../../util/text.js';
import { orderedSteps } from './ficha.js';
import { STATUS_LABEL } from './ui.js';

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadText = (filename, text, mime = 'application/xml') => downloadBlob(filename, new Blob([text], { type: mime }));

function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const m = svg.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
    const w = m ? Number(m[1]) : 1200, h = m ? Number(m[2]) : 600;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(2, 2600 / w);
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve({ url: c.toDataURL('image/jpeg', 0.9), w, h });
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export async function exportPdf({ nome, status, versao, model, svg }) {
  const jsPDF = vendors.jsPDF;
  if (!jsPDF) throw new Error('O gerador de PDF não carregou.');
  const img = await svgToImage(svg);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const W = 297, H = 210, M = 14;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(nome, M, M + 4);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(90);
  const ver = versao ? `   Versão aprovada: ${versao.n} (${versao.validador})` : '';
  pdf.text(`Situação: ${STATUS_LABEL[status] ?? status}${ver}   Gerado em ${new Date().toLocaleDateString('pt-BR')} pelo FluxoIA (mockup)`, M, M + 10);
  pdf.setTextColor(0);
  const k = Math.min((W - 2 * M) / img.w, (H - M - 22 - M) / img.h);
  pdf.addImage(img.url, 'JPEG', M, M + 16, img.w * k, img.h * k);

  pdf.addPage();
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text('Ficha do processo', M, M + 4);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.text(pdf.splitTextToSize(model.objetivo || '', W - 2 * M), M, M + 11);
  const cols = [{ t: 'Etapa', w: 62 }, { t: 'Setor', w: 40 }, { t: 'Documentos', w: 64 }, { t: 'Sistemas e taxas', w: 64 }, { t: 'Prazo', w: 39 }];
  let y = M + 22;
  const head = () => {
    pdf.setFont('helvetica', 'bold'); let x = M; cols.forEach((c) => { pdf.text(c.t, x, y); x += c.w; });
    y += 2; pdf.setDrawColor(180); pdf.line(M, y, W - M, y); y += 5; pdf.setFont('helvetica', 'normal');
  };
  head();
  const setor = (id) => model.setores.find((s) => s.id === id)?.nome ?? '';
  orderedSteps(model).forEach((e) => {
    const cells = [e.nome, setor(e.setor), e.documentos.join(', '), [...e.sistemas, ...e.taxas].join(', '), e.prazo].map((t, i) => pdf.splitTextToSize(t || '', cols[i].w - 3));
    const hh = Math.max(...cells.map((c) => c.length), 1) * 4.2 + 3;
    if (y + hh > H - M) { pdf.addPage(); y = M + 6; head(); }
    let x = M; cells.forEach((c, i) => { pdf.text(c, x, y); x += cols[i].w; });
    y += hh; pdf.setDrawColor(225); pdf.line(M, y - 3, W - M, y - 3);
  });
  downloadBlob(`${slug(nome)}.pdf`, pdf.output('blob'));
}
