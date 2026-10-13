// Relógio da simulação: permite escalar (ou zerar) as latências artificiais.
export const clock = {
  scale: 1,
  /** Espera `ms` milissegundos multiplicados pela escala atual (0 = sem espera). */
  sleep(ms) {
    const t = ms * this.scale;
    return t <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, t));
  },
  /** Latência aleatória entre min e max. */
  jitter(min, max) { return this.sleep(min + Math.random() * (max - min)); },
};
