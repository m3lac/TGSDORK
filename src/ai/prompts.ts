import type { SourceItem, CitationStyle } from '../types/index.js';
import { applyHumanizerId, HUMANIZER_ID_EDITORIAL_RULES } from '../core/humanizer-id.js';

const CITATION_OVERRIDE: Record<CitationStyle, string> = {
  apa: '',
  ieee: `GAYA SITASI WAJIB: IEEE.
   - Sitasi dalam teks memakai penomoran numerik dalam kurung siku sesuai urutan kemunculan: [1], [2], [3]. Contoh: "Sistem terdistribusi menuntut konsistensi data [1], [3]."
   - Jangan memakai format (Penulis, Tahun) sama sekali.
   - Daftar Pustaka bernomor [1], [2], [3] sesuai urutan kemunculan di naskah.`,
  harvard: `GAYA SITASI WAJIB: HARVARD (Author-Date).
   - In-text citation: Gunakan (Penulis Tahun) tanpa koma antara nama dan tahun, contoh: (Prasetyo 2023) atau "Menurut Prasetyo (2023)...".
   - Daftar Pustaka disusun alfabetis tanpa penomoran angka: Penulis Tahun, 'Judul Artikel', Nama Jurnal/Penerbit, URL.`,
};

export function citationRule(style: CitationStyle = 'apa'): string {
  return CITATION_OVERRIDE[style] || '';
}

export function formatSourcesXml(sources: SourceItem[]): string {
  if (sources.length === 0) {
    return '<verified_sources>\n  <note>Tidak ada sumber eksternal yang diunduh. Gunakan pengetahuan umum tanpa membuat sitasi fiktif.</note>\n</verified_sources>';
  }

  const items = sources.map((s, idx) => {
    const content = (s.content || s.snippet || '').slice(0, 3000);
    return `  <source id="ref_${idx + 1}" citation="${s.citation}" full_ref="${s.fullRef}">
    <title>${s.title}</title>
    <url>${s.url}</url>
    <content>
${content}
    </content>
  </source>`;
  });

  return `<verified_sources>\n${items.join('\n')}\n</verified_sources>`;
}

const BAKU_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstandarisasi\b/gi, 'standardisasi'],
  [/\banalisa\b/gi, 'analisis'],
  [/\bsistim\b/gi, 'sistem'],
  [/\bresiko\b/gi, 'risiko'],
  [/\bpraktek\b/gi, 'praktik'],
  [/\baktifitas\b/gi, 'aktivitas'],
  [/\befektifitas\b/gi, 'efektivitas'],
  [/\bkwalitas\b/gi, 'kualitas'],
  [/\botentik\b/gi, 'autentik'],
  [/\bkonkrit\b/gi, 'konkret'],
  [/\bhapal\b/gi, 'hafal'],
  [/\bdesiminasi\b/gi, 'diseminasi'],
  [/\bhipotesa\b/gi, 'hipotesis'],
  [/\bmetoda\b/gi, 'metode'],
  [/\bketrampilan\b/gi, 'keterampilan'],
  [/\bmerubah\b/gi, 'mengubah'],
  [/\bteoritis\b/gi, 'teoretis'],
];

