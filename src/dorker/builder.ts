import { generateText } from '../ai/client.js';
import { loadConfig } from '../core/config.js';
import { DORK_PRESETS } from './presets.js';

export async function buildDorkQueries(options: {
  topic: string;
  preset?: string;
  count?: number;
}): Promise<string[]> {
  const { topic, count = 4 } = options;
  const activePreset = DORK_PRESETS['academic-all'];

  const systemPrompt = `Kamu adalah pakar pencarian literatur akademik ilmiah Indonesia (Indonesian scientific literature crawler).
Tugas: Buat ${count} query pencarian Google berbahasa Indonesia yang fokus UTAMA pada portal jurnal nasional dan repositori universitas di Indonesia.
Website target prioritas:
- Portal Nasional: garuda.kemdikbud.go.id, neliti.com, sinta.kemdikbud.go.id
- Kampus Indonesia: site:ac.id, ejournal.*.ac.id, jurnal.*.ac.id, repository.*.ac.id

Aturan:
- Gunakan kata kunci berbahasa Indonesia dan operator pencarian seperti: site:ac.id, site:garuda.kemdikbud.go.id, site:neliti.com, filetype:pdf
- Pastikan seluruh query menjaring jurnal ilmiah berbahasa Indonesia dari peneliti/universitas Indonesia.
- JANGAN mencari website umum, blog, berita komersial, atau jurnal berbahasa asing kecuali istilah teknis.

Respon HANYA dalam format JSON:
{
  "queries": ["query 1", "query 2", ...]
}`;

  try {
    const cfg = loadConfig();
    const dorkModel = cfg.provider === 'gemini' ? cfg.gemini.models.dork : cfg.openai.models.dork;
    const raw = await generateText({
      prompt: `Topik penelitian: "${topic}". Buat ${count} query pencarian presisi berbahasa Indonesia untuk mengikis jurnal ilmiah nasional Indonesia (Garuda, Neliti, SINTA, dan repositori .ac.id).`,
      systemPrompt,
      role: 'fast',
      jsonMode: true,
      model: dorkModel,
    });

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
    const parsed = JSON.parse(jsonStr) as { queries?: string[] };
    if (parsed.queries && Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      return parsed.queries.slice(0, count);
    }
  } catch {
    // ponytail: fallback to template expansion if AI unavailable or parse fails
  }

  // Fallback heuristic: clean topic keywords and inject into verified academic templates
  const keywords = topic.trim();
  return activePreset.templates.slice(0, count).map((tpl) =>
    tpl.replace('{keywords}', `"${keywords}"`)
  );
}
