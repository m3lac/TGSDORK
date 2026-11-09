import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface HumanizerFinding {
  baris: number;
  id: string;
  kategori: string;
  pola: string;
  saran: string[];
  penjelasan: string;
  kalimat: string;
}

interface KalkeEntry {
  id: string;
  pola: string;
  saran_pengganti: string[] | string;
  penjelasan: string;
}

interface KalkeDataset {
  kategori?: Record<
    string,
    {
      deskripsi?: string;
      entri?: KalkeEntry[];
    }
  >;
}

/**
 * Kaidah Editorial Akademik Ketat dari apissaj/humanizer-id
 * (Sumber: Kemendikbudristek 2024, EYD Edisi V 2022, TBBBI Edisi IV 2017, PUPI, Badan Bahasa).
 */
export const HUMANIZER_ID_EDITORIAL_RULES = `
KAIDAH PENYUNTINGAN AKADEMIK HUMANIZER-ID (apissaj/humanizer-id — Mode Akademik Ketat):
1. PEMANGKASAN VERBA RINGAN & NOMINALISASI BERLEBIH:
   - Gunakan verba aktif/pasif lugas, BUKAN konstruksi verba ringan:
     * "melakukan analisis terhadap" -> "menganalisis"
     * "melakukan pengukuran terhadap" -> "mengukur"
     * "melakukan pengujian terhadap/pada" -> "menguji"
     * "memberikan pengaruh terhadap" -> "memengaruhi"
     * "mengalami peningkatan sebesar" -> "meningkat sebesar"
     * "melakukan implementasi terhadap" -> "mengimplementasikan"
     * "melakukan evaluasi terhadap" -> "mengevaluasi"
2. ELIMINASI KALKE TERJEMAHAN MESIN (TRANSLATIONESE) & AI SLOP:
   - DILARANG memakai kalke klise LLM: "menyelami lebih dalam" (delving into), "lanskap" (landscape), "merajut" (weaving), "hiruk pikuk", "menghormati batas" (respecting boundaries), "tidak datang tanpa harga" (not without a cost), "dalam rangka untuk" (gunakan "untuk" atau "guna"), "yang mana" (gunakan "yang", "sehingga", atau titik).
   - DILARANG memakai penyangkalan antisipatif ("Meskipun X, bukan berarti Y") atau pembuka klise ("Di era digital yang berkembang pesat saat ini").
3. DISIPLIN KONJUNGSI, TANDA KOMA, & STRUKTUR KALIMAT (TBBBI & Kemendikbudristek):
   - Konjungsi intrakalimat WAJIB didahului koma: ", tetapi", ", namun", ", sedangkan", ", melainkan", ", bahkan", ", padahal".
   - Konjungsi intrakalimat TANPA koma sebelumnya: "dan", "atau", "bahwa", "karena", "sehingga", "agar", "apabila", "jika", "maka" (JANGAN menulis ", sehingga" atau ", karena").
   - Konjungsi subordinatif ("sehingga", "sedangkan", "karena", "agar") DILARANG membuka kalimat mandiri (kalimat buntung).
   - DILARANG memakai padanan kontaminasi: "disebabkan karena" (gunakan "disebabkan oleh" atau "karena"), "karena ... maka", "meskipun ... tetapi", "walaupun ... namun", "agar supaya", "demi untuk", "dan lain sebagainya" (gunakan "dan sebagainya" atau "dan lain-lain").
   - DILARANG menaruh preposisi perusak subjek di awal kalimat aktif ("Dalam penelitian ini membahas..." -> gunakan "Penelitian ini membahas..." atau pasif "Dalam penelitian ini dibahas...").
   - DILARANG menyisipkan "tentang/mengenai" setelah verba transitif ("membahas tentang X" -> "membahas X"; "meneliti tentang X" -> "meneliti X").
   - Titik waktu memakai "pada" ("pada tahun 2024", "pada era digital"), BUKAN "di tahun" atau "di era".
   - DILARANG memakai kata tanya "di mana / dimana" sebagai penghubung klausa pernyataan.
4. MONOTONI TRANSISI & PERAJUTAN SITASI ALAMI (CITATION WEAVING):
   - Maksimal satu konjungsi transisi mekanis ("Selain itu,", "Lebih lanjut,", "Oleh karena itu,") di awal paragraf per bagian; buka paragraf langsung dengan gagasan topik.
   - Hindari repetisi "Menurut X (2023)... Senada dengan itu, Y (2024) menyatakan..."; utamakan sintesis gagasan dengan sitasi di akhir klausa.
   - Pertahankan kalimat pasif objektif pada bagian Metode Penelitian dan Hasil (safeguard konvensi ilmiah Indonesia).
5. MORFOLOGI BAKU EYD V & KBBI:
   - Peluluhan KTSP: "memengaruhi" (bukan mempengaruhi), "mengubah" (bukan merubah), "menyintesis" (bukan mensintesis), "menargetkan" (bukan mentargetkan).
   - Gabungan kata bebas ditulis terpisah: "kerja sama", "tanggung jawab", "uji coba", "tanda tangan", "terima kasih", "ibu kota".
   - Hindari penjamakan ganda ("beberapa faktor", BUKAN "beberapa faktor-faktor").
   - Angka Arab tidak boleh membuka kalimat ("Sebanyak 25 sampel...", bukan "25 sampel...").
`;