function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function sanitizeManuscriptText(raw: string): string {
  let out = raw.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
  out = out
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```([a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g, (full, lang: string, content: string) => {
      const l = (lang || '').toLowerCase();
      if (l === 'mermaid') return full;
      if (l === 'markdown' || l === 'md' || !l) return content;
      return '';
    })
    .replace(/^.*(?:(?:→|->)\s*skipped:|\bponytail:).*$/gim, '')
    .replace(/^[ \t]*(?:[-*]\s*)?(?:\*\*|\*|`)?(?:skipped|add when|risk|risks)\s*:.*$/gim, '');

  for (const [pattern, target] of BAKU_REPLACEMENTS) {
    out = out.replace(pattern, (m) => matchCase(m, target));
  }
  out = applyHumanizerId(out);

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function extractSourceKeyTokens(src: SourceItem): string[] {
  const tokens: string[] = [];
  const citClean = (src.citation || '')
    .replace(/[()]/g, '')
    .replace(/\bet\s+al\.?/gi, '')
    .replace(/,\s*\d{4}[a-z]?/g, '')
    .trim();
  for (const part of citClean.split(/[&,]/)) {
    const t = part.trim().toLowerCase();
    if (t.length >= 3) tokens.push(t);
  }
  for (const auth of src.authors || []) {
    const words = auth
      .replace(/[.,]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    if (words.length > 0) {
      tokens.push(words[words.length - 1].toLowerCase());
      tokens.push(words[0].toLowerCase());
    }
  }
  return [...new Set(tokens)];
}

/**
 * Bersihkan sitasi kurung (Nama, Tahun) yatim yang tidak ada di <verified_sources>,
 * lalu kembalikan subset sumber yang benar-benar disitasi di dalam teks untuk sinkronisasi 1:1.
 */
export function syncBodyAndSources(
  bodySections: Array<{ title: string; content: string }>,
  sources: SourceItem[]
): { cleanedSections: Array<{ title: string; content: string }>; citedSources: SourceItem[] } {
  if (sources.length === 0) {
    return { cleanedSections: bodySections, citedSources: [] };
  }

  const sourceTokenMap = sources.map((s) => ({
    source: s,
    tokens: extractSourceKeyTokens(s),
    year: (s.year || '').trim(),
  }));

  const isClauseVerified = (clause: string): boolean => {
    const low = clause.toLowerCase();
    return sourceTokenMap.some(({ tokens }) => tokens.some((tk) => low.includes(tk)));
  };

  // Clean parenthetical citations like (Dewey, 1938) or (Pratiwi et al., 2024; Russell & Norvig, 2020)
  const cleanedSections = bodySections.map((sec) => {
    if (/^(?:abstrak|abstract)\b/i.test(sec.title.trim())) {
      const cleanAbs = sanitizeManuscriptText(sec.content).replace(
        /\s*\([A-Z][A-Za-zÀ-ÿ'.,&\s-]{1,45},\s*(?:19|20)\d{2}[a-z]?\)/g,
        ''
      );
      return { title: sec.title, content: cleanAbs };
    }

    let text = sanitizeManuscriptText(sec.content);
    text = text.replace(/\(([^()\n]{3,120})\)/g, (full, inner: string) => {
      if (!/\b(?:19|20)\d{2}\b/.test(inner)) return full;
      // Skip non-citation parentheses like (2020-2024) or (lihat Tabel 2.1, 2024)
      if (/^(?:tahun|periode|sejak|data|tabel|gambar|pasal|uu)\b/i.test(inner.trim())) return full;
      if (/^\d{4}\s*[-–]\s*\d{4}$/.test(inner.trim())) return full;

      const clauses = inner.split(';').map((c) => c.trim()).filter(Boolean);
      const kept = clauses.filter(isClauseVerified);
      if (kept.length === 0) return '';
      return `(${kept.join('; ')})`;
    });

    // Also clean narrative "Menurut X (2020)" if X is not in verified sources -> "Berdasarkan kajian teoretis"
    text = text.replace(
      /\b([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+(?:&|dan|and)\s+[A-Z][a-zA-ZÀ-ÿ'-]+|\s+et\s+al\.)?)\s*\(((?:19|20)\d{2}[a-z]?)\)/g,
      (full, authorPart: string, yr: string) => {
        if (isClauseVerified(`${authorPart} ${yr}`)) return full;
        return authorPart;
      }
    );

    text = text.replace(/[ ]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1');
    return { title: sec.title, content: text };
  });

  const combinedBody = cleanedSections.map((s) => s.content).join('\n').toLowerCase();
  const citedSources = sourceTokenMap
    .filter(({ tokens }) => tokens.some((tk) => combinedBody.includes(tk)))
    .map((x) => x.source);

  return {
    cleanedSections,
    citedSources: citedSources.length > 0 ? citedSources : sources,
  };
}

export const ACADEMIC_WRITING_RULES = `
STANDAR MUTU PENULISAN KARYA ILMIAH INDONESIA (TARGET AUDIT >= 85/100):
1. KEDALAMAN SUBSTANSI & PROPORSIONALITAS:
   - Tulis kupasan ilmiah mendalam, analitis, dan terstruktur dalam paragraf utuh (minimal 450-750 kata untuk setiap bab utama), terbagi ke dalam sub-bab bernomor/tematik (### Sub-Judul).
   - Hindari daftar poin pendek berhuruf tebal ("- **Judul:** kalimat pendek") yang berlebihan; utamakan sintesis paragraf akademis yang mengalir.
   - Hindari klise AI generik ("di era digital yang berkembang pesat", "lanskap yang terus berubah", "bukan sekadar X melainkan Y", "menjadi bukti nyata"). Langsung masuk ke argumen, data literatur, dan analisis mekanisme.
2. DISIPLIN SITASI 1:1 & ANTI-HALUSINASI:
   - HANYA gunakan sitasi persis seperti atribut citation="..." di dalam blok <verified_sources>.
   - DILARANG KERAS menulis sitasi tahun (Nama, Tahun) untuk penulis/tokoh di luar <verified_sources> (seperti menulis (Sugiyono, 2019) atau (Dewey, 1938) yang tidak ada di <verified_sources>) karena akan merusak sinkronisasi 1:1 Daftar Pustaka. Jika membahas teori dasar, sebutkan nama konsep/teorinya secara naratif atau rujuk melalui artikel di <verified_sources>.
   - Gunakan minimal 3-5 sumber berbeda dari <verified_sources> secara proporsional di sepanjang naskah.
3. KEPATUHAN PUEBI/EYD & TIPOGRAFI ILMIAH:
   - Wajib kata baku PUEBI: "analisis" (bukan analisa), "sistem" (bukan sistim), "standardisasi" (bukan standarisasi), "efektivitas" (bukan efektifitas), "risiko" (bukan resiko), "praktik" (bukan praktek), "aktivitas" (bukan aktifitas), "autentik" (bukan otentik), "konkret" (bukan konkrit), "diseminasi" (bukan desiminasi).
   - Cetak miring (*italic*) SELURUH istilah bahasa Inggris/asing secara konsisten (contoh: *project-based learning*, *scaffolding*, *systematic literature review*, *pre-test*, *dataset*).
4. FORMAT BERSIH TANPA ARTEFAK MESIN:
   - DILARANG menyisipkan komentar HTML/kode, blok kode pemrograman (selain diagram \`\`\`mermaid pada bagian metodologi/kerangka), atau kalimat pengantar percakapan.
${HUMANIZER_ID_EDITORIAL_RULES}
`;

export function getOutlinePrompt(
  topic: string,
  taskType: string,
  sourcesXml: string,
  chapterCount?: number,
  customChapters?: string[]
): string {
  if (customChapters && customChapters.length > 0) {
    return JSON.stringify({ outline: customChapters });
  }

  let instructions = '';
  if (taskType === 'skripsi') {
    const countNote = chapterCount ? `(${chapterCount} bab utama + ABSTRAK di awal)` : 'lengkap standar Dikti';
    instructions = `Rancang outline ${countNote} untuk Naskah Skripsi/Tesis Akademik Standar Dikti:
- ABSTRAK
- BAB I: PENDAHULUAN
- BAB II: LANDASAN TEORI DAN TINJAUAN PUSTAKA
- BAB III: METODOLOGI PENELITIAN
- BAB IV: HASIL PENELITIAN DAN PEMBAHASAN
- BAB V: KESIMPULAN DAN SARAN`;
  } else if (taskType === 'makalah') {
    if (chapterCount === 3) {
      instructions = `Rancang outline Makalah Ilmiah ringkas (ABSTRAK + 3 bab):
- ABSTRAK
- BAB I: PENDAHULUAN DAN METODE KAJIAN
- BAB II: TINJAUAN PUSTAKA DAN PEMBAHASAN
- BAB III: PENUTUP`;
    } else if (chapterCount === 4) {
      instructions = `Rancang outline Makalah Ilmiah standar (ABSTRAK + 4 bab lengkap dengan metode kajian):
- ABSTRAK
- BAB I: PENDAHULUAN
- BAB II: TINJAUAN PUSTAKA DAN METODE KAJIAN
- BAB III: HASIL DAN PEMBAHASAN
- BAB IV: PENUTUP`;
    } else {
      instructions = `Rancang outline Makalah Ilmiah berstandar jurnal/kampus lengkap (wajib ada ABSTRAK dan BAB METODE PENELITIAN mandiri):
- ABSTRAK
- BAB I: PENDAHULUAN
- BAB II: TINJAUAN PUSTAKA DAN KERANGKA TEORETIS
- BAB III: METODE PENELITIAN
- BAB IV: HASIL DAN PEMBAHASAN
- BAB V: PENUTUP`;
    }
  } else if (taskType === 'presentasi') {
    instructions = `Buat outline ${chapterCount || 5} slide presentasi akademis terstruktur (Contoh: "Slide 1: Pendahuluan", dst).`;
  } else {
    instructions = `Buat outline ${chapterCount || 4} bagian Literature Review komparatif lengkap dengan Abstrak dan Metode Seleksi Literatur.`;
  }

  return `${ACADEMIC_WRITING_RULES}

Sumber referensi terverifikasi:
${sourcesXml}

Topik: "${topic}"
Jenis Tugas: ${taskType}

${instructions}

ATURAN STRUKTUR OUTLINE:
- Judul bab pada array "outline" WAJIB HANYA nama bab utama tanpa rincian sub-bab di dalam tanda kurung.

Wajib kembalikan dalam format JSON murni:
{
  "outline": [
    "ABSTRAK",
    "BAB I: PENDAHULUAN",
    ...
  ]
};`;
}

export function getSectionPrompt(
  topic: string,
  taskType: string,
  sectionTitle: string,
  sourcesXml: string,
  previousSectionsSummary?: string,
  citationStyle: CitationStyle = 'apa'
): string {
  const isAbstract = /^(?:abstrak|abstract)\b/i.test(sectionTitle.trim());
  if (isAbstract) {
    return `${ACADEMIC_WRITING_RULES}

Sumber referensi terverifikasi (untuk konteks temuan):
${sourcesXml}

Topik Penelitian: "${topic}"
Jenis Dokumen: ${taskType.toUpperCase()}

TUGAS PENULISAN ABSTRAK DWIBAHASA (STANDAR JURNAL NASIONAL):
1. Tulis sub-bagian **Abstrak** (Bahasa Indonesia, 150-220 kata dalam satu paragraf padat) yang memuat secara berurutan: latar belakang masalah, tujuan kajian, metode penelitian (studi kepustakaan sistematis / analisis literatur terverifikasi), temuan utama sintesis, dan implikasi/simpulan. Akhiri dengan baris **Kata Kunci:** (3-5 istilah kunci dipisah koma).
2. Di bawahnya, tulis sub-bagian ***Abstract*** (Bahasa Inggris akademis yang setara dalam satu paragraf utuh) diakhiri baris ***Keywords:*** (3-5 istilah).
3. JANGAN menyertakan sitasi dalam kurung di dalam Abstrak dan jangan mengulang judul utama dokumen.`;
  }

  const isLitReviewSection = /(bab\s*(ii|2)\b|tinjauan\s*pustaka|landasan\s*teori|kajian\s*pustaka|matriks|literature)/i.test(sectionTitle);
  const matrixRule = isLitReviewSection
    ? `\n- WAJIB SERTAKAN SUB-BAB "### Matriks Penelitian Terdahulu" yang memuat Tabel Markdown (\`| No | Peneliti & Tahun | Judul & Jurnal | Fokus / Metode | Temuan Utama |\`) yang memetakan sumber-sumber dari <verified_sources> secara akurat.`
    : '';

  const isMethodologySection = /(metodologi|metode\s*penelitian|metode\s*kajian)/i.test(sectionTitle);
  const methodologyRule = isMethodologySection
    ? `\n- Karena naskah ini disusun berbasis literatur ilmiah terverifikasi, tetapkan desain penelitian secara jujur dan metodologis sebagai **Studi Kepustakaan Terfokus (*Focused Literature Review* / Sintesis Literatur Naratif)** (kecuali data eksperimen primer memang dilampirkan pada sumber). Jabarkan secara rinci: (a) pendekatan & desain kajian pustaka terfokus, (b) sumber data sekunder & basis data jurnal nasional (DOAJ Indonesia, Crossref, SINTA, Garuda, repositori perguruan tinggi), (c) kata kunci pencarian serta kriteria inklusi-eksklusi literatur, dan (d) teknik analisis sintesis tematik komparatif.\n- WAJIB SERTAKAN diagram alur tahapan penelitian dalam blok \`\`\`mermaid\ngraph TD\n  A[Identifikasi Masalah] --> B[Penelusuran Literatur]\n  ...\n\`\`\` dengan sintaks node yang bersih.`
    : '';

  return `${ACADEMIC_WRITING_RULES}
${citationRule(citationStyle)}

Sumber referensi terverifikasi:
${sourcesXml}

Topik Keseluruhan: "${topic}"
Jenis Dokumen: ${taskType.toUpperCase()}
Bagian yang Sedang Disusun: "${sectionTitle}"
${previousSectionsSummary ? `Konteks Bagian Sebelumnya:\n${previousSectionsSummary}\n` : ''}

INSTRUKSI PENULISAN BAB:
Tuliskan isi bagian "${sectionTitle}" secara komprehensif (500-800 kata) tanpa mengulang judul utama "${sectionTitle}" di baris pertama.
- Bagi ke dalam sub-bab terstruktur menggunakan heading \`###\`.
- Integrasikan sitasi HANYA dari <verified_sources> secara akurat; dilarang menulis sitasi (Nama, Tahun) di luar <verified_sources>.
- Pastikan tidak mengklaim uji lapangan/responden fiktif apabila metode yang digunakan adalah studi kepustakaan sistematis; gunakan data empiris yang dilaporkan oleh jurnal pada <verified_sources> dengan atribusi sitasi yang jelas.${matrixRule}${methodologyRule}`;
}

export function buildLiteratureMatrixTable(sources: SourceItem[]): string {
  if (!sources || sources.length === 0) return '';
  const rows = sources.slice(0, 8).map((s, idx) => {
    const ref = (s.citation || `Sumber ${idx + 1}`).replace(/^\(|\)$/g, '').replace(/\|/g, '/');
    const title = (s.title || 'Penelitian Terkait').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 90);
    const summary = (s.snippet || s.content || 'Kajian empiris dan teoretis terkait topik penelitian.')
      .replace(/\|/g, '/')
      .replace(/\s+/g, ' ')
      .slice(0, 140);
    return `| ${idx + 1} | ${ref} | ${title} | Studi Empiris / Literatur | ${summary}... |`;
  });
  return [
    '### Matriks Penelitian Terdahulu',
    '',
    '| No | Peneliti & Tahun | Judul Penelitian | Metode | Temuan Utama & Relevansi |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export function getBibliographySection(sources: SourceItem[], citationStyle: CitationStyle = 'apa'): string {
  if (sources.length === 0) return '## Daftar Pustaka\n\n*(Tidak ada referensi eksternal yang diunduh)*\n';

  const sorted = citationStyle === 'ieee'
    ? [...sources]
    : [...sources].sort((a, b) => (a.fullRef || '').localeCompare(b.fullRef || '', 'id'));

  const list = sorted
    .map((s, idx) => {
      if (citationStyle === 'ieee') {
        return `[${idx + 1}] ${s.fullRef}`;
      }
      if (citationStyle === 'harvard') {
        const cleanYear = s.year || '2024';
        const cleanAuth = s.authors && s.authors.length > 0
          ? s.authors.join(', ')
          : (s.citation || '').replace(/[()]/g, '').replace(/,\s*\d{4}/, '') || 'Anonim';
        return `${cleanAuth} ${cleanYear}, '${s.title}', dilihat ${new Date().getFullYear()}, <${s.url}>.`;
      }
      return `${idx + 1}. ${s.fullRef}`;
    })
    .join('\n\n');

  return `## Daftar Pustaka\n\n${list}\n`;
}
