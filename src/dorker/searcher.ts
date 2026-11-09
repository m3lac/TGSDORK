import * as cheerio from 'cheerio';
import { loadConfig } from '../core/config.js';
import { logger } from '../core/logger.js';
import { searchLocalJournals } from './local-journal.js';
import type { SourceItem } from '../types/index.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CJK_SCRIPT_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

const BLOCKED_DOMAINS = [
  'douyin.com',
  'iesdouyin.com',
  'tiktok.com',
  'zhihu.com',
  'bilibili.com',
  'csdn.net',
  'baidu.com',
  'qq.com',
  'weixin',
  'wechat',
  '163.com',
  '126.com',
  'sohu.com',
  'sina.com',
  'weibo.com',
  'toutiao.com',
  'kuaishou.com',
  'xiaohongshu.com',
  'jianshu.com',
  'cnblogs.com',
  'gitee.com',
  'aliyun.com',
  'tencent.com',
  'taobao.com',
  'jd.com',
  'cnki.net',
  'wanfangdata.com',
  'cqvip.com',
  'bing.com',
  'google.com',
  'wikipedia.org',
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'pinterest.com',
  'linkedin.com',
  'forestapp',
];

export function isChineseOrGarbage(url: string, title: string, snippet = ''): boolean {
  const u = (url || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (/^https?:\/\/[^/]+\.cn(?:\/|:|$)/i.test(u)) return true;
  if (BLOCKED_DOMAINS.some((d) => u.includes(d))) return true;
  if (CJK_SCRIPT_RE.test(title || '') || CJK_SCRIPT_RE.test(snippet || '')) return true;
  if (t.includes('forestapp')) return true;
  if (u.includes('/login') || u.includes('/signin') || u.includes('/cas/') || u.includes('/sso/') || u.includes('/auth/')) return true;
  if (t.includes('login') || t.includes('sign in') || t.includes('central authentication service')) return true;
  return false;
}

export function cleanAcademicKeywords(query: string): string {
  return query
    .replace(/-?(?:site|inurl|allinurl|intitle|allintitle|intext|allintext|filetype|ext):\S+/gi, ' ')
    .replace(/\b(?:OR|AND|NOT)\b/gi, ' ')
    .replace(/["'()\[\]{}|+~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchDDGLite(query: string, maxResults: number): Promise<SourceItem[]> {
  const url = 'https://lite.duckduckgo.com/lite/';
  const body = new URLSearchParams({ q: query });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': DEFAULT_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`DDG Lite HTTP ${res.status}`);
  }

  const html = await res.text();
  if (html.includes('anomaly-modal') || html.includes('Unfortunately, bots use DuckDuckGo')) {
    throw new Error('DDG Lite IP anomaly check triggered');
  }

  const $ = cheerio.load(html);
  const items: SourceItem[] = [];

  $('tr').each((_, el) => {
    if (items.length >= maxResults) return;
    const linkEl = $(el).find('a.result-link');
    if (!linkEl.length) return;

    const title = linkEl.text().trim();
    let targetUrl = linkEl.attr('href') || '';

    // Handle DDG redirect uddg
    try {
      if (targetUrl.includes('uddg=')) {
        const parsed = new URL(targetUrl, 'https://duckduckgo.com');
        const real = parsed.searchParams.get('uddg');
        if (real) targetUrl = decodeURIComponent(real);
      }
    } catch {
      // ignore url parse error
    }

    const snippetEl = $(el).next().find('td.result-snippet');
    const snippet = snippetEl.text().trim();

    if (title && targetUrl && targetUrl.startsWith('http')) {
      if (isChineseOrGarbage(targetUrl, title, snippet)) return;
      const isPdf =
        targetUrl.toLowerCase().endsWith('.pdf') ||
        title.toLowerCase().includes('.pdf') ||
        snippet.toLowerCase().includes('pdf');

      items.push({
        id: `src-${Math.random().toString(36).substring(2, 9)}`,
        title,
        url: targetUrl,
        snippet,
        citation: '',
        fullRef: '',
        fileType: isPdf ? 'pdf' : 'html',
      });
    }
  });

  return items;
}

function resolveBingUrl(targetUrl: string): string {
  try {
    if (targetUrl.includes('/ck/a?!')) {
      const parsed = new URL(targetUrl, 'https://www.bing.com');
      const uParam = parsed.searchParams.get('u');
      if (uParam && uParam.startsWith('a1')) {
        const b64 = uParam.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        if (decoded.startsWith('http')) {
          return decoded;
        }
      }
    }
  } catch {
    // ignore
  }
  return targetUrl;
}

async function searchBing(query: string, maxResults: number): Promise<SourceItem[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Bing HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const items: SourceItem[] = [];

  $('li.b_algo').each((_, el) => {
    if (items.length >= maxResults) return;
    const titleEl = $(el).find('h2 a');
    const title = titleEl.text().trim();
    let rawUrl = titleEl.attr('href') || '';
    let targetUrl = resolveBingUrl(rawUrl);

    const snippet = $(el).find('.b_caption p').text().trim() || $(el).find('.b_snippet').text().trim();

    if (title && targetUrl && targetUrl.startsWith('http')) {
      if (isChineseOrGarbage(targetUrl, title, snippet)) return;
      const isPdf =
        targetUrl.toLowerCase().endsWith('.pdf') ||
        title.toLowerCase().includes('.pdf') ||
        snippet.toLowerCase().includes('pdf file');

      items.push({
        id: `src-${Math.random().toString(36).substring(2, 9)}`,
        title,
        url: targetUrl,
        snippet,
        citation: '',
        fullRef: '',
        fileType: isPdf ? 'pdf' : 'html',
      });
    }
  });

  return items;
}

async function searchSerper(query: string, apiKey: string, maxResults: number): Promise<SourceItem[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!res.ok) {
    throw new Error(`Serper HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const results: SourceItem[] = [];
  for (const item of data.organic || []) {
    if (item.title && item.link && !isChineseOrGarbage(item.link, item.title, item.snippet || '')) {
      const isPdf = item.link.toLowerCase().endsWith('.pdf');
      results.push({
        id: `src-${Math.random().toString(36).substring(2, 9)}`,
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        citation: '',
        fullRef: '',
        fileType: isPdf ? 'pdf' : 'html',
      });
    }
  }
  return results;
}

async function searchWebFallback(
  query: string,
  options: { maxResults?: number; delayMs?: number } = {}
): Promise<SourceItem[]> {
  const { maxResults = 5, delayMs = 2000 } = options;
  const config = loadConfig();

  // Rate-limiting delay between searches
  await sleep(delayMs);

  if (config.search.provider === 'serper' && config.search.serperApiKey) {
    try {
      return await searchSerper(query, config.search.serperApiKey, maxResults);
    } catch (err) {
      logger.warn(`Serper failed (${String(err)}), falling back to public scraper`);
    }
  }

  // Primary: DDG Lite
  try {
    const ddgResults = await searchDDGLite(query, maxResults);
    if (ddgResults.length > 0) {
      return ddgResults;
    }
  } catch {
    // ponytail: fallback to Bing if DDG blocks datacenter IP
  }

  // Fallback: Bing scraper
  try {
    return await searchBing(query, maxResults);
  } catch (err) {
    logger.warn(`Bing search fallback error: ${String(err)}`);
    return [];
  }
}

function reconstructOpenAlexAbstract(inv?: Record<string, number[]>): string {
  if (!inv || typeof inv !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        words[pos] = word;
      }
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

function cleanAbstractText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/^(?:abstrak|abstract)\s*[:.-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLastName(fullName: string): string {
  const stripped = fullName
    .replace(/(?:,\s*(?:[A-Z]\.?\s*)+)+$/g, '')
    .replace(/\b[A-Z]\.\s*$/g, '')
    .replace(/[.,]+$/g, '')
    .trim();
  const parts = stripped
    .split(/\s+/)
    .map((p) => p.replace(/^[.,]+|[.,]+$/g, ''))
    .filter((p) => p.replace(/[^A-Za-zÀ-ÿ'-]/g, '').length >= 2);
  return parts[parts.length - 1] || stripped || 'Peneliti';
}

function formatIndoReference(opts: {
  authors: string[];
  year?: string | number;
  title: string;
  journalName: string;
  url: string;
}): { authors: string[]; year: string; citation: string; fullRef: string } {
  const cleanAuthors = opts.authors
    .map((a) => a.replace(/\s*\.\s*$/, '').replace(/\s+/g, ' ').trim())
    .filter((a) => a.length >= 2 && !CJK_SCRIPT_RE.test(a));

  const nowYear = new Date().getFullYear();
  const parsedYear = Number(String(opts.year || '').match(/\b(19\d{2}|20\d{2})\b/)?.[1] || 0);
  const year = parsedYear >= 1990 && parsedYear <= nowYear ? String(parsedYear) : String(nowYear - 1);

  let citation: string;
  if (cleanAuthors.length > 2) {
    citation = `(${extractLastName(cleanAuthors[0])} et al., ${year})`;
  } else if (cleanAuthors.length === 2) {
    citation = `(${extractLastName(cleanAuthors[0])} & ${extractLastName(cleanAuthors[1])}, ${year})`;
  } else if (cleanAuthors.length === 1) {
    citation = `(${extractLastName(cleanAuthors[0])}, ${year})`;
  } else {
    const shortJournal = opts.journalName.split(/[:|-]/)[0].trim().slice(0, 28) || 'Jurnal Nasional';
    citation = `(${shortJournal}, ${year})`;
  }

  const authorListRef = cleanAuthors.length > 0 ? cleanAuthors.slice(0, 6).join(', ') : opts.journalName;
  const cleanTitle = opts.title.replace(/\s+/g, ' ').trim();
  const fullRef = `${authorListRef}. (${year}). ${cleanTitle}. *${opts.journalName}*. ${opts.url}`;
  return { authors: cleanAuthors, year, citation, fullRef };
}

const INDO_STOPWORDS: Record<string, true> = {
  dalam: true, pada: true, untuk: true, yang: true, dengan: true, dari: true,
  terhadap: true, melalui: true, meningkatkan: true, analisis: true, analisa: true,
  studi: true, pengaruh: true, efektivitas: true, implementasi: true, penerapan: true,
  berbasis: true, menggunakan: true, metode: true, model: true,
};

function topContentWords(cleanQ: string, count = 4): string {
  const words = cleanQ
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !INDO_STOPWORDS[w]);
  const uniq = [...new Set(words)];
  return (uniq.length >= 2 ? uniq.slice(0, count) : cleanQ.split(/\s+/).slice(0, count)).join(' ');
}

async function searchIndonesianDOAJ(query: string, maxResults = 5): Promise<SourceItem[]> {
  const cleanQ = cleanAcademicKeywords(query);
  if (!cleanQ) return [];

  const fetchDoaj = async (qExpr: string) => {
    const url = `https://doaj.org/api/search/articles/${encodeURIComponent(
      `bibjson.journal.country:ID AND (${qExpr})`
    )}?pageSize=${Math.max(8, maxResults * 2)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TGSDORK/1.0 (mailto:research@academic.org)', Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        bibjson?: {
          title?: string;
          year?: string;
          abstract?: string;
          author?: Array<{ name?: string }>;
          journal?: { title?: string; country?: string };
          identifier?: Array<{ type?: string; id?: string }>;
          link?: Array<{ type?: string; url?: string; content_type?: string }>;
        };
      }>;
    };
    return data.results || [];
  };

  try {
    let results = await fetchDoaj(cleanQ);
    if (results.length === 0 && cleanQ.split(/\s+/).length > 3) {
      const compact = topContentWords(cleanQ, 4);
      if (compact && compact !== cleanQ.toLowerCase()) {
        results = await fetchDoaj(compact);
      }
    }

    const out: SourceItem[] = [];
    for (const r of results) {
      if (out.length >= maxResults) break;
      const b = r.bibjson;
      if (!b?.title) continue;
      const title = cleanAbstractText(b.title);
      const doiRaw = b.identifier?.find((id) => id.type?.toLowerCase() === 'doi')?.id?.trim();
      const doi = doiRaw ? doiRaw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '') : undefined;
      const fulltextUrl = b.link?.find((l) => l.url?.startsWith('http'))?.url;
      const targetUrl = fulltextUrl || (doi ? `https://doi.org/${doi}` : '');
      if (!targetUrl) continue;

      const abstractText = cleanAbstractText(b.abstract);
      if (isChineseOrGarbage(targetUrl, title, abstractText)) continue;

      const journalName = (b.journal?.title || 'Jurnal Ilmiah Indonesia').trim();
      const rawAuthors = (b.author || []).map((a) => (a.name || '').trim()).filter(Boolean);
      const ref = formatIndoReference({
        authors: rawAuthors,
        year: b.year,
        title,
        journalName,
        url: doi ? `https://doi.org/${doi}` : targetUrl,
      });
      const content =
        abstractText ||
        `Artikel jurnal ilmiah Indonesia pada ${journalName} (${ref.year}) oleh ${ref.authors.join(', ') || 'peneliti Indonesia'} mengenai ${title}.`;

      out.push({
        id: `indo-doaj-${Math.random().toString(36).slice(2, 9)}`,
        title,
        url: targetUrl,
        snippet: content.slice(0, 800),
        content,
        citation: ref.citation,
        fullRef: ref.fullRef,
        fileType: targetUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
        authors: ref.authors,
        year: ref.year,
        doi,
        doiVerified: Boolean(doi),
      });
    }
    return out;
  } catch {
    return [];
  }
}

