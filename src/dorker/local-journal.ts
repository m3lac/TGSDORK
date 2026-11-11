import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SourceItem } from '../types/index.js';

// ponytail: createRequire — tsup/rollup membuang prefix "node:" pada import statis
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

const DB_PATH = path.join(os.homedir(), '.tgsdork', 'journals.db');

let db: InstanceType<typeof DatabaseSync> | null = null;

function open(): InstanceType<typeof DatabaseSync> | null {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    db = new DatabaseSync(DB_PATH);
    return db;
  } catch {
    return null;
  }
}

/**
 * Cari jurnal di korpus OpenAlex lokal (~/.tgsdork/journals.db).
 * ponytail: LIKE scan, bukan FTS5. Ganti ke FTS5 kalau korpus > 100k works.
 */
export function searchLocalJournals(query: string, maxResults = 4): SourceItem[] {
  const conn = open();
  if (!conn) return [];

  const words = query
    .toLowerCase()
    .replace(/-?(?:site|inurl|allinurl|intitle|allintitle|intext|allintext|filetype|ext):\S+|-?\S+"[^"]*"/g, ' ')
    .match(/[a-z]{4,}/g)
    ?.filter((w) => w !== 'dalam' && w !== 'pada' && w !== 'untuk' && w !== 'yang' && w !== 'dengan');
  if (!words || words.length === 0) return [];

  const uniq = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 3);
  const like = uniq.map((w) => `%${w}%`);

  const where = uniq.map(() => '(title LIKE ? OR abstract LIKE ?)').join(' OR ');
  const scoreExpr = uniq
    .map(() => '(CASE WHEN title LIKE ? THEN 5 ELSE 0 END) + (CASE WHEN abstract LIKE ? THEN 2 ELSE 0 END)')
    .join(' + ');
  const params = [...like.flatMap((l) => [l, l]), ...like.flatMap((l) => [l, l]), maxResults];

  try {
    const rows = conn
      .prepare(
        `SELECT doi, title, year, substr(abstract, 1, 1500) AS snippet, (${scoreExpr}) AS score
         FROM works
         WHERE (${where}) AND abstract IS NOT NULL
         ORDER BY score DESC, year DESC
         LIMIT ?`
      )
      .all(...params) as Array<{ doi?: string; title?: string; year?: number; snippet?: string }>;

    return rows
      .filter((r) => r.title && r.doi)
      .map((r, idx) => ({
        id: `local-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        title: r.title!,
        url: r.doi!,
        snippet: (r.snippet || '').replace(/\s+/g, ' ').trim(),
        citation: `(Jurnal Nasional, ${r.year || '2024'})`,
        fullRef: `${r.title}. (${r.year || '2024'}). *Jurnal Ilmiah Nasional Indonesia*. ${r.doi}`,
        fileType: 'html' as const,
        year: String(r.year || ''),
        doi: r.doi!.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ''),
        doiVerified: true,
      }));
  } catch {
    return [];
  }
}

export function localJournalAvailable(): boolean {
  return fs.existsSync(DB_PATH);
}

/**
 * Pencarian frasa langsung pada abstrak jurnal lokal untuk deteksi plagiarisme Turnitin.
 */
export function searchLocalJournalExactPhrases(phrases: string[], maxResults = 6): SourceItem[] {
  const conn = open();
  if (!conn || phrases.length === 0) return [];

  const results: SourceItem[] = [];
  const seenDois = new Set<string>();

  for (const phrase of phrases) {
    if (results.length >= maxResults) break;
    const cleanWords = phrase
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (cleanWords.length < 4) continue;

    const subPhrase = cleanWords.slice(0, 5).join(' ');
    const contentWords = cleanWords.filter((w) => w.length > 3).slice(0, 4);
    type LocalWorkRow = { doi?: string; title?: string; year?: number; abstract?: string };
    let rows: LocalWorkRow[] = [];

    try {
      rows = conn
        .prepare(`SELECT doi, title, year, abstract FROM works WHERE lower(abstract) LIKE ? LIMIT 3`)
        .all(`%${subPhrase}%`) as LocalWorkRow[];

      if (rows.length === 0 && contentWords.length >= 3) {
        const where = contentWords.map(() => 'lower(abstract) LIKE ?').join(' AND ');
        const params = contentWords.map((w) => `%${w}%`);
        rows = conn
          .prepare(`SELECT doi, title, year, abstract FROM works WHERE ${where} LIMIT 3`)
          .all(...params) as LocalWorkRow[];
      }

      for (const r of rows) {
        if (!r.doi || !r.title || seenDois.has(r.doi)) continue;
        seenDois.add(r.doi);
        results.push({
          id: `local-exact-${results.length}-${Math.random().toString(36).slice(2, 7)}`,
          title: r.title,
          url: r.doi,
          snippet: (r.abstract || '').slice(0, 800),
          content: r.abstract || '',
          citation: `(Jurnal Nasional, ${r.year || '2024'})`,
          fullRef: `${r.title}. (${r.year || '2024'}). *Jurnal Ilmiah Nasional Indonesia*. ${r.doi}`,
          fileType: 'html',
          year: String(r.year || ''),
          doi: r.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ''),
          doiVerified: true,
        });
      }
    } catch {}
  }

  return results.slice(0, maxResults);
}
