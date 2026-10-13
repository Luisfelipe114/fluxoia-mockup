// Cliente para um Servidor de LLM real com API compatível com OpenAI (vLLM, Ollama, etc.).
// ATENÇÃO: não foi testado contra um servidor real neste mockup (só contra um servidor falso nos testes).
// O navegador exige CORS habilitado no servidor (ex.: OLLAMA_ORIGINS="*").

export class OpenAICompatibleClient {
  constructor({ baseUrl, model, apiKey = '' }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.model = model;
    this.apiKey = apiKey;
    this.name = `${model} @ ${this.baseUrl}`;
    this.kind = 'http';
  }

  async _post(body) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify(body),
    });
    return res;
  }

  /** @returns {Promise<string>} texto da resposta (JSON) */
  async complete({ messages, schema, schemaName = 'processo' }) {
    const base = { model: this.model, messages, temperature: 0.1 };
    let res = await this._post({ ...base, response_format: { type: 'json_schema', json_schema: { name: schemaName, schema } } });
    if (res.status === 400 || res.status === 422) res = await this._post({ ...base, response_format: { type: 'json_object' } });
    if (!res.ok) throw new Error(`Servidor de LLM respondeu ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Resposta do servidor de LLM sem conteúdo.');
    return content;
  }
}
