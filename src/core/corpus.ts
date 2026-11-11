import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { listCheckpoints, getTaskDir } from './checkpoint.js';

// ponytail: createRequire — tsup/rollup strips "node:" on static ESM import
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };

const CORPUS_DB_PATH = path.join(os.homedir(), '.tgsdork', 'student_corpus.db');

let corpusDb: DatabaseSyncType | null = null;
let workspaceSynced = false;

const CORPUS_STOPWORDS: Record<string, true> = {
  yang: true, dan: true, di: true, ke: true, dari: true, dalam: true, untuk: true, pada: true, dengan: true, adalah: true,
  merupakan: true, oleh: true, sebagai: true, bahwa: true, ini: true, itu: true, atau: true, juga: true, dapat: true,
  akan: true, tidak: true, telah: true, serta: true, secara: true, karena: true, hal: true, tersebut: true, bisa: true,
  ada: true, lebih: true, seperti: true, namun: true, tetapi: true, jika: true, maka: true, agar: true, saat: true,
  the: true, is: true, are: true, was: true, were: true, in: true, on: true, at: true, to: true, of: true, and: true, or: true,
  for: true, with: true, that: true, this: true, by: true, from: true, as: true, an: true, be: true, it: true, not: true,
};
function openCorpusDb(): DatabaseSyncType {
  if (corpusDb) return corpusDb;
  const dir = path.dirname(CORPUS_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(CORPUS_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT,
      owner TEXT,
      hash TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      sentence_text TEXT NOT NULL,
      norm_text TEXT NOT NULL,
      word_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shingles (
      shingle TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      sentence_id INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_papers_hash ON papers(hash);
    CREATE INDEX IF NOT EXISTS idx_sentences_doc ON sentences(doc_id);
    CREATE INDEX IF NOT EXISTS idx_shingles_key ON shingles(shingle);
    CREATE INDEX IF NOT EXISTS idx_shingles_doc ON shingles(doc_id);
  `);
  corpusDb = db;
  return db;
}

export function normalizeCorpusText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function computeContentHash(text: string): string {
  return crypto.createHash('sha256').update(normalizeCorpusText(text)).digest('hex');
}

export function splitAcademicSentences(text: string): string[] {
  const protectedText = text
    .replace(/\b(dkk|et al|hlm|hal|vol|no|dr|prof|ir|jl|pt|cv|bab|gambar|tabel|fig|ed|eds|pp)\.\s*/gi, (m) =>
      m.replace('.', '___DOT___')
    )
    .replace(/(\d+)\.(\d+)/g, '$1___DOT___$2');

  return protectedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/___DOT___/g, '.').trim())
    .filter((s) => {
      if (s.length < 12) return false;
      // Ignore markdown table separator lines or headings with just 1-2 words
      if (/^\|[\s:|-]+\|$/.test(s)) return false;
      const words = s.split(/\s+/).filter(Boolean);
      return words.length >= 5;
    });
}

export function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function extractShingles(text: string, k = 4): string[] {
  const words = extractWords(text);
  if (words.length < k) return [];
  const out: string[] = [];
  for (let i = 0; i <= words.length - k; i++) {
    out.push(words.slice(i, i + k).join(' '));
  }
  return out;
}

export function compareSentenceSimilarity(
  querySentence: string,
  candidateText: string,
  isSingleSentenceCandidate = true
): {
  consecutiveWords: number;
  contentContainment: number;
  matchedContentWords: number;
  isMatch: boolean;
} {
  const w1 = extractWords(querySentence);
  const w2 = extractWords(candidateText);
  if (w1.length < 5 || w2.length < 5) {
    return { consecutiveWords: 0, contentContainment: 0, matchedContentWords: 0, isMatch: false };
  }

  // 1. Longest consecutive matching word span
  let maxConsecutive = 0;
  const w2Str = ' ' + w2.join(' ') + ' ';
  const maxSpan = Math.min(w1.length, 30);
  for (let len = maxSpan; len >= 5; len--) {
    let found = false;
    for (let i = 0; i <= w1.length - len; i++) {
      const phrase = ' ' + w1.slice(i, i + len).join(' ') + ' ';
      if (w2Str.includes(phrase)) {
        maxConsecutive = len;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // 2. Content word containment (only meaningful against single sentences/short chunks)
  let matchedContentWords = 0;
  let contentContainment = 0;
  if (isSingleSentenceCandidate) {
    const cw1 = w1.filter((w) => w.length > 2 && !CORPUS_STOPWORDS[w]);
    const cw2Set = new Set(w2.filter((w) => w.length > 2 && !CORPUS_STOPWORDS[w]));
    if (cw1.length > 0) {
      for (const cw of cw1) {
        if (cw2Set.has(cw)) matchedContentWords++;
      }
      contentContainment = matchedContentWords / cw1.length;
    }
  }

  const isMatch =
    maxConsecutive >= 5 ||
    (isSingleSentenceCandidate && contentContainment >= 0.58 && matchedContentWords >= 5);

  return {
    consecutiveWords: maxConsecutive,
    contentContainment,
    matchedContentWords,
    isMatch,
  };
}

function normalizeTitleForCompare(raw: string): string {
  return path
    .parse(raw || '')
    .name.toLowerCase()
    .replace(/_(?:turnitin_pass|revisi|review)+$/gi, '')
    .replace(/[^a-z0-9]/g, '');
}

function isSameDocumentSelfMatch(
  paper: { id: string; title: string; topic: string; hash: string },
  currentTitle: string,
  currentHash: string
): boolean {
  const normCurrent = normalizeTitleForCompare(currentTitle);
  const normTitle = normalizeTitleForCompare(paper.title);
  const normTopic = normalizeTitleForCompare(paper.topic || '');

  // 1. Exact hash matches
  if (paper.hash === currentHash) {
    if (!normCurrent || normCurrent === 'naskahinput' || normCurrent === 'output' || normCurrent === 'naskah') {
      return true;
    }
    if (normCurrent === normTitle || normCurrent === normTopic) return true;
    if (normTopic && (normCurrent.includes(normTopic) || normTopic.includes(normCurrent))) return true;
    if (normTitle && (normCurrent.includes(normTitle) || normTitle.includes(normCurrent))) return true;
    if (paper.id && currentTitle.toLowerCase().includes(paper.id.toLowerCase())) return true;
  }

  // 2. Same unique document title / taskId re-submission (e.g. revision of same paper >= 14 chars)
  const isGenericTitle =
    normCurrent.length < 14 ||
    /^(?:makalah|skripsi|tugas|naskah|laporan|dokumen|paper|review|tugasakhir)/.test(normCurrent);

  if (!isGenericTitle) {
    if (
      paper.id &&
      (currentTitle.toLowerCase() === paper.id.toLowerCase() ||
        currentTitle.toLowerCase().includes(paper.id.toLowerCase()))
    ) {
      return true;
    }
    if (normTitle && normCurrent === normTitle) return true;
    if (normTopic && (normCurrent === normTopic || (normCurrent.length > 20 && normCurrent.includes(normTopic)))) {
      return true;
    }
  }

  return false;
}

export function indexPaperToCorpus(doc: {
  id: string;
  title: string;
  topic?: string;
  owner?: string;
  content: string;
  createdAt?: string;
}): void {
  const clean = doc.content.trim();
  if (!clean || clean.length < 150) return;

  const hash = computeContentHash(clean);
  const db = openCorpusDb();

  const existing = db.prepare('SELECT id, hash FROM papers WHERE id = ?').get(doc.id) as
    | { id: string; hash: string }
    | undefined;
  if (existing && existing.hash === hash) {
    return;
  }

  const sentences = splitAcademicSentences(clean);
  if (sentences.length === 0) return;

  const totalWords = extractWords(clean).length;

  db.exec('BEGIN');
  try {
    if (existing) {
      db.prepare('DELETE FROM shingles WHERE doc_id = ?').run(doc.id);
      db.prepare('DELETE FROM sentences WHERE doc_id = ?').run(doc.id);
      db.prepare('DELETE FROM papers WHERE id = ?').run(doc.id);
    }

    db.prepare(
      'INSERT INTO papers (id, title, topic, owner, hash, word_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      doc.id,
      doc.title,
      doc.topic || doc.title,
      doc.owner || 'local',
      hash,
      totalWords,
      doc.createdAt || new Date().toISOString()
    );

    const insSent = db.prepare(
      'INSERT INTO sentences (doc_id, sentence_text, norm_text, word_count) VALUES (?, ?, ?, ?)'
    );
    const insShingle = db.prepare('INSERT INTO shingles (shingle, doc_id, sentence_id) VALUES (?, ?, ?)');

    for (const s of sentences) {
      const words = extractWords(s);
      if (words.length < 5) continue;
      const norm = words.join(' ');
      const info = insSent.run(doc.id, s, norm, words.length);
      const sentId = Number(info.lastInsertRowid);
      const shingles = extractShingles(norm, 4);
      const seenShingle = new Set<string>();
      for (const sh of shingles) {
        if (!seenShingle.has(sh)) {
          seenShingle.add(sh);
          insShingle.run(sh, doc.id, sentId);
        }
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function syncWorkspaceToCorpus(force = false): number {
  if (workspaceSynced && !force) return 0;
  let indexedCount = 0;

  try {
    const tasks = listCheckpoints();
    for (const t of tasks) {
      let content = '';
      const taskDir = getTaskDir(t.id);
      const mdPath = path.join(taskDir, 'output.md');
      if (fs.existsSync(mdPath)) {
        content = fs.readFileSync(mdPath, 'utf-8');
      } else if (t.sections && t.sections.length > 0) {
        content = t.sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
      }
      if (content.trim().length >= 200) {
        indexPaperToCorpus({
          id: t.id,
          title: t.topic,
          topic: t.topic,
          owner: t.owner || 'workspace',
          content,
          createdAt: t.createdAt,
        });
        indexedCount++;
      }
    }
    workspaceSynced = true;
  } catch {
    // ponytail: non-fatal if workspace is absent
  }

  return indexedCount;
}

export interface CorpusMatchedSentence {
  sentenceIndex: number;
  sentence: string;
  matchedCorpusSentence: string;
  consecutiveWords: number;
  overlapScore: number;
}

export interface CorpusDocumentMatch {
  docId: string;
  title: string;
  createdAt: string;
  matchedWords: number;
  matchedSentences: CorpusMatchedSentence[];
}

export function findMatchesInStudentCorpus(
  sentences: string[],
  currentTitle: string,
  currentHash: string
): CorpusDocumentMatch[] {
  syncWorkspaceToCorpus();
  const db = openCorpusDb();

  // Quick check if any paper exists in corpus
  const countRow = db.prepare('SELECT count(*) AS c FROM papers').get() as { c: number };
  if (!countRow || countRow.c === 0) return [];

  const docMap = new Map<
    string,
    {
      docId: string;
      title: string;
      createdAt: string;
      matchedWords: number;
      matchedSentences: CorpusMatchedSentence[];
    }
  >();

  // Prepare candidate lookup statement
  const papersCache = new Map<string, { id: string; title: string; topic: string; hash: string; created_at: string }>();
  const allPapers = db.prepare('SELECT id, title, topic, hash, created_at FROM papers').all() as Array<{
    id: string;
    title: string;
    topic: string;
    hash: string;
    created_at: string;
  }>;
  for (const p of allPapers) {
    papersCache.set(p.id, p);
  }

  for (let idx = 0; idx < sentences.length; idx++) {
    const sent = sentences[idx];
    const shingles = extractShingles(sent, 4);
    if (shingles.length === 0) continue;

    // Limit to up to 16 shingles per sentence to keep query fast
    const sampleShingles = shingles.slice(0, 16);
    const placeholders = sampleShingles.map(() => '?').join(',');
    const candidates = db
      .prepare(
        `SELECT DISTINCT sh.doc_id, st.sentence_text
         FROM shingles sh
         JOIN sentences st ON st.id = sh.sentence_id
         WHERE sh.shingle IN (${placeholders})
         LIMIT 40`
      )
      .all(...sampleShingles) as Array<{ doc_id: string; sentence_text: string }>;

    if (candidates.length === 0) continue;

    let bestMatch: {
      docId: string;
      title: string;
      createdAt: string;
      corpusSentence: string;
      consecutiveWords: number;
      score: number;
    } | null = null;

    for (const cand of candidates) {
      const paper = papersCache.get(cand.doc_id);
      if (!paper) continue;
      if (isSameDocumentSelfMatch(paper, currentTitle, currentHash)) continue;

      const sim = compareSentenceSimilarity(sent, cand.sentence_text, true);
      if (!sim.isMatch) continue;

      const score = sim.consecutiveWords >= 5 ? Math.min(1, 0.65 + sim.consecutiveWords * 0.04) : sim.contentContainment;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          docId: paper.id,
          title: paper.title,
          createdAt: paper.created_at,
          corpusSentence: cand.sentence_text,
          consecutiveWords: sim.consecutiveWords,
          score,
        };
      }
    }

    if (bestMatch) {
      let entry = docMap.get(bestMatch.docId);
      if (!entry) {
        entry = {
          docId: bestMatch.docId,
          title: bestMatch.title,
          createdAt: bestMatch.createdAt,
          matchedWords: 0,
          matchedSentences: [],
        };
        docMap.set(bestMatch.docId, entry);
      }
      entry.matchedWords += extractWords(sent).length;
      entry.matchedSentences.push({
        sentenceIndex: idx,
        sentence: sent,
        matchedCorpusSentence: bestMatch.corpusSentence,
        consecutiveWords: bestMatch.consecutiveWords,
        overlapScore: bestMatch.score,
      });
    }
  }

  return Array.from(docMap.values()).sort((a, b) => b.matchedWords - a.matchedWords);
}

export function registerScannedManuscriptToCorpus(title: string, content: string): void {
  const cleanTitle = path.parse(title || 'Naskah').name;
  // Do not pollute corpus with generic bypassed output or very short snippets
  if (cleanTitle.toLowerCase().includes('_turnitin_pass')) return;
  if (content.trim().length < 300) return;

  const hash = computeContentHash(content);
  const docId = `scan-${hash.slice(0, 14)}`;

  // Check if same hash already exists in workspace/corpus under another id
  const db = openCorpusDb();
  const sameHash = db.prepare('SELECT id FROM papers WHERE hash = ? LIMIT 1').get(hash) as
    | { id: string }
    | undefined;
  if (sameHash) return;

  indexPaperToCorpus({
    id: docId,
    title: cleanTitle === 'Naskah_Input' ? `Naskah Pindaian (${new Date().toISOString().slice(0, 10)})` : cleanTitle,
    topic: cleanTitle,
    owner: 'submitted_scan',
    content,
  });
}

export function removePaperFromCorpus(docId: string): void {
  const db = openCorpusDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM shingles WHERE doc_id = ?').run(docId);
    db.prepare('DELETE FROM sentences WHERE doc_id = ?').run(docId);
    db.prepare('DELETE FROM papers WHERE id = ?').run(docId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
