// Rotas de processos (entrevista, geração, edição, aprovação, versões e exportação).
export function registerProcessRoutes(router, svc) {
  router.add('GET', '/processos', () => svc.list());
  router.add('POST', '/processos', ({ body }) => svc.create(body));
  router.add('GET', '/processos/:id', ({ params }) => svc.get(params.id));
  router.add('PUT', '/processos/:id/respostas', ({ params, body }) => svc.saveAnswers(params.id, body?.respostas));
  router.add('POST', '/processos/:id/gerar', ({ params }) => svc.generate(params.id));
  router.add('POST', '/processos/:id/ajustar', ({ params, body }) => svc.adjust(params.id, body?.pedido));
  router.add('PUT', '/processos/:id/xml', ({ params, body }) => svc.saveXml(params.id, body?.xml));
  router.add('POST', '/processos/:id/enviar-validacao', ({ params }) => svc.submit(params.id));
  router.add('POST', '/processos/:id/aprovar', ({ params, body, role }) => svc.approve(params.id, role, body));
  router.add('POST', '/processos/:id/devolver', ({ params, body, role }) => svc.reject(params.id, role, body));
  router.add('GET', '/processos/:id/versoes', ({ params }) => svc.versions(params.id));
  router.add('GET', '/processos/:id/versoes/:n/diff', ({ params }) => svc.versionDiff(params.id, params.n));
  router.add('POST', '/processos/:id/versoes/:n/restaurar', ({ params }) => svc.restore(params.id, params.n));
  router.add('POST', '/processos/:id/feedback', ({ params, body }) => svc.feedback(params.id, body));
  router.add('GET', '/processos/:id/historico', ({ params }) => svc.history(params.id));
  router.add('GET', '/processos/:id/exportar', ({ params }) => svc.exportBpmn(params.id));
}
