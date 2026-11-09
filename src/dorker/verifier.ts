// ponytail: native fetch HEAD/GET verifier. Skip beratnya Playwright/puppeteer.
import type { SourceItem } from '../types/index.js';

export interface DoiVerificationResult {
  valid: boolean;
  doi?: string;
  resolvedUrl?: string;
  status?: number;
}

const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;

/**
 * Ekstrak DOI dari string (teks, URL, atau snippet).
 */
export function extractDoi(input: string): string | null {
  if (!input) return null;
  const match = input.match(DOI_REGEX);
  if (!match) return null;
  // Bersihkan tanda baca di ujung DOI jika ikut tertangkap
  return match[1].replace(/[-._;()/:,]+$/, '');
}

/**
 * Verifikasi apakah DOI benar-benar terdaftar di doi.org / CrossRef.
 * Timeout 3.5 detik per verifikasi agar tidak membebani pipeline.
 */
export async function verifyDoi(doiOrUrl: string): Promise<DoiVerificationResult> {
  const doi = extractDoi(doiOrUrl);
  if (doi) {
    try {
      const handleRes = await fetch(`https://doi.org/api/handles/${encodeURI(doi)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });
      if (handleRes.ok) {
        const data = (await handleRes.json()) as { responseCode?: number };
        if (data.responseCode === 1) {
          return {
            valid: true,
            doi,
            resolvedUrl: `https://doi.org/${doi}`,
            status: 200,
          };
        }
      }
    } catch {
      // fallback ke HEAD/GET jika Handle API gagal
    }
  }
  const targetUrl = doi ? `https://doi.org/${encodeURI(doi)}` : doiOrUrl;

  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'TGSDORK-Academic-Verifier/1.0 (mailto:scholar@tgsdork.local)',
        Accept: 'text/html,application/xhtml+xml,application/pdf',
      },
      signal: AbortSignal.timeout(3500),
      redirect: 'follow',
    });

    const valid = res.status >= 200 && res.status < 400;
    return {
      valid,
      doi: doi || undefined,
      resolvedUrl: res.url,
      status: res.status,
    };
  } catch {
    // ponytail: fallback coba GET ringan jika HEAD ditolak Cloudflare/WAF penerbit
    try {
      const getRes = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'TGSDORK-Academic-Verifier/1.0',
          Range: 'bytes=0-500',
        },
        signal: AbortSignal.timeout(3000),
        redirect: 'follow',
      });
      return {
        valid: getRes.status >= 200 && getRes.status < 400,
        doi: doi || undefined,
        resolvedUrl: getRes.url,
        status: getRes.status,
      };
    } catch {
      return { valid: false, doi: doi || undefined, status: 0 };
    }
  }
}

/**
 * Filter dan beri tanda status validasi pada daftar SourceItem.
 */
export async function verifySourceItems(sources: SourceItem[]): Promise<SourceItem[]> {
  const verified = await Promise.all(
    sources.map(async (src) => {
      const doi = src.doi || extractDoi(`${src.url} ${src.snippet} ${src.title}`);
      if (!doi) {
        return { ...src, doiVerified: false };
      }
      if (src.doiVerified) {
        return { ...src, doi, doiVerified: true };
      }
      const check = await verifyDoi(doi);
      return {
        ...src,
        doi: check.doi,
        doiVerified: check.valid,
        url: check.valid && check.resolvedUrl ? check.resolvedUrl : src.url,
      };
    })
  );
  return verified;
}

// Runnable self-check per Ponytail rule
if (process.env.RUN_TEST === '1') {
  const sample = extractDoi('https://doi.org/10.1016/j.future.2019.05.001');
  if (sample !== '10.1016/j.future.2019.05.001') {
    throw new Error(`DOI extraction failed: got ${sample}`);
  }
}
