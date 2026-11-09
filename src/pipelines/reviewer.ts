import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import * as cheerio from 'cheerio';
import { extractText } from 'unpdf';
import { generateText } from '../ai/client.js';
import { loadCheckpoint, saveCheckpoint, getTaskDir } from '../core/checkpoint.js';
import { exportToMarkdown } from '../exporter/markdown.js';
import { exportToDocx, exportRawDocx } from '../exporter/docx-builder.js';
import { exportToMarpSlide } from '../exporter/slide-builder.js';
import { exportToBibtex } from '../exporter/bibtex.js';
import { copyToDocuments } from '../core/downloads.js';
import {
  formatSourcesXml,
  getBibliographySection,
  buildLiteratureMatrixTable,
  sanitizeManuscriptText,
  syncBodyAndSources,
} from '../ai/prompts.js';
import { searchDork } from '../dorker/searcher.js';
import { extractSourcesSequential, isAcademicSource } from '../dorker/extractor.js';
import { verifySourceItems } from '../dorker/verifier.js';
import { logger } from '../core/logger.js';
import type { TaskState, SourceItem } from '../types/index.js';

function extractAcademicTopic(rawTitle: string, text: string): string {
  const firstLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 12 && !l.startsWith('*Jenis Dokumen') && !/^---+$/.test(l) && !/^#+\s*HASIL AUDIT/i.test(l));
  for (const line of firstLines.slice(0, 6)) {
    const cleaned = line.replace(/^#+\s*/, '').trim();
    if (cleaned.length >= 15 && cleaned.length <= 220 && !/^(?:abstrak|abstract|bab\s+[ivx0-9]+)\b/i.test(cleaned)) {
      return cleaned;
    }
  }
  return path
    .parse(rawTitle)
    .name.replace(/_(?:revisi|review|turnitin_pass)+$/gi, '')
    .replace(/^(?:makalah|skripsi|presentasi|lit-review)-/i, '')
    .replace(/-[0-9a-f]{6}$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || rawTitle;
}

async function fetchVerifiedIndonesianSources(topic: string, maxSources = 8): Promise<SourceItem[]> {
  try {
    const raw = await searchDork(topic, { maxResults: maxSources + 2, delayMs: 0 });
    const extracted = await extractSourcesSequential(raw, maxSources, true);
    return await verifySourceItems(extracted);
  } catch (err) {
    logger.warn(`Gagal mengambil referensi jurnal Indonesia tambahan: ${err}`);
    return [];
  }
}

export function readTextFromDocx(filePath: string): string {
  try {
    const xml = execFileSync('unzip', ['-p', filePath, 'word/document.xml'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const $ = cheerio.load(xml, { xmlMode: true });
    const paragraphs: string[] = [];
    $('w\\:p').each((_, p) => {
      let line = '';
      $(p)
        .find('w\\:t')
        .each((_, t) => {
          line += $(t).text();
        });
      if (line.trim()) paragraphs.push(line.trim());
    });
    return paragraphs.join('\n\n');
  } catch (err) {
    throw new Error(`Gagal membaca file .docx (${String(err)})`);
  }
}

export function resolveTargetFile(target: string): string {
  // 1. Direct path check
  if (fs.existsSync(target)) return path.resolve(target);

  // 2. Check in ~/Documents then ~/Downloads
  const inDocuments = path.join(os.homedir(), 'Documents', target);
  if (fs.existsSync(inDocuments)) return inDocuments;

  const inDownloads = path.join(os.homedir(), 'Downloads', target);
  if (fs.existsSync(inDownloads)) return inDownloads;

  // 3. Check in workspace directories
  const workspaceRoot = path.resolve(process.cwd(), 'workspace');
  if (fs.existsSync(workspaceRoot)) {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const inTask = path.join(workspaceRoot, e.name, target);
        if (fs.existsSync(inTask)) return inTask;
        if (target.toLowerCase() === 'docx' || target.toLowerCase() === 'output.docx') {
          const docx = path.join(workspaceRoot, e.name, 'output.docx');
          if (fs.existsSync(docx)) return docx;
        }
      }
    }
  }

  throw new Error(`File atau tugas "${target}" tidak ditemukan.`);
}

export async function reviewDocumentText(
  topic: string,
  content: string,
  focus = 'keseluruhan'
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const systemPrompt = `Kamu adalah reviewer jurnal akademik senior Indonesia (assessor SINTA/Dikti) dan dosen pembimbing berpengalaman.
Konteks Waktu Resmi: Tahun akademik saat ini adalah ${currentYear}. Artikel jurnal dengan tahun terbit hingga ${currentYear} adalah publikasi sahih yang sudah terbit (BUKAN tahun masa depan atau anakronisme).

Tugasmu: Lakukan Academic Quality & Feasibility Review secara objektif dan terukur terhadap naskah ilmiah berikut.

Kalibrasi Penilaian (0 - 100):
- 85 - 95 (Siap Kumpul): Komponen lengkap (Abstrak ID/EN + Kata Kunci, Pendahuluan, Tinjauan Pustaka/Matriks, Metode Penelitian/Studi Kepustakaan, Pembahasan analitis, Penutup, Daftar Pustaka), sitasi in-text sinkron dengan Daftar Pustaka dari jurnal ilmiah kredibel, bahasa Indonesia baku (PUEBI) rapi. Catatan: Untuk naskah berjenis Studi Kepustakaan Sistematis (*Literature Review*), tidak wajib ada sampel responden lapangan selama metode penelusuran & sintesis literatur dijelaskan eksplisit dan klaim mengacu pada temuan studi sekunder secara jujur.
- 75 - 84 (Perlu Revisi Minor): Struktur utama dan metodologi sudah ada, rujukan kredibel dan sinkron, namun masih ada kekurangan minor kedalaman elaborasi atau ketertiban cetak miring/redaksional.
- 55 - 74 (Perlu Revisi Mayor): Komponen wajib absen (misal tanpa Abstrak atau tanpa Metode), terdapat sitasi yatim yang tidak sinkron dengan Daftar Pustaka, atau pembahasan dangkal.
- < 55 (Tidak Layak): Rujukan tidak ilmiah/situs komersial/portal asing non-akademik (Douyin, Zhihu, blog), struktur rusak, atau banyak artefak kode.

Format hasil review WAJIB persis sebagai berikut:

# HASIL AUDIT & REVIEW AKADEMIK: "${topic.toUpperCase()}"
**Skor Kelayakan:** [angka bulat 0 - 100] / 100
**Status Kelayakan:** [Siap Kumpul / Perlu Revisi Minor / Perlu Revisi Mayor / Tidak Layak]

---

### 1. Struktur & Kelengkapan Komponen
- Evaluasi kelengkapan bagian (Judul, Abstrak & Kata Kunci, Pendahuluan, Tinjauan Pustaka, Metode Penelitian, Pembahasan, Penutup, Daftar Pustaka) dan keseimbangan proporsi.

### 2. Kualitas Substansi, Argumen & Metodologi
- Ketajaman rumusan masalah, kesesuaian metode penelitian/studi kepustakaan, dan kedalaman sintesis kritis.

### 3. Evaluasi Sitasi & Sinkronisasi Daftar Pustaka
- Ketercakupan 1:1 antara sitasi dalam teks dan Daftar Pustaka, serta kredibilitas jurnal rujukan (SINTA/DOAJ/Crossref/.ac.id).

### 4. PUEBI, EYD, Typo & Tata Bahasa
- Kepatuhan kata baku PUEBI, cetak miring istilah asing, dan keefektifan kalimat ilmiah.

### 5. Rekomendasi Revisi Konkret (Action Items)
- Poin perbaikan spesifik dan terukur sesuai temuan di atas.

Fokus telaah: ${focus}.
Gunakan bahasa Indonesia baku yang lugas dan objektif.`;

  return await generateText({
    prompt: `Naskah Dokumen Yang Direview:\n\n${content.slice(0, 150000)}`,
    systemPrompt,
    role: 'writer',
  });
}

export async function reviewTask(taskId: string, focus?: string): Promise<string> {
  const state = loadCheckpoint(taskId);
  if (!state) {
    throw new Error(`Tugas "${taskId}" tidak ditemukan di workspace.`);
  }

  const fullText = state.sections
    .map((s) => {
      const cleanTitle = s.title.replace(/\s*\([^)]*\)/g, '').trim();
      let body = s.content.trim();
      const firstLine = body.split('\n')[0].replace(/^#+\s*/, '').trim().toLowerCase();
      if (firstLine === cleanTitle.toLowerCase()) {
        body = body.split('\n').slice(1).join('\n').trim();
      }
      return `## ${cleanTitle}\n\n${body}`;
    })
    .join('\n\n');

  logger.step('REVIEW', `Memeriksa naskah tugas: "${state.topic}"...`);
  const reviewResult = await reviewDocumentText(state.topic, fullText, focus);

  const taskDir = getTaskDir(state.id);
  const reviewPath = path.join(taskDir, 'review.md');
  fs.writeFileSync(reviewPath, reviewResult, 'utf-8');

  copyToDocuments(state, { review: reviewPath });
  return reviewResult;
}

export async function readTextFromFile(resolved: string): Promise<string> {
  const ext = path.extname(resolved).toLowerCase();
  let text = '';
  if (ext === '.docx') {
    text = readTextFromDocx(resolved);
  } else if (ext === '.pdf') {
    const buffer = fs.readFileSync(resolved);
    const parsed = await extractText(new Uint8Array(buffer));
    text = Array.isArray(parsed.text) ? parsed.text.join('\n') : String(parsed.text);
  } else {
    text = fs.readFileSync(resolved, 'utf-8');
  }
  return text;
}

export async function reviewFile(targetInput: string, focus?: string): Promise<string> {
  const resolved = resolveTargetFile(targetInput);
  const ext = path.extname(resolved).toLowerCase();
  const fileName = path.basename(resolved, ext);

  logger.step('READ', `Membaca berkas: ${resolved} (${ext.toUpperCase()})`);
  const text = await readTextFromFile(resolved);

  if (!text || text.trim().length < 50) {
    throw new Error(`Gagal membaca isi dokumen dari file ${resolved}.`);
  }

  logger.step('REVIEW', `Memeriksa dokumen jadi: "${fileName}"...`);
  const reviewResult = await reviewDocumentText(fileName, text, focus);

  // Simpan hasil review ke ~/Documents
  const documentsDir = path.join(os.homedir(), 'Documents');
  const outReviewPath = path.join(documentsDir, `${fileName}_review.md`);
  fs.writeFileSync(outReviewPath, reviewResult, 'utf-8');
  logger.success(`Laporan review tersimpan di: ${outReviewPath}`);

  return reviewResult;
}

function parseScoreFromReport(report: string): number {
  // tolerate missing colon, markdown bold, or "Skor Kelayakan 85/100" variants
  // use lazy prefix so digits not consumed by [^:\n]*
  const match =
    report.match(/Skor[^:\n]*?:?\s*\*?\*?\s*([0-9]{1,3})\s*(?:\/|\s*dari\s*)\s*100/i) ||
    report.match(/([0-9]{1,3})\s*\/\s*100/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val) && val >= 0 && val <= 100) return val;
  }
  // fallback: standalone "Skor ... 85" without /100
  const m2 = report.match(/Skor[^0-9]{0,20}([0-9]{1,3})/i);
  if (m2) {
    const v2 = parseInt(m2[1], 10);
    if (!isNaN(v2) && v2 >= 0 && v2 <= 100) return v2;
  }
  return 50;
}

