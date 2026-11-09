import * as cheerio from 'cheerio';
import { extractText } from 'unpdf';
import { fetchWithPlaywright, parseHtmlLight } from './browser.js';
import { logger } from '../core/logger.js';
import { isChineseOrGarbage } from './searcher.js';
import type { SourceItem } from '../types/index.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB limit per AGENTS.md
const FETCH_TIMEOUT_MS = 12000;
const MAX_CONTENT_CHARS = 12000;

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMetadata(item: SourceItem): { citation: string; fullRef: string } {
  let hostname = '';
  try {
    hostname = new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = 'Anonim';
  }

  // Detect year in URL, title or snippet (e.g. 2018-2026)
  const textPool = `${item.title} ${item.snippet} ${item.url}`;
  const yearMatch = textPool.match(/\b(20[12]\d)\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  // Clean title for ref
  const title = item.title.replace(/\s*[-|–].*$/, '').trim() || 'Publikasi Ilmiah';

  // Format author / organization from hostname
  const orgName = hostname
    .split('.')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  const citation = `(${orgName}, ${year})`;
  const fullRef = `${orgName}. (${year}). ${title}. Diperoleh dari ${item.url}`;

  return { citation, fullRef };
}

export async function extractContentFromSource(item: SourceItem): Promise<SourceItem> {
  // ponytail: jurnal lokal / OpenAlex Indonesia / Custom PDF sudah punya abstrak & sitasi lengkap
  if (
    item.id.startsWith('local-') ||
    item.id.startsWith('indo-oa-') ||
    item.id.startsWith('indo-doaj-') ||
    item.id.startsWith('indo-cr-') ||
    item.id.startsWith('custom-ref-')
  ) {
    return { ...item, content: item.content || item.snippet };
  }

  const updated = { ...item };
  const meta = extractMetadata(item);
  updated.citation = item.citation || meta.citation;
  updated.fullRef = item.fullRef || meta.fullRef;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(item.url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      if (item.fileType !== 'pdf') {
        try {
          const browserHtml = await fetchWithPlaywright(item.url);
          const parsed = parseHtmlLight(browserHtml);
          if (parsed.text.length > 100) {
            updated.content = parsed.text.slice(0, MAX_CONTENT_CHARS);
            return updated;
          }
        } catch {
          // ignore playwright error
        }
      }
      updated.content = item.snippet;
      return updated;
    }

    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
      logger.warn(`File exceeds 10MB (${contentLength} bytes), fallback to snippet: ${item.url}`);
      updated.content = item.snippet;
      return updated;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isPdf =
      contentType.includes('application/pdf') ||
      item.url.toLowerCase().endsWith('.pdf') ||
      item.fileType === 'pdf';

    if (isPdf) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        updated.content = item.snippet;
        return updated;
      }
      const pdfData = new Uint8Array(buffer);
      const parsed = await extractText(pdfData);
      const fullText = Array.isArray(parsed.text)
        ? parsed.text.join('\n')
        : (parsed.text as unknown as string) || '';
      updated.content = cleanText(fullText).slice(0, MAX_CONTENT_CHARS) || item.snippet;
      updated.fileType = 'pdf';
    } else {
      const html = await res.text();
      const $ = cheerio.load(html);
      // Remove noise tags
      $('script, style, nav, footer, header, aside, iframe, noscript, .ads, .menu').remove();

      let bodyText = $('article').text();
      if (!bodyText || bodyText.length < 200) {
        bodyText = $('main').text();
      }
      if (!bodyText || bodyText.length < 200) {
        bodyText = $('body').text();
      }

      const text = cleanText(bodyText);
      updated.content = text.slice(0, MAX_CONTENT_CHARS) || item.snippet;
      updated.fileType = 'html';
    }
  } catch (err) {
    clearTimeout(timer);
    if (item.fileType !== 'pdf') {
      try {
        const browserHtml = await fetchWithPlaywright(item.url);
        const parsed = parseHtmlLight(browserHtml);
        if (parsed.text.length > 100) {
          updated.content = parsed.text.slice(0, MAX_CONTENT_CHARS);
          return updated;
        }
      } catch {
        // ignore
      }
    }
    // ponytail: gracefully fall back to snippet on network/parse failure
    updated.content = item.snippet;
  }

  return updated;
}