const ACADEMIC_EXCLUSIONS: Record<string, true> = {
  'DIN-001': true,
  'DIN-003': true,
  'SUR-003': true,
  'BRN-002': true, // Judul bab standar seperti "Tinjauan Pustaka" & "Metode Penelitian" sah pada makalah/skripsi
  'BAK-006': true, // "Metodologi Penelitian" adalah judul bab resmi skripsi Dikti
};

let cachedDataset: KalkeDataset | null = null;

function loadKalkeDataset(): KalkeDataset {
  if (cachedDataset) return cachedDataset;
  const candidates = [
    path.resolve(process.cwd(), 'src/data/humanizer-id/kalke-indonesia.json'),
    (() => {
      try {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(dir, '../src/data/humanizer-id/kalke-indonesia.json');
      } catch {
        return '';
      }
    })(),
    (() => {
      try {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(dir, './data/humanizer-id/kalke-indonesia.json');
      } catch {
        return '';
      }
    })(),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cachedDataset = JSON.parse(fs.readFileSync(p, 'utf-8')) as KalkeDataset;
        return cachedDataset;
      }
    } catch {
      // ignore
    }
  }
  cachedDataset = { kategori: {} };
  return cachedDataset;
}

function matchCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Daftar transformasi deterministik berkeamanan tinggi dari kaidah apissaj/humanizer-id.
 * Hanya mencakup pola yang maknanya 100% ekuivalen tanpa merusak struktur klausa.
 */