export interface DocumentSection {
  title: string;
  content: string;
}

// ponytail: split document by standard academic markdown headings, chapters, or paragraph blocks
export function splitDocumentSections(text: string): DocumentSection[] {
  const lines = text.split('\n');
  const rawSections: DocumentSection[] = [];
  let currentTitle = 'Pengantar';
  let currentLines: string[] = [];

  const headingPattern =
    /^(?:#{1,2}\s+(.+)|(BAB\s+[IVX0-9]+(?:\s*[:.-]\s*.*)?)|((?:ABSTRAK|ABSTRACT|PENDAHULUAN|TINJAUAN\s+PUSTAKA(?:\s+DAN\s+.*)?|LANDASAN\s+TEORI(?:\s+DAN\s+.*)?|METODE\s+PENELITIAN|METODOLOGI(?:\s+PENELITIAN)?|HASIL\s+DAN\s+PEMBAHASAN|PEMBAHASAN(?:\s+UTAMA.*)?|PENUTUP(?:\s+DAN\s+.*)?|KESIMPULAN(?:\s+DAN\s+SARAN)?|DAFTAR\s+PUSTAKA|REFERENSI)\s*[:.-]?\s*))$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip top-level H1 document title line (# JUDUL...) so it doesn't become a duplicate chapter
    if (/^#\s+/.test(trimmed) && !/^#\s+(?:BAB\s|ABSTRAK|DAFTAR\s+PUSTAKA)/i.test(trimmed) && rawSections.length === 0 && currentLines.length === 0) {
      continue;
    }
    const match = trimmed.match(headingPattern);
    if (match) {
      if (currentLines.length > 0) {
        const body = currentLines.join('\n').trim();
        if (body.length > 0) {
          rawSections.push({ title: currentTitle, content: body });
        }
        currentLines = [];
      }
      currentTitle = (match[1] || match[2] || match[3] || trimmed).replace(/^#+\s*/, '').trim();
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const body = currentLines.join('\n').trim();
    if (body.length > 0) {
      rawSections.push({ title: currentTitle, content: body });
    }
  }

  // Deduplicate repeated headings (keep richest section, drop short preamble noise)
  const deduped: DocumentSection[] = [];
  for (const sec of rawSections) {
    if (sec.title === 'Pengantar' && sec.content.replace(/\*Jenis Dokumen:.*?\*/gi, '').trim().length < 260) {
      continue;
    }
    const normKey = sec.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingIdx = deduped.findIndex((d) => d.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
    if (existingIdx >= 0) {
      if (sec.content.length > deduped[existingIdx].content.length) {
        deduped[existingIdx] = sec;
      }
    } else {
      deduped.push(sec);
    }
  }

  if (deduped.length <= 1 && text.length > 2000) {
    return [
      { title: 'ABSTRAK', content: '' },
      { title: 'BAB I: PENDAHULUAN', content: text.slice(0, 3500) },
      { title: 'BAB II: TINJAUAN PUSTAKA DAN KERANGKA TEORETIS', content: text.slice(3500, 7500) },
      { title: 'BAB III: METODE PENELITIAN', content: '' },
      { title: 'BAB IV: HASIL DAN PEMBAHASAN', content: text.slice(7500, 14000) || text.slice(0, 4000) },
      { title: 'BAB V: PENUTUP', content: text.slice(14000, 18000) },
    ];
  }

  return deduped;
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function ensureCompleteAcademicStructure(sections: DocumentSection[]): DocumentSection[] {
  const body = sections.filter(
    (s) => !/\b(?:pustaka|referensi|bibliography)\b/i.test(s.title)
  );

  const hasAbstract = body.some((s) => /\b(?:abstrak|abstract)\b/i.test(s.title));
  if (!hasAbstract) {
    body.unshift({ title: 'ABSTRAK', content: '' });
  }

  const fullTextJoin = body.map((s) => `${s.title}\n${s.content}`).join('\n');
  const hasMethod =
    body.some((s) => /\b(?:metode|metodologi)\b/i.test(s.title)) ||
    /^#{2,3}\s+.*\b(?:metode\s+penelitian|metodologi\s+penelitian|metode\s+kajian)\b/im.test(fullTextJoin);

  if (!hasMethod) {
    const discussIdx = body.findIndex((s) => /\b(?:pembahasan|hasil|analisis)\b/i.test(s.title));
    const closingIdx = body.findIndex((s) => /\b(?:penutup|kesimpulan|simpulan)\b/i.test(s.title));
    const insertAt = discussIdx >= 0 ? discussIdx : closingIdx >= 0 ? closingIdx : body.length;
    body.splice(insertAt, 0, { title: 'BAB: METODE PENELITIAN', content: '' });
  }

  const usesBabPrefix = body.some((s) => /^BAB\s+[IVX0-9]+/i.test(s.title));
  if (usesBabPrefix) {
    let babIdx = 0;
    for (const sec of body) {
      if (/^(?:abstrak|abstract)\b/i.test(sec.title.trim())) continue;
      const cleanLabel = sec.title.replace(/^BAB(?:\s+[IVX0-9]+)?\s*[:.-]?\s*/i, '').trim();
      const roman = ROMAN_NUMERALS[babIdx] || String(babIdx + 1);
      sec.title = `BAB ${roman}: ${cleanLabel.toUpperCase()}`;
      babIdx++;
    }
  }

  return body;
}

// ponytail: worker-pool, no dep. 3 slot cukup buat sisi provider, naikin kalau 429 jarang
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function buildSectionRevisionPrompt(
  docTopic: string,
  sec: DocumentSection,
  outlineSummary: string,
  auditReport: string,
  sourcesXml: string,
  allowedCitations: string
): string {
  const isAbstract = /\b(?:abstrak|abstract)\b/i.test(sec.title);
  if (isAbstract) {
    return `Judul Naskah: "${docTopic}"
Sumber Jurnal Ilmiah Indonesia Terverifikasi:
${sourcesXml}

Catatan Audit Reviewer:
${auditReport.slice(0, 4000)}

Draf Abstrak Saat Ini:
${sec.content || '(Belum ada Abstrak — susun baru secara utuh)'}

TUGAS PENYUSUNAN ABSTRAK DWIBAHASA (STANDAR JURNAL SINTA):
1. Tulis **Abstrak** Bahasa Indonesia (150-220 kata dalam 1 paragraf padat) yang merangkum latar belakang, tujuan kajian, metode penelitian (studi kepustakaan sistematis atas artikel jurnal terverifikasi), temuan sintesis utama, dan simpulan. Akhiri dengan baris **Kata Kunci:** (3-5 istilah).
2. Lanjutkan di bawahnya dengan ***Abstract*** Bahasa Inggris akademis yang setara (1 paragraf utuh) diakhiri baris ***Keywords:***.
3. JANGAN menyertakan sitasi dalam kurung di dalam Abstrak, jangan mengulang judul utama naskah, dan jangan menyertakan heading "## ABSTRAK" di baris pertama.`;
  }

  const isMethod = /\b(?:metode|metodologi)\b/i.test(sec.title);
  if (isMethod) {
    return `Judul Naskah: "${docTopic}"
Outline Dokumen:
${outlineSummary}

Sumber Jurnal Ilmiah Indonesia Terverifikasi:
${sourcesXml}
Sitasi Resmi yang Diizinkan: ${allowedCitations}

Draf Bagian Metode Saat Ini:
${sec.content || '(Belum ada bagian Metode Penelitian — susun baru secara komprehensif)'}

TUGAS PENYUSUNAN METODE PENELITIAN (500-650 KATA):
1. Tetapkan desain penelitian secara jujur dan metodologis sebagai **Studi Kepustakaan Terfokus (*Focused Literature Review* / Sintesis Literatur Naratif)** agar selaras dengan jumlah korpus jurnal rujukan dan tidak mengandung klaim responden lapangan fiktif maupun klaim SLR skala besar yang tidak proporsional.
2. Uraikan ke dalam sub-bab terstruktur (\`###\`): (a) Desain dan Pendekatan Penelitian, (b) Sumber Data dan Strategi Penelusuran Literatur (basis data DOAJ Indonesia, Crossref, SINTA, Garuda, repositori perguruan tinggi), (c) Kriteria Inklusi dan Eksklusi Literatur, serta (d) Teknik Ekstraksi dan Analisis Sintesis Kritis.
3. Sertakan satu diagram alur tahapan penelitian menggunakan blok \`\`\`mermaid\ngraph TD\n...\n\`\`\` yang valid.
4. Jika menyertakan sitasi, HANYA gunakan dari daftar ini: ${allowedCitations}. Jangan menulis sitasi penulis lain di luar daftar tersebut. Jangan mengulang judul bab utama di baris pertama.`;
  }

  const isLitReview = /\b(?:tinjauan\s+pustaka|landasan\s+teori|bab\s+(?:ii|2)\b)/i.test(sec.title);
  const matrixNote = isLitReview
    ? `\n5. WAJIB sertakan sub-bab "### Matriks Penelitian Terdahulu" berupa tabel Markdown lengkap yang memetakan jurnal-jurnal dari <verified_sources> (Peneliti & Tahun, Judul & Jurnal, Metode, Temuan Utama).`
    : '';

  return `Judul Naskah: "${docTopic}"
Outline Lengkap Dokumen:
${outlineSummary}

Sumber Jurnal Ilmiah Indonesia Terverifikasi:
${sourcesXml}
Sitasi Resmi yang WAJIB Digunakan Persis: ${allowedCitations}

Hasil Audit & Rekomendasi Reviewer:
---
${auditReport.slice(0, 6500)}
---

Bagian yang sedang direvisi: "${sec.title}"
Konten saat ini:
---
${sec.content || '(Bagian masih kosong — susun baru secara mendalam sesuai judul bagian)'}
---

TUGAS REVISI MENDALAM (500-800 KATA):
1. Tuntaskan seluruh kritik reviewer yang relevan untuk bagian "${sec.title}" dengan paragraf ilmiah analitis yang bernas (bukan sekadar poin pendek).
2. ATURAN SITASI MUTLAK 1:1: Gunakan HANYA sitasi persis dari daftar [${allowedCitations}]. HAPUS TOTAL sitasi situs komersial/portal asing (Douyin, Zhihu, dsb.) MAUPUN sitasi tokoh/penulis tahun (Nama, Tahun) yang TIDAK ada di <verified_sources> agar sinkron 100% dengan Daftar Pustaka.
3. Pastikan klaim efektivitas/data kuantitatif merujuk secara jujur pada temuan artikel di <verified_sources> (tidak mengarang eksperimen lapangan fiktif tanpa sumber).
4. Patuhi kata baku PUEBI ("analisis", "sistem", "standardisasi", "risiko", "praktik", "efektivitas", "autentik", "konkret", "diseminasi") dan cetak miring (*italic*) untuk seluruh istilah bahasa Inggris.${matrixNote}
5. Mulai langsung dari sub-bab (\`###\`) atau paragraf pertama tanpa mengulang judul bab "${sec.title}".`;
}

export async function reviseDocumentMultiPart(
  title: string,
  sections: DocumentSection[],
  auditReport: string,
  round: number,
  sourcesXml: string,
  verifiedSources: SourceItem[],
  onProgress?: (msg: string) => void
): Promise<string> {
  const structuredBody = ensureCompleteAcademicStructure(sections);
  const outlineSummary = [
    ...structuredBody.map((s, idx) => `${idx + 1}. ${s.title}`),
    `${structuredBody.length + 1}. Daftar Pustaka`,
  ].join('\n');
  const allowedCitations = verifiedSources.map((s) => s.citation).join(', ') || '(Gunakan sumber terverifikasi)';
  let done = 0;

  const revisedBody = await mapLimit(structuredBody, 2, async (sec): Promise<DocumentSection> => {
    const sectionPrompt = buildSectionRevisionPrompt(
      title,
      sec,
      outlineSummary,
      auditReport,
      sourcesXml,
      allowedCitations
    );

    let result: DocumentSection = sec;
    try {
      const revisedPart = await generateText({ prompt: sectionPrompt, role: 'writer' });
      if (revisedPart && revisedPart.trim().length > 80) {
        let cleaned = sanitizeManuscriptText(revisedPart);
        const firstLine = cleaned.split('\n')[0].replace(/^#+\s*/, '').trim().toLowerCase();
        const titleNorm = sec.title.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        if (
          firstLine === titleNorm ||
          firstLine.replace(/[^a-z0-9]/g, '') === titleNorm.replace(/[^a-z0-9]/g, '')
        ) {
          cleaned = cleaned.split('\n').slice(1).join('\n').trim();
        }
        if (
          /\b(?:tinjauan\s+pustaka|landasan\s+teori|bab\s+(?:ii|2)\b)/i.test(sec.title) &&
          !/\|\s*[-:]+/.test(cleaned) &&
          verifiedSources.length > 0
        ) {
          cleaned = `${cleaned}\n\n${buildLiteratureMatrixTable(verifiedSources)}`;
        }
        result = { title: sec.title, content: cleaned };
      }
    } catch (err) {
      logger.error(`Gagal merevisi bagian "${sec.title}": ${err}. Menggunakan teks asli.`);
    }

    done++;
    onProgress?.(`Putaran ${round}: Merevisi [${done}/${structuredBody.length}] "${sec.title.slice(0, 32)}"...`);
    logger.dim(`[${done}/${structuredBody.length}] Selesai: "${sec.title}"`);
    return result;
  });

  const { cleanedSections, citedSources } = syncBodyAndSources(revisedBody, verifiedSources);
  const assembledChapters = cleanedSections
    .filter((s) => s.content.trim().length > 0)
    .map((s) => `## ${s.title.replace(/^#+\s*/, '').trim()}\n\n${s.content.trim()}`)
    .join('\n\n');
  const bibSection = getBibliographySection(citedSources, 'apa');

  return `# ${title.toUpperCase()}\n\n${assembledChapters}\n\n${bibSection}`;
}

export async function autoReviseDocumentText(
  title: string,
  originalText: string,
  initialAuditReport: string,
  targetThreshold = 82,
  onProgress?: (msg: string) => void
): Promise<{
  revisedText: string;
  docxPath: string;
  mdPath: string;
  bibPath: string;
  fileName: string;
  finalScore: number;
  rounds: number;
  finalReport: string;
}> {
  logger.step('REVISE', `Menjalankan auto-revisi akademik untuk "${title}" (Target Threshold: ${targetThreshold}/100)...`);

  const docTopic = extractAcademicTopic(title, originalText);
  onProgress?.(`Mencari referensi jurnal ilmiah Indonesia terverifikasi untuk "${docTopic.slice(0, 60)}"...`);
  const verifiedSources = await fetchVerifiedIndonesianSources(docTopic, 8);
  const sourcesXml = formatSourcesXml(verifiedSources);

  let currentText = sanitizeManuscriptText(originalText);
  let currentReport = initialAuditReport;
  let currentScore = parseScoreFromReport(initialAuditReport);
  let bestText = currentText;
  let bestReport = currentReport;
  let bestScore = currentScore;
  let round = 1;
  const maxRounds = 3;

  logger.info(`Skor awal naskah: ${currentScore}/100`);

  while (currentScore < targetThreshold && round <= maxRounds) {
    logger.step('REVISE', `[Putaran ${round}/${maxRounds}] Skor saat ini ${currentScore}/100 < ${targetThreshold}/100. Merevisi naskah...`);
    onProgress?.(`Putaran ${round}/${maxRounds} (Skor ${currentScore}/100): Menyempurnakan struktur, metode & sitasi...`);

    const sections = splitDocumentSections(currentText);
    logger.step('MULTI-PART', `[Putaran ${round}] Menjalankan revisi terstruktur untuk ${sections.length} bagian naskah...`);
    const candidate = await reviseDocumentMultiPart(
      docTopic,
      sections,
      currentReport,
      round,
      sourcesXml,
      verifiedSources,
      onProgress
    );

    if (candidate && candidate.trim().length > 200) {
      currentText = candidate;
    }

    logger.step('AUDIT', `[Putaran ${round}] Menguji ulang naskah hasil perbaikan...`);
    onProgress?.(`Putaran ${round}/${maxRounds}: Menguji ulang kelayakan akademik...`);
    currentReport = await reviewDocumentText(docTopic, currentText);
    const newScore = parseScoreFromReport(currentReport);
    logger.info(`Hasil evaluasi putaran ${round}: Skor ${newScore}/100 (sebelumnya ${currentScore}/100)`);
    onProgress?.(`Putaran ${round}/${maxRounds}: Skor tercapai ${newScore}/100`);

    if (newScore >= bestScore) {
      bestScore = newScore;
      bestText = currentText;
      bestReport = currentReport;
    }

    const prevScore = currentScore;
    currentScore = newScore;
    round++;
    if (currentScore >= targetThreshold) break;
    if (round > 2 && newScore <= prevScore) {
      logger.warn(`Skor tidak bertambah pada putaran ${round - 1} (${newScore}/100) — menghentikan iterasi.`);
      break;
    }
  }

  if (bestScore > currentScore) {
    currentScore = bestScore;
    currentText = bestText;
    currentReport = bestReport;
  }

  logger.success(`Auto-revisi selesai! Skor akhir: ${currentScore}/100 (dalam ${Math.max(1, round - 1)} putaran)`);

  const baseName = path.parse(title).name.replace(/_revisi$/i, '');
  const documentsDir = path.join(os.homedir(), 'Documents');
  fs.mkdirSync(documentsDir, { recursive: true });

  const mdPath = path.join(documentsDir, `${baseName}_revisi.md`);
  fs.writeFileSync(mdPath, currentText, 'utf-8');

  const docxPath = path.join(documentsDir, `${baseName}_revisi.docx`);
  await exportRawDocx(docTopic, currentText, docxPath);

  const bibPath = path.join(documentsDir, `${baseName}_revisi.bib`);
  const safeTag = baseName.replace(/[^a-zA-Z0-9]/g, '_');
  const bibEntries =
    verifiedSources.length > 0
      ? verifiedSources
          .map((s, idx) => {
            const authorStr = s.authors && s.authors.length > 0 ? s.authors.join(' and ') : 'Peneliti Indonesia';
            return `@article{${safeTag}_ref_${idx + 1},\n  author = {${authorStr}},\n  title = {${s.title}},\n  year = {${s.year || new Date().getFullYear()}},\n  url = {${s.url}}${s.doi ? `,\n  doi = {${s.doi}}` : ''}\n}`;
          })
          .join('\n\n')
      : `@article{${safeTag}_rev,\n  title={${docTopic}},\n  year={${new Date().getFullYear()}}\n}`;
  const bibContent = `% BibTeX generated by TGSDORK Auto-Revise for ${docTopic}\n\n${bibEntries}\n`;
  fs.writeFileSync(bibPath, bibContent, 'utf-8');

  const revReportPath = path.join(documentsDir, `${baseName}_revisi_review.md`);
  fs.writeFileSync(revReportPath, currentReport, 'utf-8');

  return {
    revisedText: currentText,
    docxPath,
    mdPath,
    bibPath,
    fileName: baseName,
    finalScore: currentScore,
    rounds: Math.max(1, round - 1),
    finalReport: currentReport,
  };
}

export async function reviseTask(
  taskId: string,
  instruction: string,
  targetSectionTitle?: string
): Promise<TaskState> {
  const state = loadCheckpoint(taskId);
  if (!state) {
    throw new Error(`Tugas "${taskId}" tidak ditemukan di workspace.`);
  }

  logger.step('REVISE', `Menerapkan revisi pada tugas: "${state.topic}"...`);
  logger.dim(`Instruksi: "${instruction}"`);

  // ponytail: bersihkan sumber sampah/Cina lama & isi ulang dengan jurnal Indonesia terverifikasi
  state.sources = state.sources.filter(isAcademicSource);
  const nonCustomCount = state.sources.filter((s) => !s.id.startsWith('custom-ref-')).length;
  if (nonCustomCount < 4) {
    const freshIndo = await fetchVerifiedIndonesianSources(state.topic, 6);
    for (const f of freshIndo) {
      if (!state.sources.some((s) => s.url === f.url || s.title.toLowerCase() === f.title.toLowerCase())) {
        state.sources.push(f);
      }
    }
  }

  const sourcesXml = formatSourcesXml(state.sources);
  const allowedCitations = state.sources.map((s) => s.citation).join(', ') || '(Gunakan sumber terverifikasi)';

  const systemPrompt = `Kamu adalah pakar penulisan akademik Indonesia yang bertugas merevisi draf karya ilmiah agar mencapai standar kelayakan >= 85/100.
Instruksi revisi:
"${instruction}"

Pedoman Wajib:
1. HANYA gunakan sitasi persis dari daftar [${allowedCitations}] pada <verified_sources>. DILARANG menulis sitasi tahun (Nama, Tahun) untuk tokoh/penulis di luar daftar tersebut.
2. HAPUS TOTAL sitasi situs komersial, media sosial, atau portal asing non-akademik (Douyin, Zhihu, Baidu, Weixin, dsb.) jika ada di draf lama.
3. Patuhi kata baku PUEBI dan cetak miring (*italic*) seluruh istilah asing tanpa menyisipkan blok/komentar kode.`;

  if (targetSectionTitle) {
    const sec = state.sections.find((s) =>
      s.title.toLowerCase().includes(targetSectionTitle.toLowerCase())
    );
    if (!sec) {
      throw new Error(`Bagian "${targetSectionTitle}" tidak ditemukan dalam draf.`);
    }

    const revisedContent = await generateText({
      prompt: `Sumber rujukan jurnal Indonesia terverifikasi:\n${sourcesXml}\nSitasi Resmi: ${allowedCitations}\n\nBagian yang direvisi: "${sec.title}"\nKonten awal:\n${sec.content}\n\nInstruksi perbaikan:\n${instruction}\n\nTuliskan ulang isi lengkap bagian ini setelah direvisi (tanpa mengulang judul bab utama):`,
      systemPrompt,
      role: 'writer',
    });

    sec.content = sanitizeManuscriptText(revisedContent);
    const bodyOnly = state.sections.filter(
      (s) => !/\b(?:pustaka|referensi|bibliography)\b/i.test(s.title)
    );
    const { cleanedSections, citedSources } = syncBodyAndSources(bodyOnly, state.sources);
    state.sections = [
      ...cleanedSections,
      {
        title: 'Daftar Pustaka',
        content: getBibliographySection(citedSources.length > 0 ? citedSources : state.sources, state.citationStyle || 'apa'),
      },
    ];
  } else {
    const structured =
      state.taskType === 'makalah' || state.taskType === 'skripsi'
        ? ensureCompleteAcademicStructure(state.sections)
        : state.sections.filter((s) => !/\b(?:pustaka|referensi|bibliography)\b/i.test(s.title));

    const outlineSummary = [
      ...structured.map((s, idx) => `${idx + 1}. ${s.title}`),
      `${structured.length + 1}. Daftar Pustaka`,
    ].join('\n');

    const revisedBody = await mapLimit(structured, 2, async (sec) => {
      const prompt = buildSectionRevisionPrompt(
        state.topic,
        sec,
        outlineSummary,
        instruction,
        sourcesXml,
        allowedCitations
      );
      try {
        const revised = await generateText({ prompt, systemPrompt, role: 'writer' });
        if (revised && revised.trim().length > 80) {
          let cleaned = sanitizeManuscriptText(revised);
          const firstLine = cleaned.split('\n')[0].replace(/^#+\s*/, '').trim().toLowerCase();
          const titleNorm = sec.title.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
          if (
            firstLine === titleNorm ||
            firstLine.replace(/[^a-z0-9]/g, '') === titleNorm.replace(/[^a-z0-9]/g, '')
          ) {
            cleaned = cleaned.split('\n').slice(1).join('\n').trim();
          }
          if (
            /\b(?:tinjauan\s+pustaka|landasan\s+teori|bab\s+(?:ii|2)\b)/i.test(sec.title) &&
            !/\|\s*[-:]+/.test(cleaned) &&
            state.sources.length > 0
          ) {
            cleaned = `${cleaned}\n\n${buildLiteratureMatrixTable(state.sources)}`;
          }
          return { title: sec.title, content: cleaned };
        }
      } catch (err) {
        logger.warn(`Gagal merevisi bagian ${sec.title}: ${err}`);
      }
      return sec;
    });

    const { cleanedSections, citedSources } = syncBodyAndSources(revisedBody, state.sources);
    if (citedSources.length >= 2) {
      state.sources = citedSources;
    }
    state.outline = cleanedSections.map((s) => s.title);
    state.sections = [
      ...cleanedSections,
      {
        title: 'Daftar Pustaka',
        content: getBibliographySection(state.sources, state.citationStyle || 'apa'),
      },
    ];
  }

  saveCheckpoint(state);

  const mdFile = exportToMarkdown(state);
  const docxFile = await exportToDocx(state);
  const slides = exportToMarpSlide(state);
  const bibFile = exportToBibtex(state);

  copyToDocuments(state, {
    docx: docxFile,
    md: mdFile,
    html: slides.htmlPath,
    bib: bibFile,
  });

  logger.success(`Revisi selesai dan diekspor ulang ke workspace & ~/Documents!`);
  return state;
}

export async function autoReviseTask(taskId: string, targetThreshold = 82): Promise<TaskState> {
  let state = loadCheckpoint(taskId);
  if (!state) {
    throw new Error(`Tugas "${taskId}" tidak ditemukan.`);
  }

  let reviewText = await reviewTask(taskId);
  let score = parseScoreFromReport(reviewText);
  let round = 1;
  const maxRounds = 3;

  logger.info(`Skor awal tugas ${taskId}: ${score}/100`);

  while (score < targetThreshold && round <= maxRounds) {
    logger.step('AUTO-REVISE', `[Putaran ${round}/${maxRounds}] Skor ${score}/100 < ${targetThreshold}/100. Merevisi bagian naskah...`);
    const instruction = `Terapkan perbaikan menyeluruh berdasarkan hasil evaluasi peer review berikut hingga mencapai skor >= ${targetThreshold}/100:\n\n${reviewText.slice(0, 30000)}`;
    state = await reviseTask(taskId, instruction);

    const prevScore = score;
    reviewText = await reviewTask(taskId);
    score = parseScoreFromReport(reviewText);
    logger.info(`Hasil evaluasi tugas putaran ${round}: Skor ${score}/100`);
    round++;
    if (score >= targetThreshold) break;
    if (round > 2 && score <= prevScore) break;
  }

  logger.success(`Auto-Revise tugas ${taskId} selesai! Skor akhir: ${score}/100`);
  return state;
}