interface CrossrefWorkItem {
  DOI?: string;
  URL?: string;
  title?: string[];
  abstract?: string;
  publisher?: string;
  'container-title'?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  published?: { 'date-parts'?: number[][] };
  issued?: { 'date-parts'?: number[][] };
  resource?: { primary?: { URL?: string } };
}

const INDO_SCHOLARLY_RE =
  /\b(jurnal|universitas|institut|sekolah tinggi|politeknik|indonesia|pendidikan|penelitian|ilmiah|nasional|fakultas|mahasiswa|siswa|pembelajaran|pengaruh|analisis|efektivitas|penerapan|pengembangan|perancangan|sistem|masyarakat|hukum|ekonomi|kesehatan|keuangan|teknologi)\b/i;

function isIndonesianCrossrefWork(it: CrossrefWorkItem): boolean {
  const title = it.title?.[0] || '';
  const journal = it['container-title']?.[0] || '';
  const pub = it.publisher || '';
  const abs = cleanAbstractText(it.abstract);
  const primaryUrl = it.resource?.primary?.URL || '';
  const checkUrl = primaryUrl || it.URL || '';

  if (!title || !it.DOI) return false;
  if (isChineseOrGarbage(checkUrl, title, abs)) return false;
  if (CJK_SCRIPT_RE.test(journal) || CJK_SCRIPT_RE.test(pub)) return false;

  if (/\.(?:ac|go|or|my|sch)\.id\b|\.id\/|neliti\.com|garuda\.kemdikbud/i.test(primaryUrl)) {
    return true;
  }
  return INDO_SCHOLARLY_RE.test(`${title} ${journal} ${pub} ${abs}`);
}