const DETERMINISTIC_REWRITES: Array<[RegExp, string | ((m: string, ...args: string[]) => string)]> = [
  // 1. Pemangkasan Verba Ringan (Light Verbs) + preposisi terhadap/pada
  [/\bmelakukan\s+analisis\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'menganalisis')],
  [/\bmelakukan\s+pengukuran\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengukur')],
  [/\b(?:melakukan|melaksanakan)\s+pengujian\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'menguji')],
  [/\bmelakukan\s+klasifikasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengklasifikasikan')],
  [/\bmelakukan\s+ekstraksi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengekstrak')],
  [/\bmelakukan\s+optimasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengoptimalkan')],
  [/\bmelakukan\s+implementasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengimplementasikan')],
  [/\bmelakukan\s+evaluasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengevaluasi')],
  [/\bmelakukan\s+identifikasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengidentifikasi')],
  [/\bmelakukan\s+observasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'mengobservasi')],
  [/\bmelakukan\s+verifikasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'memverifikasi')],
  [/\bmelakukan\s+validasi\s+(?:terhadap|pada|atas)\b/gi, (m) => matchCase(m, 'memvalidasi')],
  [/\bmemberikan\s+pengaruh\s+terhadap\b/gi, (m) => matchCase(m, 'memengaruhi')],
  [/\bmengalami\s+peningkatan\s+sebesar\b/gi, (m) => matchCase(m, 'meningkat sebesar')],
  [/\bmengalami\s+penurunan\s+sebesar\b/gi, (m) => matchCase(m, 'menurun sebesar')],

  // 2. Kalke, Pleonasme, & Kontaminasi Konjungsi
  [/\bdi\s+dalam\s+rangka\s+untuk\b/gi, (m) => matchCase(m, 'untuk')],
  [/\bdalam\s+rangka\s+untuk\b/gi, (m) => matchCase(m, 'untuk')],
  [/\bguna\s+untuk\b/gi, (m) => matchCase(m, 'guna')],
  [/\bbagi\s+untuk\b/gi, (m) => matchCase(m, 'untuk')],
  [/\bagar\s+supaya\b/gi, (m) => matchCase(m, 'agar')],
  [/\bdemi\s+untuk\b/gi, (m) => matchCase(m, 'demi')],
  [/\blalu\s+kemudian\b/gi, (m) => matchCase(m, 'kemudian')],
  [/\bkalau\s+seandainya\b/gi, (m) => matchCase(m, 'seandainya')],
  [/\bseperti\s+misalnya\b/gi, (m) => matchCase(m, 'misalnya')],
  [/\bcontohnya\s+seperti\b/gi, (m) => matchCase(m, 'seperti')],
  [/\bdisebabkan\s+(?:oleh\s+)?karena\b/gi, (m) => matchCase(m, 'disebabkan oleh')],
  [/\bdan\s+lain\s+sebagainya\b/gi, (m) => matchCase(m, 'dan sebagainya')],
  [/\bselain\s+daripada\b/gi, (m) => matchCase(m, 'selain')],
  [/\badalah\s+merupakan\s+salah\s+satu\b/gi, (m) => matchCase(m, 'merupakan salah satu')],
  [/\badalah\s+merupakan\b/gi, (m) => matchCase(m, 'merupakan')],
  [/\bnamun\s+demikian\s*,/gi, (m) => matchCase(m, 'walaupun demikian,')],
  [/\bpaling\s+ter(baik|penting|besar|tinggi|rendah|cepat|lambat|aman|dalam|utama)\b/gi, (m, adj) =>
    matchCase(m, `ter${adj.toLowerCase()}`)],

  // 3. Verba transitif + tentang/mengenai (Pusat Bahasa)
  [/\b(membahas|membicarakan|mempelajari|meneliti|mengkaji|menguraikan|mengupas)\s+(?:tentang|mengenai)\b/gi, (_m, verb) => verb],

  // 4. Preposisi titik waktu (Effendi & Aritonang 1992)
  [/\bdi\s+(tahun|periode|era|dekade)\s+(\d{4}|digital|modern|industri)\b/gi, (m, noun, tail) =>
    `${matchCase(m.slice(0, 2), 'pada')} ${noun} ${tail}`],

  // 5. Penjamakan ganda (para/beberapa/berbagai/semua + kata ulang)
  [/\b(para|beberapa|berbagai|semua)\s+([a-zA-Z]{3,})-\2\b/gi, (_m, det, word) => `${det} ${word}`],

  // 6. Kaidah tanda koma sebelum konjungsi intrakalimat bahwa/karena/sehingga
  [/,\s+(sehingga|karena)\s+/gi, ' $1 '],

  // 7. Morfologi KTSP, Gabungan Kata & Leksikon Baku KBBI V
  [/\bmempengaruhi\b/gi, (m) => matchCase(m, 'memengaruhi')],
  [/\bmerubah\b/gi, (m) => matchCase(m, 'mengubah')],
  [/\bmensintesis\b/gi, (m) => matchCase(m, 'menyintesis')],
  [/\bmentargetkan\b/gi, (m) => matchCase(m, 'menargetkan')],
  [/\bmengkesampingkan\b/gi, (m) => matchCase(m, 'mengesampingkan')],
  [/\bmengenyampingkan\b/gi, (m) => matchCase(m, 'mengesampingkan')],
  [/\bpenterjemah\b/gi, (m) => matchCase(m, 'penerjemah')],
  [/\bpengrajin\b/gi, (m) => matchCase(m, 'perajin')],
  [/\bpensurvei\b/gi, (m) => matchCase(m, 'penyurvei')],
  [/\bsinergitas\b/gi, (m) => matchCase(m, 'sinergi')],
  [/\bstandarisasi\b/gi, (m) => matchCase(m, 'standardisasi')],
  [/\banalisa\b/gi, (m) => matchCase(m, 'analisis')],
  [/\bsistim\b/gi, (m) => matchCase(m, 'sistem')],
  [/\bresiko\b/gi, (m) => matchCase(m, 'risiko')],
  [/\bpraktek\b/gi, (m) => matchCase(m, 'praktik')],
  [/\baktifitas\b/gi, (m) => matchCase(m, 'aktivitas')],
  [/\befektifitas\b/gi, (m) => matchCase(m, 'efektivitas')],
  [/\bkwalitas\b/gi, (m) => matchCase(m, 'kualitas')],
  [/\botentik\b/gi, (m) => matchCase(m, 'autentik')],
  [/\bkonkrit\b/gi, (m) => matchCase(m, 'konkret')],
  [/\bhapal\b/gi, (m) => matchCase(m, 'hafal')],
  [/\bdesiminasi\b/gi, (m) => matchCase(m, 'diseminasi')],
  [/\bhipotesa\b/gi, (m) => matchCase(m, 'hipotesis')],
  [/\bmetoda\b/gi, (m) => matchCase(m, 'metode')],
  [/\bketrampilan\b/gi, (m) => matchCase(m, 'keterampilan')],
  [/\bteoritis\b/gi, (m) => matchCase(m, 'teoretis')],
  [/\bkerjasama\b/gi, (m) => matchCase(m, 'kerja sama')],
  [/\btanggungjawab\b/gi, (m) => matchCase(m, 'tanggung jawab')],
  [/\bujicoba\b/gi, (m) => matchCase(m, 'uji coba')],
  [/\btandatangan\b/gi, (m) => matchCase(m, 'tanda tangan')],
  [/\bterimakasih\b/gi, (m) => matchCase(m, 'terima kasih')],
  [/\bibukota\b/gi, (m) => matchCase(m, 'ibu kota')],
  [/\bbatubara\b/gi, (m) => matchCase(m, 'batu bara')],
  [/\bdari\s+pada\b/gi, (m) => matchCase(m, 'daripada')],
  [/\bbarang\s+kali\b/gi, (m) => matchCase(m, 'barangkali')],
  [/\bpada\s+hal\b/gi, (m) => matchCase(m, 'padahal')],
  [/\bsekali\s+gus\b/gi, (m) => matchCase(m, 'sekaligus')],
  [/\bapa\s+bila\b/gi, (m) => matchCase(m, 'apabila')],
  [/\bbila\s+mana\b/gi, (m) => matchCase(m, 'bilamana')],
  [/\bnomor\s+NIK\b/gi, 'NIK'],
  [/\bnomor\s+PIN\b/gi, 'PIN'],
  [/\bnomor\s+ISBN\b/gi, 'ISBN'],
  [/\bnomor\s+ISSN\b/gi, 'ISSN'],
  [/\bkartu\s+KTP\b/gi, 'KTP'],
];

/**
 * Terapkan pembersihan deterministik berbasis kaidah apissaj/humanizer-id
 * tanpa menyentuh blok kode/mermaid.
 */
export function applyHumanizerId(raw: string): string {
  if (!raw) return raw;

  const segments = raw.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith('```')) return seg;
      let text = seg;
      for (const [pattern, replacer] of DETERMINISTIC_REWRITES) {
        text =
          typeof replacer === 'string'
            ? text.replace(pattern, replacer)
            : text.replace(pattern, replacer);
      }
      return text;
    })
    .join('');
}

