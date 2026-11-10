import { buildDorkQueries } from '../dorker/builder.js';
import { searchDork } from '../dorker/searcher.js';
import { extractSourcesSequential, isAcademicSource } from '../dorker/extractor.js';
import { verifySourceItems } from '../dorker/verifier.js';
import { generateText } from '../ai/client.js';
import {
  formatSourcesXml,
  getOutlinePrompt,
  getSectionPrompt,
  getBibliographySection,
  buildLiteratureMatrixTable,
  sanitizeManuscriptText,
  syncBodyAndSources,
} from '../ai/prompts.js';
import { saveCheckpoint } from '../core/checkpoint.js';
import { logger } from '../core/logger.js';
import type { TaskState, SourceItem } from '../types/index.js';

export interface DraftStreamEvent {
  type: 'section_start' | 'line' | 'paragraph' | 'section_end' | 'chunk' | 'thinking';
  sectionTitle: string;
  text: string;
  index: number;
  total: number;
}

export interface PipelineOptions {
  preset?: string;
  maxDorks?: number;
  maxSources?: number;
  chapterCount?: number;
  customChapters?: string[];
  onProgress?: (step: string, detail: string) => void;
  onDraftStream?: (event: DraftStreamEvent) => void;
}

export async function runTaskPipeline(
  state: TaskState,
  options: PipelineOptions = {}
): Promise<TaskState> {
  const {
    preset = 'academic-all',
    maxDorks = 3,
    maxSources = 5,
    chapterCount,
    customChapters,
    onProgress,
  } = options;

  const notify = (step: string, detail: string) => {
    logger.step(step.toUpperCase(), detail);
    if (onProgress) onProgress(step, detail);
  };

  // Step 1: Dorking
  if (state.dorkQueries.length === 0) {
    notify('dorking', `Menyusun Google Dork queries untuk topik: "${state.topic}"...`);
    state.step = 'dorking';
    state.dorkQueries = await buildDorkQueries({
      topic: state.topic,
      preset,
      count: maxDorks,
    });
    saveCheckpoint(state);
    notify('dorking', `Berhasil membuat ${state.dorkQueries.length} query Dork.`);
  }

  // Step 2: Searching (keep custom-ref- sources at top and top up with Indonesian journals)
  const webSources = state.sources.filter((s) => !s.id.startsWith('custom-ref-'));
  if (webSources.length === 0) {
    notify('searching', `Mengeksekusi pencarian dork jurnal nasional Indonesia...`);
    state.step = 'searching';
    const rawResults: SourceItem[] = [...state.sources];

    for (const q of state.dorkQueries) {
      notify('searching', `Mencari: ${q}`);
      const hits = await searchDork(q, { maxResults: 4, delayMs: 400 });
      for (const h of hits) {
        if (!rawResults.some((r) => r.url === h.url || r.title.toLowerCase() === h.title.toLowerCase())) {
          rawResults.push(h);
        }
      }
    }

    if (rawResults.filter(isAcademicSource).length < maxSources) {
      const topicHits = await searchDork(state.topic, { maxResults: maxSources, delayMs: 0 });
      for (const h of topicHits) {
        if (!rawResults.some((r) => r.url === h.url || r.title.toLowerCase() === h.title.toLowerCase())) {
          rawResults.push(h);
        }
      }
    }

    state.sources = rawResults;
    saveCheckpoint(state);
    notify('searching', `Ditemukan total ${state.sources.length} kandidat sumber referensi.`);
  }

  // Step 3: Extracting
  const needsExtractionOrFilter =
    state.sources.some((s) => !s.content || !isAcademicSource(s)) ||
    state.sources.length > maxSources;
  if (needsExtractionOrFilter) {
    notify('extracting', `Mengunduh & mengekstrak konten jurnal/artikel (maks ${maxSources} sumber)...`);
    state.step = 'extracting';
    state.sources = await extractSourcesSequential(state.sources, maxSources);
    if (state.sources.length < 3) {
      const fallbackIndo = await searchDork(state.topic, { maxResults: maxSources, delayMs: 0 });
      const merged = [...state.sources];
      for (const f of fallbackIndo) {
        if (!merged.some((m) => m.url === f.url || m.title.toLowerCase() === f.title.toLowerCase())) {
          merged.push(f);
        }
      }
      state.sources = await extractSourcesSequential(merged, maxSources);
    }
    // ponytail: DOI check anti-halusinasi pada semua sumber yang didapatkan
    state.sources = await verifySourceItems(state.sources);
    saveCheckpoint(state);
    notify('extracting', `Ekstraksi dan verifikasi DOI selesai untuk ${state.sources.length} sumber.`);
  }

  // Step 4: Drafting
  notify('drafting', `Memulai penyusunan dokumen akademik...`);
  state.step = 'drafting';
  const sourcesXml = formatSourcesXml(state.sources);

  // Generate outline if empty
  if (state.outline.length === 0) {
    if (customChapters && customChapters.length > 0) {
      state.outline = customChapters;
      notify('drafting', `Menggunakan ${state.outline.length} bab kustom.`);
    } else {
      notify('drafting', `Menyusun kerangka/outline dokumen (${chapterCount ? chapterCount + ' bab' : 'otomatis'})...`);
      const outlinePrompt = getOutlinePrompt(
        state.topic,
        state.taskType,
        sourcesXml,
        chapterCount
      );
      try {
        const raw = await generateText({
          prompt: outlinePrompt,
          role: 'fast',
          jsonMode: true,
        });
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
        const parsed = JSON.parse(jsonStr) as { outline?: string[] };
        if (parsed.outline && parsed.outline.length > 0) {
          // ponytail: bersihkan judul bab dari sub-bab dalam kurung jika LLM menyertakannya
          state.outline = parsed.outline.map((o) =>
            o.replace(/\s*\([^)]*\)/g, '').replace(/\s*[:.-]\s*(1\.[0-9].*)/, '').trim()
          );
        }
      } catch {
        // ponytail: standard fallback outlines if JSON parse fails
        if (state.taskType === 'makalah') {
          state.outline = [
            'ABSTRAK',
            'BAB I: PENDAHULUAN',
            'BAB II: TINJAUAN PUSTAKA DAN KERANGKA TEORETIS',
            'BAB III: METODE PENELITIAN',
            'BAB IV: HASIL DAN PEMBAHASAN',
            'BAB V: PENUTUP',
          ];
        } else if (state.taskType === 'skripsi') {
          state.outline = [
            'ABSTRAK',
            'BAB I: PENDAHULUAN',
            'BAB II: LANDASAN TEORI DAN TINJAUAN PUSTAKA',
            'BAB III: METODOLOGI PENELITIAN',
            'BAB IV: HASIL PENELITIAN DAN PEMBAHASAN',
            'BAB V: KESIMPULAN DAN SARAN',
          ];
        } else if (state.taskType === 'presentasi') {
          state.outline = [
            'Slide 1: Pendahuluan & Gambaran Umum',
            'Slide 2: Landasan Teori & Literatur',
            'Slide 3: Pembahasan Utama & Hasil',
            'Slide 4: Kesimpulan & Rekomendasi',
          ];
        } else {
          state.outline = [
            'Pengantar & Ruang Lingkup',
            'Matriks Analisis Komparatif Literatur',
            'Identifikasi Research Gap',
            'Kesimpulan',
          ];
        }
      }
    }
    saveCheckpoint(state);
  }

  // Draft each section incrementally
  for (let i = 0; i < state.outline.length; i++) {
    const sectionTitle = state.outline[i];
    const existing = state.sections.find((s) => s.title === sectionTitle);
    if (existing && existing.content.trim().length > 100) {
      notify('drafting', `[${i + 1}/${state.outline.length}] Bagian "${sectionTitle}" sudah ada di checkpoint.`);
      continue;
    }

    notify('drafting', `[${i + 1}/${state.outline.length}] Menulis bagian: "${sectionTitle}"...`);
    if (options.onDraftStream) {
      options.onDraftStream({
        type: 'section_start',
        sectionTitle,
        text: '',
        index: i + 1,
        total: state.outline.length,
      });
    }

    const prevSummary = state.sections
      .map((s) => `${s.title}: ${s.content.slice(0, 200)}...`)
      .join('\n');

    const prompt = getSectionPrompt(
      state.topic,
      state.taskType,
      sectionTitle,
      sourcesXml,
      prevSummary,
      state.citationStyle || 'apa'
    );

    let content = '';
    let streamedLive = false;
    let lastThinkingEmit = 0;

    const handleChunk = (chunk: string) => {
      if (!chunk || !options.onDraftStream) return;
      streamedLive = true;
      options.onDraftStream({
        type: 'chunk',
        sectionTitle,
        text: chunk,
        index: i + 1,
        total: state.outline.length,
      });
    };

    const handleReasoning = (chunk: string) => {
      if (!chunk || !options.onDraftStream) return;
      const now = Date.now();
      if (now - lastThinkingEmit < 2500) return;
      lastThinkingEmit = now;
      options.onDraftStream({
        type: 'thinking',
        sectionTitle,
        text: chunk,
        index: i + 1,
        total: state.outline.length,
      });
    };

    try {
      content = await generateText({
        prompt,
        role: 'writer',
        onChunk: handleChunk,
        onReasoning: handleReasoning,
      });
      // ponytail: hanya tambahkan tabel matriks otomatis jika AI belum membuatnya sama sekali
      if (
        /(bab\s*(ii|2)\b|tinjauan\s*pustaka|landasan\s*teori|kajian\s*pustaka|matriks|literature)/i.test(sectionTitle) &&
        !/matriks\s*penelitian/i.test(content) &&
        !/\|\s*[-:]+/.test(content) &&
        state.sources.length > 0
      ) {
        const matrix = buildLiteratureMatrixTable(state.sources);
        content = `${content.trim()}\n\n${matrix}`;
        if (streamedLive && options.onDraftStream) {
          options.onDraftStream({
            type: 'chunk',
            sectionTitle,
            text: `\n\n${matrix}`,
            index: i + 1,
            total: state.outline.length,
          });
        }
      }
    } catch (err) {
      logger.warn(`Gagal menulis bagian "${sectionTitle}" (percobaan 1): ${String(err)}. Mencoba ulang...`);
      try {
        await new Promise((r) => setTimeout(r, 3000));
        streamedLive = false;
        content = await generateText({
          prompt,
          role: 'writer',
          onChunk: handleChunk,
          onReasoning: handleReasoning,
        });
      } catch (err2) {
        logger.error(`Gagal menulis bagian "${sectionTitle}" permanen: ${String(err2)}`);
        throw new Error(`Gagal menyusun bagian "${sectionTitle}": ${String(err2)}`);
      }
    }

    // Fallback smooth line-by-line stream only if provider didn't emit live chunks
    if (options.onDraftStream && content && !streamedLive) {
      const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const para = paragraphs[pIdx];
        const lines = para.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          options.onDraftStream({
            type: 'line',
            sectionTitle,
            text: lines[lIdx],
            index: lIdx + 1,
            total: lines.length,
          });
          await new Promise((r) => setTimeout(r, 30));
        }
        options.onDraftStream({
          type: 'paragraph',
          sectionTitle,
          text: para,
          index: pIdx + 1,
          total: paragraphs.length,
        });
      }
    }

    if (options.onDraftStream) {
      options.onDraftStream({
        type: 'section_end',
        sectionTitle,
        text: content,
        index: i + 1,
        total: state.outline.length,
      });
    }

    const idx = state.sections.findIndex((s) => s.title === sectionTitle);
    if (idx >= 0) {
      state.sections[idx].content = content;
    } else {
      state.sections.push({ title: sectionTitle, content });
    }

    saveCheckpoint(state);
    notify('drafting', `Bagian "${sectionTitle}" tersimpan.`);
  }

  // Sanitize PUEBI & synchronize 1:1 citations vs bibliography
  const bodyOnly = state.sections.filter(
    (s) => !/^(?:daftar\s+pustaka|referensi|bibliography)\b/i.test(s.title.trim())
  );
  const { cleanedSections, citedSources } = syncBodyAndSources(bodyOnly, state.sources);
  if (citedSources.length >= 2) {
    state.sources = citedSources;
  }
  state.sections = [
    ...cleanedSections,
    {
      title: 'Daftar Pustaka',
      content: getBibliographySection(state.sources, state.citationStyle || 'apa'),
    },
  ];
  state.step = 'completed';
  saveCheckpoint(state);
  notify('completed', `Tugas "${state.topic}" selesai disusun!`);
  return state;
}