async function searchIndonesianCrossref(query: string, maxResults = 5): Promise<SourceItem[]> {
  const cleanQ = cleanAcademicKeywords(query);
  if (!cleanQ) return [];

  const fetchCr = async (onlyJurnalContainer: boolean): Promise<CrossrefWorkItem[]> => {
    const containerParam = onlyJurnalContainer ? '&query.container-title=Jurnal' : '';
    const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(
      cleanQ
    )}${containerParam}&filter=type:journal-article&rows=${Math.max(10, maxResults * 3)}&mailto=research@academic.org`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TGSDORK/1.0 (mailto:research@academic.org)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { message?: { items?: CrossrefWorkItem[] } };
    return data.message?.items || [];
  };

  try {
    const [jurnalItems, broadItems] = await Promise.all([
      fetchCr(true).catch(() => [] as CrossrefWorkItem[]),
      fetchCr(false).catch(() => [] as CrossrefWorkItem[]),
    ]);

    const seenDois = new Set<string>();
    const out: SourceItem[] = [];

    for (const it of [...jurnalItems, ...broadItems]) {
      if (out.length >= maxResults) break;
      if (!isIndonesianCrossrefWork(it)) continue;
      const doi = (it.DOI || '').trim();
      const doiKey = doi.toLowerCase();
      if (!doi || seenDois.has(doiKey)) continue;
      seenDois.add(doiKey);

      const title = cleanAbstractText(it.title?.[0] || '');
      const journalName = cleanAbstractText(it['container-title']?.[0] || 'Jurnal Ilmiah Nasional');
      const doiUrl = `https://doi.org/${doi}`;
      const primaryUrl = it.resource?.primary?.URL;
      const targetUrl =
        primaryUrl && primaryUrl.startsWith('http') && !isChineseOrGarbage(primaryUrl, title)
          ? primaryUrl
          : doiUrl;
      const yearNum = it.published?.['date-parts']?.[0]?.[0] || it.issued?.['date-parts']?.[0]?.[0];
      const rawAuthors = (it.author || [])
        .map((a) => a.name || `${a.given || ''} ${a.family || ''}`.trim())
        .filter(Boolean);

      const ref = formatIndoReference({
        authors: rawAuthors,
        year: yearNum,
        title,
        journalName,
        url: doiUrl,
      });

      const abs = cleanAbstractText(it.abstract);
      const content =
        abs ||
        `Artikel jurnal ilmiah terverifikasi DOI (${doi}) pada ${journalName} (${ref.year}) oleh ${ref.authors.join(', ') || 'peneliti Indonesia'} membahas ${title}.`;

      out.push({
        id: `indo-cr-${Math.random().toString(36).slice(2, 9)}`,
        title,
        url: targetUrl,
        snippet: content.slice(0, 800),
        content,
        citation: ref.citation,
        fullRef: ref.fullRef,
        fileType: targetUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
        authors: ref.authors,
        year: ref.year,
        doi,
        doiVerified: true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function searchIndonesianOpenAlex(query: string, maxResults = 5): Promise<SourceItem[]> {
  const cleanQ = cleanAcademicKeywords(query);
  if (!cleanQ) return [];

  const url = `https://api.openalex.org/works?search=${encodeURIComponent(
    cleanQ
  )}&filter=authorships.institutions.country_code:id&per-page=${maxResults * 2}&mailto=research@academic.org`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TGSDORK/1.0 (mailto:research@academic.org)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        id?: string;
        doi?: string;
        title?: string;
        publication_year?: number;
        authorships?: Array<{ author?: { display_name?: string } }>;
        primary_location?: { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string } };
        abstract_inverted_index?: Record<string, number[]>;
      }>;
    };

    const out: SourceItem[] = [];
    for (const w of data.results || []) {
      if (out.length >= maxResults) break;
      const title = cleanAbstractText(w.title || '');
      if (!title) continue;

      const rawAuthors = (w.authorships || [])
        .map((a) => (a.author?.display_name || '').trim())
        .filter(Boolean);
      const journalName = w.primary_location?.source?.display_name || 'Jurnal Ilmiah Nasional Indonesia';
      const doiClean = w.doi ? w.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '') : undefined;
      const targetUrl = w.primary_location?.landing_page_url || w.doi || w.id || '';
      if (!targetUrl) continue;

      const abstractText = reconstructOpenAlexAbstract(w.abstract_inverted_index);
      if (isChineseOrGarbage(targetUrl, title, abstractText)) continue;

      const ref = formatIndoReference({
        authors: rawAuthors,
        year: w.publication_year,
        title,
        journalName,
        url: doiClean ? `https://doi.org/${doiClean}` : targetUrl,
      });
      const snippet =
        abstractText ||
        `Penelitian ilmiah pada ${journalName} (${ref.year}) oleh ${ref.authors.join(', ') || 'Peneliti Indonesia'} mengenai ${title}.`;

      out.push({
        id: `indo-oa-${Math.random().toString(36).slice(2, 9)}`,
        title,
        url: targetUrl,
        snippet: snippet.slice(0, 800),
        content: snippet,
        citation: ref.citation,
        fullRef: ref.fullRef,
        fileType: w.primary_location?.pdf_url ? 'pdf' : 'html',
        authors: ref.authors,
        year: ref.year,
        doi: doiClean,
        doiVerified: Boolean(doiClean),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function addUniqueSources(target: SourceItem[], incoming: SourceItem[]) {
  for (const item of incoming) {
    const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normDoi = item.doi?.toLowerCase();
    const exists = target.some((c) => {
      if (normDoi && c.doi && c.doi.toLowerCase() === normDoi) return true;
      if (c.url === item.url) return true;
      return c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === normTitle;
    });
    if (!exists) target.push(item);
  }
}

/**
 * Pencarian utama: prioritaskan jurnal nasional Indonesia terverifikasi
 * (DOAJ country:ID + Crossref Jurnal Indonesia + OpenAlex ID + korpus lokal Indonesia).
 */
export async function searchDork(
  query: string,
  options: { maxResults?: number; delayMs?: number } = {}
): Promise<SourceItem[]> {
  const { maxResults = 5 } = options;
  const combined: SourceItem[] = [];

  const [doajHits, crossrefHits] = await Promise.all([
    searchIndonesianDOAJ(query, maxResults),
    searchIndonesianCrossref(query, maxResults),
  ]);
  addUniqueSources(combined, doajHits);
  addUniqueSources(combined, crossrefHits);
  if (combined.length >= maxResults) return combined.slice(0, maxResults);

  const oaHits = await searchIndonesianOpenAlex(query, maxResults - combined.length);
  addUniqueSources(combined, oaHits);
  if (combined.length >= maxResults) return combined.slice(0, maxResults);

  const localHits = searchLocalJournals(query, maxResults - combined.length);
  addUniqueSources(combined, localHits);
  if (combined.length >= maxResults) return combined.slice(0, maxResults);

  // ponytail: web scraper paling akhir & wajib domain akademik Indonesia (.id / Garuda / Neliti / SINTA)
  const webHits = (await searchWebFallback(query, options)).filter(
    (w) =>
      !isChineseOrGarbage(w.url, w.title, w.snippet) &&
      /\.(?:ac|go|or|my|sch)\.id\b|neliti\.com|garuda\.kemdikbud|sinta\.kemdikbud/i.test(w.url)
  );
  addUniqueSources(combined, webHits);

  return combined.slice(0, maxResults);
}