export function isAcademicSource(item: SourceItem): boolean {
  if (item.id.startsWith('custom-ref-')) {
    return true;
  }
  if (isChineseOrGarbage(item.url, item.title, item.snippet)) {
    return false;
  }
  if (
    item.id.startsWith('indo-oa-') ||
    item.id.startsWith('indo-doaj-') ||
    item.id.startsWith('indo-cr-') ||
    item.id.startsWith('local-')
  ) {
    return true;
  }
  const urlLower = item.url.toLowerCase();
  const titleLower = item.title.toLowerCase();
  const textLower = `${item.title} ${item.snippet} ${item.content || ''}`.toLowerCase();

  // 1. HARD REJECT: Non-academic portals, SSO/login walls, search engines, social media
  const rejectedDomains = [
    'google.com',
    'wikipedia.org',
    'youtube.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'pinterest.com',
    'reddit.com',
    'tiktok.com',
    'linkedin.com',
  ];
  if (rejectedDomains.some((d) => urlLower.includes(d))) {
    return false;
  }

  // Reject login / authentication pages regardless of domain
  const authPatterns = [
    '/login',
    '/signin',
    '/sign-in',
    '/log-in',
    '/cas/',
    '/cas?',
    '/sso/',
    '/auth/',
    '/saml',
    'central authentication service',
    'sign in',
    'log in',
  ];
  if (authPatterns.some((p) => urlLower.includes(p) || titleLower.includes(p))) {
    return false;
  }

  // 2. POSITIVE CHECK: Must belong to recognized academic domain or journal repository
  const academicDomainPatterns = [
    '.ac.id',
    '.edu',
    'garuda.kemdikbud.go.id',
    'neliti.com',
    'sinta.kemdikbud.go.id',
    'arxiv.org',
    'doaj.org',
    'semanticscholar.org',
    'researchgate.net',
    'sciencedirect.com',
    'springer.com',
    'wiley.com',
    'jstor.org',
    'nature.com',
    'ieee.org',
    'ncbi.nlm.nih.gov',
    'ejournal',
    'journal',
    'repository',
    'doi.org',
  ];

  const hasAcademicDomain = academicDomainPatterns.some((pattern) => urlLower.includes(pattern));
  if (!hasAcademicDomain) {
    return false;
  }

  // 3. Document or Article Indicators
  const isPdf = urlLower.endsWith('.pdf') || item.fileType === 'pdf';
  const articlePaths = ['/article/', '/view/', '/download/', '/pdf/', '/paper/', '/publication/', '/abs/', '/handle/', '/bitstream/', '/index.php/'];
  const hasArticlePath = articlePaths.some((p) => urlLower.includes(p));

  const academicKeywords = [
    'jurnal',
    'penelitian',
    'abstrak',
    'abstract',
    'volume',
    'issn',
    'metode',
    'skripsi',
    'tesis',
  ];
  const hasAcademicKeyword = academicKeywords.some((kw) => textLower.includes(kw));

  return isPdf || hasArticlePath || hasAcademicKeyword;
}

export async function extractSourcesSequential(
  sources: SourceItem[],
  maxSources = 6,
  strictAcademic = true
): Promise<SourceItem[]> {
  let filtered = sources;
  if (strictAcademic) {
    // ponytail: wajib saring ketat; jangan pernah fallback ke link sampah/komersial/asing
    filtered = sources.filter(isAcademicSource);
    logger.dim(`Filter akademik aktif: menyaring ${filtered.length}/${sources.length} sumber valid.`);
  }
  const selected = filtered.slice(0, maxSources);
  const results: SourceItem[] = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    logger.dim(`[${i + 1}/${selected.length}] Ekstraksi: ${item.title.slice(0, 40)}...`);
    const extracted = await extractContentFromSource(item);
    results.push(extracted);
  }

  return results;
}
