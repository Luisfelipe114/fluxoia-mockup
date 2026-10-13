import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, findAll } from '../js/util/xml.js';
import { modelToXml, xmlToModel } from '../js/bpmn/converter.js';
import { EXAMPLE_ALVARA, EXAMPLE_SANITARIA } from '../js/reference/seed.js';
import { verifyModel } from '../js/ai/verifier.js';

test('parser XML lê atributos, texto e entidades', () => {
  const n = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><!-- c --><b>t&lt;u</b><c/></a>');
  assert.equal(n.name, 'a');
  assert.equal(n.attrs.x, '1 & 2');
  assert.equal(n.children[0].text, 't<u');
  assert.equal(n.children.length, 2);
});

for (const [nome, ex] of [['alvará', EXAMPLE_ALVARA], ['licença sanitária', EXAMPLE_SANITARIA]]) {
  test(`modelo -> XML -> modelo preserva a estrutura (${nome})`, () => {
    const xml = modelToXml(ex);
    const root = parseXml(xml);
    assert.equal(findAll(root, 'lane').length, ex.setores.length);
    assert.equal(findAll(root, 'sequenceFlow').length, ex.fluxos.length);
    assert.equal(findAll(root, 'BPMNShape').length, ex.elementos.length + ex.setores.length + 1);

    const back = xmlToModel(xml);
    assert.equal(back.processo, ex.processo);
    assert.deepEqual(back.setores.map((s) => s.nome), ex.setores.map((s) => s.nome));
    assert.equal(back.elementos.length, ex.elementos.length);
    for (const e of ex.elementos) {
      const b = back.elementos.find((x) => x.id === e.id);
      assert.ok(b, `elemento ${e.id} perdido`);
      assert.equal(b.nome, e.nome);
      assert.equal(b.tipo, e.tipo);
      assert.equal(back.setores.find((s) => s.id === b.setor).nome, ex.setores.find((s) => s.id === e.setor).nome);
      assert.deepEqual(b.documentos, e.documentos);
      assert.deepEqual(b.sistemas, e.sistemas);
      assert.deepEqual(b.taxas, e.taxas);
      assert.equal(b.prazo, e.prazo);
      assert.equal(b.origem, e.origem);
    }
    const key = (f) => `${f.de}>${f.para}:${f.condicao}`;
    assert.deepEqual(back.fluxos.map(key).sort(), ex.fluxos.map(key).sort());
    assert.deepEqual(verifyModel(back).errors, []);
  });
}

test('xmlToModel aceita BPMN de outra ferramenta (ids próprios, sem raias)', () => {
  const xml = `<?xml version="1.0"?><definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
    <process id="P"><startEvent id="s" name="Início"/><userTask id="t" name="Fazer"/><endEvent id="f" name="Fim"/>
    <sequenceFlow id="1" sourceRef="s" targetRef="t"/><sequenceFlow id="2" sourceRef="t" targetRef="f"/></process></definitions>`;
  const m = xmlToModel(xml);
  assert.equal(m.elementos.length, 3);
  assert.equal(m.setores.length, 1);
  assert.deepEqual(verifyModel(m).errors, []);
});

test('xmlToModel rejeita arquivo que não é BPMN', () => {
  assert.throws(() => xmlToModel('<html></html>'), /process/);
});
