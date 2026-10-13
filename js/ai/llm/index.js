// Fábrica do cliente de LLM conforme as configurações (simulado ou endpoint compatível com OpenAI).
import { MockLLM } from './mockLLM.js';
import { OpenAICompatibleClient } from './httpClient.js';

export function createLLM(settings) {
  const s = settings.llm ?? {};
  if (s.mode === 'http' && s.baseUrl && s.model) return new OpenAICompatibleClient(s);
  return new MockLLM();
}