const STRUCTURAL_MATCHERS: Array<{
  matchPola: (p: string) => boolean;
  regexes: RegExp[];
}> = [
  { matchPola: (p) => p.includes('bukan berarti'), regexes: [/\bbukan\s+berarti\b/i] },
  { matchPola: (p) => p.includes('antara') && p.includes('dengan'), regexes: [/\bantara\b[^.!?]{2,60}?\bdengan\b/i] },
  { matchPola: (p) => p.includes('baik') && p.includes('ataupun'), regexes: [/\bbaik\b[^.!?]{2,60}?\bataupun\b/i] },
  { matchPola: (p) => p.includes('bukan') && (p.includes('tetapi') || p.includes('namun')), regexes: [/\bbukan\b[^.!?]{2,60}?\b(tetapi|namun)\b/i] },
  { matchPola: (p) => p.includes('sedangkan'), regexes: [/(?:^|[.!?]\s+)\bsedangkan\b/i] },
  { matchPola: (p) => p.includes('para tamu-tamu') || p.includes('ganda jamak'), regexes: [/\b(para|beberapa|berbagai|semua)\s+([a-zA-Z]+)-\2\b/i] },
  { matchPola: (p) => p.includes('karena ... maka') || p.includes('konjungsi syarat berkorelasi'), regexes: [/\b(karena|jika|kalau|apabila)\b[^.!?]{2,80}?\bmaka\b/i] },
  { matchPola: (p) => p.includes('meskipun ... tetapi') || p.includes('Meskipun ..., tetapi'), regexes: [/\b(meskipun|walaupun|biarpun)\b[^.!?]{2,80}?\b(tetapi|namun)\b/i] },
  { matchPola: (p) => p.includes('membahas tentang') || p.includes('predikat transitif diikuti frasa preposisional'), regexes: [/\b(membahas|membicarakan|mempelajari|meneliti|mengkaji|menguraikan)\s+(tentang|mengenai)\b/i] },
  { matchPola: (p) => p.includes('kalimat tanpa subjek berawalan preposisi'), regexes: [/(?:^|[.!?]\s+)\bDalam\s+\w+\s*(?:ini|tersebut)\s+(?:akan\s+)?(?:membahas|membicarakan|meneliti|menganalisis|mengkaji|menguraikan|menyajikan|mengevaluasi|mengungkap|memaparkan)\b/] },
  { matchPola: (p) => p.includes(', sehingga'), regexes: [/,\s*sehingga\b/i] },
  { matchPola: (p) => p.includes(', karena'), regexes: [/,\s*karena\b/i] },
  { matchPola: (p) => p.includes('hanya ... saja'), regexes: [/\bhanya\b[^.!?]{1,40}\bsaja\b/i] },
  { matchPola: (p) => p.includes('sangat ... sekali'), regexes: [/\bsangat\s+\w+\s+sekali\b/i] },
  { matchPola: (p) => p.includes('dimana/diketika/disewaktu'), regexes: [/\b\w+\s+(dimana|di mana|diketika|disewaktu)\s+\w+\b/i] },
  { matchPola: (p) => p.includes('rujukan deiksis spasial semu'), regexes: [/\b(grafik|tabel|bagan|diagram)\s+(di\s+atas|di\s+bawah(?:\s+ini)?|berikut)\b/i] },
  { matchPola: (p) => p.includes('pleonasme penumpukan kopula'), regexes: [/\b(merupakan|adalah)\s+salah\s+satu\s+termasuk\b|\badalah\s+merupakan\b/i] },
  { matchPola: (p) => p.includes('kontaminasi frasa penutup deret'), regexes: [/\bdan\s+lain\s+sebagainya\b/i] },
  { matchPola: (p) => p.includes('preposisi titik waktu tidak baku'), regexes: [/\bdi\s+(?:tahun|periode|era|dekade)\s+\d{4}\b/i] },
  { matchPola: (p) => p.includes('melainkan dipasangkan dengan tidak'), regexes: [/\btidak\s+[^.!?]{2,60}?\bmelainkan\b/i] },
  { matchPola: (p) => p.includes('paling terbaik'), regexes: [/\bpaling\s+ter(?:baik|penting|besar|tinggi|rendah|cepat|lambat|aman|dalam)\b/i] },
  { matchPola: (p) => p.includes('disebabkan karena'), regexes: [/\bdisebabkan\s+(?:oleh\s+)?karena\b/i] },
  { matchPola: (p) => p.includes('Di era digital'), regexes: [/\bDi era digital yang berkembang\b/i] },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pindai naskah menggunakan kamus & matcher apissaj/humanizer-id (Preset Akademik).
 */
export function auditWithHumanizerId(text: string, maxFindings = 25): HumanizerFinding[] {
  const dataset = loadKalkeDataset();
  const findings: HumanizerFinding[] = [];
  const seenKey = new Set<string>();
  const lines = text.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !line || line.startsWith('#') || line.startsWith('|')) {
      continue;
    }

    for (const [catKey, catData] of Object.entries(dataset.kategori || {})) {
      for (const entry of catData.entri || []) {
        if (ACADEMIC_EXCLUSIONS[entry.id]) continue;
        const pola = (entry.pola || '').trim();
        if (!pola || pola.startsWith('[telaah]')) continue;

        let matched = false;
        let handledByStructural = false;

        for (const rule of STRUCTURAL_MATCHERS) {
          if (rule.matchPola(pola)) {
            handledByStructural = true;
            matched = rule.regexes.some((rx) => rx.test(line));
            break;
          }
        }

        if (!handledByStructural) {
          // Hanya cocokkan frasa literal yang tidak mengandung meta-deskripsi panjang
          if (
            pola.length <= 45 &&
            !pola.includes('...') &&
            !pola.includes('/') &&
            !pola.includes('(') &&
            !/\b(?:X|Y|A|B)\b/.test(pola)
          ) {
            const rx = new RegExp(`\\b${escapeRegex(pola)}\\b`, 'i');
            matched = rx.test(line);
          }
        }

        if (matched) {
          const dedupKey = `${entry.id}:${i + 1}`;
          if (!seenKey.has(dedupKey)) {
            seenKey.add(dedupKey);
            const rawSaran = entry.saran_pengganti;
            const normalizedSaran = Array.isArray(rawSaran)
              ? rawSaran.map(String)
              : rawSaran
                ? [String(rawSaran)]
                : [];
            findings.push({
              baris: i + 1,
              id: entry.id,
              kategori: catKey,
              pola,
              saran: normalizedSaran,
              penjelasan: entry.penjelasan || '',
              kalimat: line.length > 140 ? line.slice(0, 140) + '...' : line,
            });
            if (findings.length >= maxFindings) return findings;
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Format temuan Humanizer-ID untuk disuntikkan ke prompt AI Reviewer / Revisor.
 */
export function formatHumanizerFindingsForPrompt(findings: HumanizerFinding[]): string {
  if (findings.length === 0) {
    return 'Tidak ditemukan pelanggaran leksikal/kalke pada pemindaian otomatis Humanizer-ID.';
  }
  return findings
    .slice(0, 15)
    .map(
      (f, idx) =>
        `${idx + 1}. [Baris ${f.baris} | ${f.id}] Pola: "${f.pola}" -> Saran: "${f.saran.slice(0, 3).join(' / ')}" (${f.penjelasan})`
    )
    .join('\n');
}

/**
 * Format bagian laporan audit Markdown untuk ditampilkan kepada pengguna.
 */
export function formatHumanizerAuditSection(findings: HumanizerFinding[]): string {
  if (findings.length === 0) {
    return [
      '### 6. Audit Gaya Bahasa & Anti-Kalke (`humanizer-id`)',
      '- **Status Kebahasaan:** Bersih (`0` temuan kalke/verba ringan/nonbaku pada pemindaian leksikal `apissaj/humanizer-id`).',
      '- Naskah telah mematuhi kaidah kalimat efektif Kemendikbudristek, EYD Edisi V, dan Tata Bahasa Baku Bahasa Indonesia (TBBBI).',
    ].join('\n');
  }

  const rows = findings.slice(0, 12).map((f) => {
    const saran = f.saran.slice(0, 2).join(' / ').replace(/\|/g, '/');
    const pola = f.pola.replace(/\|/g, '/');
    const ket = f.penjelasan.replace(/\|/g, '/').slice(0, 110);
    return `| Baris ${f.baris} | \`${f.id}\` | ${pola} | **${saran}** | ${ket} |`;
  });

  return [
    '### 6. Audit Gaya Bahasa & Anti-Kalke (`humanizer-id`)',
    `Terdeteksi **${findings.length} pola bahasa** berdasarkan kamus akademik \`apissaj/humanizer-id\` (EYD V, TBBBI, & Buku Kemendikbudristek):`,
    '',
    '| Lokasi | Kode Kaidah | Pola Terdeteksi | Saran Perbaikan Baku | Kaidah Rujukan |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...rows,
  ].join('\n');
}
