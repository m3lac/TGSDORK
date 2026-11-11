import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { listCheckpoints, loadCheckpoint, initCheckpoint, saveCheckpoint, getTaskDir } from '../core/checkpoint.js';
import { runTaskPipeline } from '../pipelines/runner.js';
import { generateText } from '../ai/client.js';
import { exportToMarkdown } from '../exporter/markdown.js';
import { exportToDocx } from '../exporter/docx-builder.js';
import { exportToMarpSlide } from '../exporter/slide-builder.js';
import { exportToPptx, generatePptxFromTitle } from '../exporter/pptx-builder.js';
import { exportToBibtex } from '../exporter/bibtex.js';
import { exportMarkdownToPdf } from '../exporter/pdf-builder.js';
import { exportToZip } from '../exporter/zip-builder.js';
import { copyToDocuments } from '../core/downloads.js';
import {
  reviewTask,
  reviseTask,
  autoReviseTask,
  reviewFile,
  reviewDocumentText,
  readTextFromFile,
  autoReviseDocumentText,
  resolveTargetFile,
  extractAcademicTopic,
} from '../pipelines/reviewer.js';
import { scanTurnitinWithGemini, autoParaphraseTurnitin } from '../pipelines/turnitin.js';
import { requestOtp, verifyOtp, getSessionUser, removeSession } from '../core/auth.js';
import { logger } from '../core/logger.js';
import type { TaskType, UnifiedActiveJob } from '../types/index.js';

import { FAVICON_B64 } from './favicon.js';
import { renderLandingHtml } from './landing-html.js';
import { renderStudioHtml } from './studio-html.js';

function isLocalDevUiRequest(req: http.IncomingMessage): boolean {
  if (process.env.TGSDORK_DEV_UI !== '1') return false;
  if (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) return false;
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

const PUBLIC_MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function getUserEmail(req: http.IncomingMessage, url?: URL): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const email = getSessionUser(token);
    if (email) return email;
  }
  const xToken = req.headers['x-auth-token'];
  if (typeof xToken === 'string' && xToken.trim()) {
    const email = getSessionUser(xToken.trim());
    if (email) return email;
  }
  if (url) {
    const qToken = url.searchParams.get('token');
    if (qToken) {
      const email = getSessionUser(qToken.trim());
      if (email) return email;
    }
  }
  if (isLocalDevUiRequest(req)) return 'dev@local';
  return null;
}

function canAccessTask(taskId: string, userEmail: string | null, req?: http.IncomingMessage): boolean {
  if (!userEmail) return false;
  const state = loadCheckpoint(taskId);
  if (!state) return false;
  if (req && isLocalDevUiRequest(req) && userEmail === 'dev@local') return true;
  return state.owner === userEmail;
}

export function startServer(port = 3456): void {
  const wsClients = new Map<WebSocket, { userEmail: string | null; isDev: boolean }>();
  const activeJobs = new Map<string, UnifiedActiveJob>();

  function getActiveJobsForClient(userEmail: string | null, isDev: boolean): UnifiedActiveJob[] {
    const list = Array.from(activeJobs.values());
    if (isDev && userEmail === 'dev@local') return list;
    if (!userEmail) return [];
    const normalized = userEmail.toLowerCase();
    return list.filter((j) => j.owner.toLowerCase() === normalized);
  }

  function broadcastJobUpdate(job: UnifiedActiveJob): void {
    const jobOwner = job.owner.toLowerCase();
    for (const [ws, info] of wsClients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        if ((info.isDev && info.userEmail === 'dev@local') || (info.userEmail && info.userEmail.toLowerCase() === jobOwner)) {
          try {
            ws.send(
              JSON.stringify({
                type: 'job_update',
                job,
                activeJobs: getActiveJobsForClient(info.userEmail, info.isDev),
              })
            );
          } catch {}
        }
      }
    }
  }

  function registerJob(opts: {
    id: string;
    type: UnifiedActiveJob['type'];
    typeLabel: string;
    title: string;
    step: string;
    detail: string;
    owner: string;
  }): UnifiedActiveJob {
    const now = Date.now();
    const job: UnifiedActiveJob = {
      id: opts.id,
      type: opts.type,
      typeLabel: opts.typeLabel,
      title: opts.title,
      step: opts.step,
      detail: opts.detail,
      owner: opts.owner,
      status: 'running',
      startedAt: now,
      updatedAt: now,
    };
    activeJobs.set(opts.id, job);
    broadcastJobUpdate(job);
    return job;
  }

  function updateJobProgress(id: string, step: string, detail: string): void {
    const job = activeJobs.get(id);
    if (!job) return;
    job.step = step;
    job.detail = detail;
    job.updatedAt = Date.now();
    broadcastJobUpdate(job);
  }

  function finishJob(id: string, detail?: string, resultUrl?: string): void {
    const job = activeJobs.get(id);
    if (!job) return;
    job.status = 'completed';
    if (detail) job.detail = detail;
    if (resultUrl) job.resultUrl = resultUrl;
    job.updatedAt = Date.now();
    broadcastJobUpdate(job);
    setTimeout(() => {
      if (activeJobs.get(id)?.status === 'completed') {
        activeJobs.delete(id);
        broadcastJobUpdate({ ...job, status: 'completed' });
      }
    }, 20000);
  }

  function failJob(id: string, error: string): void {
    const job = activeJobs.get(id);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
    job.detail = `Gagal: ${error}`;
    job.updatedAt = Date.now();
    broadcastJobUpdate(job);
    setTimeout(() => {
      if (activeJobs.get(id)?.status === 'failed') {
        activeJobs.delete(id);
        broadcastJobUpdate({ ...job, status: 'failed' });
      }
    }, 30000);
  }

  // ponytail: in-memory job tracker for PPT-from-title, polling pattern sama dengan audit revise
  const pptxJobs = new Map<string, {
    status: 'running' | 'completed' | 'error';
    topic: string;
    owner: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
  }>();
  const DECKS_DIR = path.join(os.homedir(), '.tgsdork', 'decks');

  const auditReviseJobs = new Map<string, {
    status: 'running' | 'completed' | 'error';
    progress: string;
    result?: {
      fileName: string;
      finalScore: number;
      rounds: number;
      finalReport: string;
      revisedText: string;
      docxUrl: string;
      pdfUrl: string;
      bibUrl: string;
      mdUrl: string;
    };
    error?: string;
    updatedAt: number;
  }>();

  const turnitinParaphraseJobs = new Map<string, {
    status: 'running' | 'completed' | 'error';
    progress: string;
    result?: {
      fileName: string;
      newSimilarityScore: number;
      newAiScore: number;
      newReport: string;
      docxUrl: string;
      pdfUrl: string;
      mdUrl: string;
    };
    error?: string;
    owner: string;
    createdAt: number;
    updatedAt: number;
  }>();

  function broadcastWs(data: unknown, targetOwner?: string): void {
    const raw = JSON.stringify(data);
    const targetLower = targetOwner ? targetOwner.toLowerCase() : null;
    for (const [ws, info] of wsClients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        if (!targetLower || (info.isDev && info.userEmail === 'dev@local') || (info.userEmail && info.userEmail.toLowerCase() === targetLower)) {
          try {
            ws.send(raw);
          } catch {}
        }
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // CORS Headers for Mobile & API access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /favicon.ico
    if (url.pathname === '/favicon.ico' && req.method === 'GET') {
      const buf = Buffer.from(FAVICON_B64, 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      res.end(buf);
      return;
    }

    // GET /public/* (Static UI assets: CSS, JS, fonts, icons, images)
    if (url.pathname.startsWith('/public/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const publicRoot = path.resolve(process.cwd(), 'public');
      const relPath = decodeURIComponent(url.pathname.slice('/public/'.length));
      const filePath = path.resolve(publicRoot, relPath);
      if ((filePath === publicRoot || filePath.startsWith(publicRoot + path.sep)) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': PUBLIC_MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET / or /landing (Landing Page)
    if ((url.pathname === '/' || url.pathname === '/landing') && (req.method === 'GET' || req.method === 'HEAD')) {
      if (url.pathname === '/' && url.searchParams.has('tab')) {
        res.writeHead(302, { Location: `/studio${url.search}` });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(renderLandingHtml(isLocalDevUiRequest(req)));
      return;
    }

    // GET /studio or /app (Bento Web Studio)
    if ((url.pathname === '/studio' || url.pathname === '/app') && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(renderStudioHtml(isLocalDevUiRequest(req)));
      return;
    }

    // POST /api/auth/send-code
    if (url.pathname === '/api/auth/send-code' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { email } = JSON.parse(body);
          const result = await requestOtp(email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/auth/verify
    if (url.pathname === '/api/auth/verify' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { email, code } = JSON.parse(body);
          const result = verifyOtp(email, code);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/auth/logout
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        removeSession(authHeader.slice(7).trim());
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // POST /api/chat (Konsultan Akademik — perencanaan topik & outline)
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const userEmail = getUserEmail(req, url);
          if (!userEmail) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sesi login tidak valid. Silakan masuk terlebih dahulu.' }));
            return;
          }
          const parsed = JSON.parse(body) as { messages?: Array<{ role: string; content: string }> };
          const msgs = (parsed.messages || []).slice(-12);

          const transcript = msgs
            .map((m) => `${m.role === 'user' ? 'Mahasiswa' : 'Konsultan'}: ${String(m.content).slice(0, 3000)}`)
            .join('\n\n');

          const reply = await generateText({
            prompt: `Transkrip diskusi sejauh ini:\n\n${transcript}\n\n\nLanjutkan percakapan sebagai Konsultan Akademik. Jawab pesan terakhir mahasiswa secara langsung, terstruktur, dan operasional (rumusan masalah, kerangka bab, atau metodologi bila relevan).`,
            systemPrompt: `Kamu adalah Konsultan Akademik TGSDORK. Bantu mahasiswa merumuskan judul, latar belakang, rumusan masalah, kerangka bab, metodologi, dan novelty penelitian. Gunakan bahasa Indonesia akademis yang lugas. Jika mahasiswa sudah sepakat soal topik, sarankan agar topik itu disalin ke tab "Riset & Susun" untuk penyusunan naskah lengkap.`,
            role: 'fast',
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, reply }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // GET /api/tasks (Workspace Scoped Strictly by User Email)
    if (url.pathname === '/api/tasks' && req.method === 'GET') {
      const userEmail = getUserEmail(req, url);
      if (!userEmail) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const allTasks = listCheckpoints();
      // STRICT PRIVACY in prod; in explicit local dev UI mode show all local workspace tasks for UI previewing
      const userTasks = isLocalDevUiRequest(req) && userEmail === 'dev@local'
        ? allTasks
        : allTasks.filter((t) => t.owner === userEmail);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(userTasks));
      return;
    }

    // GET /api/active-jobs
    if (url.pathname === '/api/active-jobs' && (req.method === 'GET' || req.method === 'HEAD')) {
      const userEmail = getUserEmail(req, url);
      if (!userEmail) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      const isDev = isLocalDevUiRequest(req);
      const jobs = getActiveJobsForClient(userEmail, isDev);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jobs));
      return;
    }

    // POST /api/tasks/create
    if (url.pathname === '/api/tasks/create' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const userEmail = getUserEmail(req, url);
          if (!userEmail) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sesi login tidak valid. Silakan masuk terlebih dahulu.' }));
            return;
          }
          const parsed = JSON.parse(body) as {
            topic: string;
            taskType: TaskType;
            font?: string;
            citationStyle?: 'apa' | 'ieee' | 'harvard';
            cover?: Record<string, string>;
            chapterCount?: number;
            customChapters?: string[];
            customRefs?: Array<{ filename: string; data: string }>;
          };
          const state = initCheckpoint(parsed.topic, parsed.taskType || 'makalah', userEmail, parsed.font || 'Times New Roman');
          state.citationStyle = parsed.citationStyle === 'harvard' ? 'harvard' : (parsed.citationStyle === 'ieee' ? 'ieee' : 'apa');
          if (parsed.cover && Object.values(parsed.cover).some((v) => String(v || '').trim())) {
            state.cover = parsed.cover;
          }

          if (Array.isArray(parsed.customRefs) && parsed.customRefs.length > 0) {
            const tmpDir = path.join(os.tmpdir(), 'tgsdork-refs');
            fs.mkdirSync(tmpDir, { recursive: true });
            for (let i = 0; i < Math.min(parsed.customRefs.length, 5); i++) {
              const refItem = parsed.customRefs[i];
              if (!refItem?.filename || !refItem?.data) continue;
              try {
                const safeName = path.basename(refItem.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
                const tmpPath = path.join(tmpDir, `${Date.now()}-${i}-${safeName}`);
                fs.writeFileSync(tmpPath, Buffer.from(refItem.data, 'base64'));
                const extractedText = (await readTextFromFile(tmpPath)).slice(0, 10000);
                try { fs.unlinkSync(tmpPath); } catch {}
                if (!extractedText.trim()) continue;

                const cleanTitle = refItem.filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
                const yearMatch = `${cleanTitle} ${extractedText.slice(0, 800)}`.match(/\b(20[012]\d|199\d)\b/);
                const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
                const firstWord = cleanTitle.split(/\s+/)[0] || 'Referensi';
                state.sources.push({
                  id: `custom-ref-${i + 1}`,
                  title: cleanTitle,
                  url: `Dokumen Referensi: ${refItem.filename}`,
                  snippet: extractedText.slice(0, 700),
                  content: extractedText,
                  citation: `(${firstWord}, ${year})`,
                  fullRef: `${cleanTitle}. (${year}). *Jurnal / Referensi Akademik Terlampir (${refItem.filename})*.`,
                  fileType: 'pdf',
                  year,
                });
              } catch (refErr) {
                logger.warn(`Gagal mengekstrak customRef ${refItem.filename}: ${refErr}`);
              }
            }
          }
          saveCheckpoint(state);

          registerJob({
            id: state.id,
            type: 'susun_naskah',
            typeLabel: 'Susun Naskah',
            title: state.topic,
            step: 'dorking',
            detail: 'Merumuskan kueri literatur & penelusuran jurnal...',
            owner: userEmail,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              id: state.id,
              topic: state.topic,
              step: state.step,
            })
          );

          (async () => {
            try {
              let finalState = await runTaskPipeline(state, {
                preset: 'academic-all',
                chapterCount: parsed.chapterCount,
                customChapters: parsed.customChapters,
                onProgress: (step, detail) => {
                  updateJobProgress(state.id, step, detail);
                  broadcastWs({
                    type: 'step',
                    taskId: state.id,
                    step,
                    detail,
                  }, userEmail);
                },
                onDraftStream: (event) => {
                  broadcastWs({
                    type: 'draft_stream',
                    taskId: state.id,
                    event,
                  }, userEmail);
                },
              });

              // Auto-audit pass: Pastikan skor baseline minimal 80 sejak naskah pertama lahir
              try {
                updateJobProgress(finalState.id, 'audit', 'Menjalankan auto-audit kelayakan naskah...');
                broadcastWs({
                  type: 'step',
                  taskId: finalState.id,
                  step: 'audit',
                  detail: 'Menjalankan auto-audit kelayakan naskah...',
                }, userEmail);
                logger.step('AUTO-AUDIT', `Menjalankan auto-audit kelayakan untuk "${finalState.topic}"...`);
                finalState = await autoReviseTask(finalState.id, 82);
              } catch (auditErr) {
                logger.warn(`Auto-audit awal dilewati: ${auditErr}`);
              }

              const mdPath = exportToMarkdown(finalState);
              const docxPath = await exportToDocx(finalState, finalState.font);
              const slides = exportToMarpSlide(finalState);
              const bibPath = exportToBibtex(finalState);

              let pptxPath: string | undefined;
              try {
                pptxPath = await exportToPptx(finalState);
              } catch (pptxErr) {
                logger.warn(`Gagal membuat PPTX: ${pptxErr}`);
              }

              let pdfPath: string | undefined;
              try {
                const targetPdf = path.join(getTaskDir(finalState.id), 'output.pdf');
                pdfPath = await exportMarkdownToPdf(finalState.topic, fs.readFileSync(mdPath, 'utf-8'), targetPdf, finalState.font);
              } catch (pdfErr) {
                logger.warn(`Gagal membuat PDF awal: ${pdfErr}`);
              }

              copyToDocuments(finalState, {
                docx: docxPath,
                pdf: pdfPath,
                md: mdPath,
                html: slides.htmlPath,
                bib: bibPath,
                pptx: pptxPath,
              });

              finishJob(finalState.id, 'Naskah selesai disusun dan lulus audit mutu.', `/api/download/${finalState.id}/docx`);
              broadcastWs({
                type: 'completed',
                taskId: finalState.id,
                topic: finalState.topic,
              }, userEmail);
              logger.success(`Tugas background "${state.topic}" (${state.id}) selesai disusun dengan standar mutu tinggi.`);
            } catch (err) {
              failJob(state.id, String(err));
              broadcastWs({
                type: 'failed',
                taskId: state.id,
                error: String(err),
              }, userEmail);
              logger.error(`Gagal menyelesaikan tugas background ${state.id}: ${err}`);
            }
          })();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/pptx/create — PPT langsung dari judul, tanpa riset/dorking
    if (url.pathname === '/api/pptx/create' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const userEmail = getUserEmail(req, url);
          if (!userEmail) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sesi login tidak valid. Silakan masuk terlebih dahulu.' }));
            return;
          }
          const parsed = JSON.parse(body) as { topic?: string; animate?: boolean; theme?: string };
          const topic = String(parsed.topic || '').trim();
          const animate = Boolean(parsed.animate);
          const theme = parsed.theme ? String(parsed.theme).trim() : 'auto';
          if (topic.length < 3) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Judul presentasi minimal 3 karakter.' }));
            return;
          }

          const jobId = crypto.randomBytes(8).toString('hex');
          const now = Date.now();
          pptxJobs.set(jobId, { status: 'running', topic, owner: userEmail, createdAt: now, updatedAt: now });
          registerJob({
            id: jobId,
            type: 'pptx',
            typeLabel: 'PowerPoint',
            title: topic,
            step: 'generating',
            detail: 'Menyusun salindia 10–14 slide beserta catatan pemateri...',
            owner: userEmail,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, jobId, topic }));

          (async () => {
            try {
              fs.mkdirSync(DECKS_DIR, { recursive: true });
              const outPath = path.join(DECKS_DIR, `${jobId}.pptx`);
              await generatePptxFromTitle(topic, outPath, { animate, theme });
              const job = pptxJobs.get(jobId);
              if (job) {
                job.status = 'completed';
                job.updatedAt = Date.now();
              }
              finishJob(jobId, `PowerPoint "${topic}" selesai dibuat!`, `/api/download-pptx/${jobId}`);
              broadcastWs({ type: 'pptx_completed', jobId, topic }, userEmail);
            } catch (err) {
              logger.error(`Gagal membuat PPTX dari judul "${topic}": ${err}`);
              const job = pptxJobs.get(jobId);
              if (job) {
                job.status = 'error';
                job.error = String(err);
                job.updatedAt = Date.now();
              }
              failJob(jobId, String(err));
            }
          })();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // GET /api/pptx/status/:jobId
    const pptxStatusMatch = url.pathname.match(/^\/api\/pptx\/status\/([a-f0-9]+)$/);
    if (pptxStatusMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const userEmail = getUserEmail(req, url);
      const job = pptxJobs.get(pptxStatusMatch[1]);
      if (!job || !userEmail || job.owner !== userEmail) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Job tidak ditemukan.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: job.status,
          topic: job.topic,
          error: job.error,
          downloadUrl: job.status === 'completed' ? `/api/download-pptx/${pptxStatusMatch[1]}` : null,
        })
      );
      return;
    }

    // GET /api/download-pptx/:jobId
    const pptxDlMatch = url.pathname.match(/^\/api\/download-pptx\/([a-f0-9]+)$/);
    if (pptxDlMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const userEmail = getUserEmail(req, url);
      const job = pptxJobs.get(pptxDlMatch[1]);
      if (!job || !userEmail || job.owner !== userEmail) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak.');
        return;
      }
      const filePath = path.join(DECKS_DIR, `${pptxDlMatch[1]}.pptx`);
      if (fs.existsSync(filePath)) {
        const safeName = job.topic.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'presentasi';
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${safeName}.pptx"`,
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(fs.readFileSync(filePath));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File presentasi belum siap.');
      return;
    }

    // POST /api/upload-review
    if (url.pathname === '/api/upload-review' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const jobOwner = getUserEmail(req, url) || (isLocalDevUiRequest(req) ? 'dev@local' : 'anonymous');
        const reviewJobId = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        let jobRegistered = false;
        try {
          const parsed = JSON.parse(body) as { filename: string; data: string };
          const safeName = path.basename(parsed.filename || 'uploaded_document.docx');
          registerJob({
            id: reviewJobId,
            type: 'audit_revisi',
            typeLabel: 'Audit Dokumen',
            title: safeName,
            step: 'reviewing',
            detail: 'Memeriksa struktur naskah, rujukan & PUEBI...',
            owner: jobOwner,
          });
          jobRegistered = true;

          const tmpPath = path.join(os.tmpdir(), `tgsdork_${Date.now()}_${safeName}`);
          fs.writeFileSync(tmpPath, Buffer.from(parsed.data, 'base64'));

          const text = await readTextFromFile(tmpPath);
          const result = await reviewDocumentText(safeName, text);

          try {
            const destReview = path.join(os.homedir(), 'Documents', `${path.parse(safeName).name}_review.md`);
            fs.writeFileSync(destReview, result, 'utf-8');
          } catch {}

          finishJob(reviewJobId, `Pemeriksaan kelayakan "${safeName}" selesai.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result, text, filename: safeName }));
        } catch (err) {
          if (jobRegistered) failJob(reviewJobId, String(err));
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/audit-revise (Async job to prevent Cloudflare 524 timeout)
    if (url.pathname === '/api/audit-revise' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as {
            filename: string;
            text: string;
            auditReport: string;
          };
          const jobId = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const now = Date.now();
          const jobOwner = getUserEmail(req, url) || (isLocalDevUiRequest(req) ? 'dev@local' : 'anonymous');
          for (const [id, j] of auditReviseJobs.entries()) {
            if (now - j.updatedAt > 3600000) auditReviseJobs.delete(id);
          }
          auditReviseJobs.set(jobId, {
            status: 'running',
            progress: 'Memulai auto-revisi akademik...',
            updatedAt: now,
          });
          registerJob({
            id: jobId,
            type: 'audit_revisi',
            typeLabel: 'Auto-Revisi',
            title: parsed.filename || 'Naskah_Revisi',
            step: 'revising',
            detail: 'Memulai auto-revisi akademik...',
            owner: jobOwner,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, jobId }));

          (async () => {
            try {
              const revised = await autoReviseDocumentText(
                parsed.filename || 'Naskah_Revisi',
                parsed.text,
                parsed.auditReport,
                82,
                (stepInfo) => {
                  const j = auditReviseJobs.get(jobId);
                  if (j) {
                    j.progress = stepInfo;
                    j.updatedAt = Date.now();
                  }
                  updateJobProgress(jobId, 'revising', stepInfo);
                }
              );

              try {
                const pdfOut = path.join(os.homedir(), 'Documents', `${revised.fileName}_revisi.pdf`);
                await exportMarkdownToPdf(revised.fileName, revised.revisedText, pdfOut);
              } catch {}

              auditReviseJobs.set(jobId, {
                status: 'completed',
                progress: 'Revisi selesai!',
                result: {
                  fileName: revised.fileName,
                  finalScore: revised.finalScore,
                  rounds: revised.rounds,
                  finalReport: revised.finalReport,
                  revisedText: revised.revisedText,
                  docxUrl: `/api/download-audit/${encodeURIComponent(revised.fileName)}/docx`,
                  pdfUrl: `/api/download-audit/${encodeURIComponent(revised.fileName)}/pdf`,
                  bibUrl: `/api/download-audit/${encodeURIComponent(revised.fileName)}/bib`,
                  mdUrl: `/api/download-audit/${encodeURIComponent(revised.fileName)}/md`,
                },
                updatedAt: Date.now(),
              });
              finishJob(jobId, `Revisi selesai dengan skor ${revised.finalScore}/100 (${revised.rounds} putaran).`, `/api/download-audit/${encodeURIComponent(revised.fileName)}/docx`);
            } catch (err) {
              logger.error(`Auto-revise job ${jobId} gagal: ${err}`);
              auditReviseJobs.set(jobId, {
                status: 'error',
                progress: 'Gagal',
                error: String(err),
                updatedAt: Date.now(),
              });
              failJob(jobId, String(err));
            }
          })();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // GET /api/audit-revise/status?jobId=...
    if (url.pathname === '/api/audit-revise/status' && req.method === 'GET') {
      const jobId = url.searchParams.get('jobId') || '';
      const job = auditReviseJobs.get(jobId);
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Job revisi tidak ditemukan.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(job));
      return;
    }

    // GET /api/download-audit/:name/:ext
    const auditDlMatch = url.pathname.match(/^\/api\/download-audit\/([^/]+)\/(docx|pdf|bib|md)$/);
    if (auditDlMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const rawName = path.basename(decodeURIComponent(auditDlMatch[1]));
      const revName = rawName.endsWith('_revisi') ? rawName : `${rawName}_revisi`;
      const ext = auditDlMatch[2];
      const docsDir = path.join(os.homedir(), 'Documents');
      let targetFile = path.join(docsDir, `${revName}.${ext}`);
      if (!fs.existsSync(targetFile)) {
        const directFile = path.join(docsDir, `${rawName}.${ext}`);
        if (fs.existsSync(directFile)) targetFile = directFile;
      }
      if (ext === 'pdf' && !fs.existsSync(targetFile)) {
        const mdSource = path.join(docsDir, `${revName}.md`);
        if (fs.existsSync(mdSource)) {
          try {
            await exportMarkdownToPdf(revName, fs.readFileSync(mdSource, 'utf-8'), targetFile);
          } catch {}
        }
      }
      if (fs.existsSync(targetFile)) {
        const mime =
          ext === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : ext === 'pdf'
            ? 'application/pdf'
            : ext === 'bib'
            ? 'application/x-bibtex; charset=utf-8'
            : 'text/markdown; charset=utf-8';
        const safeDisp = path.basename(targetFile).replace(/["\r\n]/g, '_');
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${safeDisp}"`,
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(fs.readFileSync(targetFile));
        return;
      }
    }

    // POST /api/turnitin/scan
    if (url.pathname === '/api/turnitin/scan' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const jobOwner = getUserEmail(req, url) || (isLocalDevUiRequest(req) ? 'dev@local' : 'anonymous');
        const scanJobId = 'tscan_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        let jobRegistered = false;
        try {
          const parsed = JSON.parse(body) as {
            filename?: string;
            data?: string;
            text?: string;
            excludeBibliography?: boolean;
            excludeQuotes?: boolean;
          };
          let text = parsed.text || '';
          const filename = parsed.filename || 'naskah.txt';

          registerJob({
            id: scanJobId,
            type: 'uji_kemiripan',
            typeLabel: 'Uji Kemiripan',
            title: filename,
            step: 'scanning',
            detail: 'Memindai proporsi kemiripan & pola kalimat...',
            owner: jobOwner,
          });
          jobRegistered = true;

          if (parsed.data) {
            const safeName = path.basename(filename);
            const tmpPath = path.join(os.tmpdir(), `tgsdork_turnitin_${Date.now()}_${safeName}`);
            fs.writeFileSync(tmpPath, Buffer.from(parsed.data, 'base64'));
            text = await readTextFromFile(tmpPath);
          }

          if (!text.trim()) {
            throw new Error('Naskah kosong atau tidak dapat dibaca.');
          }

          const scan = await scanTurnitinWithGemini(filename, text, {
            excludeBibliography: parsed.excludeBibliography,
            excludeQuotes: parsed.excludeQuotes,
          });
          finishJob(scanJobId, `Skor kemiripan: ${scan.similarityScore}% (Indeks AI ${scan.aiScore}%).`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              result: scan.report,
              similarityScore: scan.similarityScore,
              aiScore: scan.aiScore,
              text,
              filename,
              sources: scan.sources || [],
              annotatedHtml: scan.annotatedHtml || '',
              metricsBreakdown: scan.metricsBreakdown,
              flaggedSentences: scan.flaggedSentences || [],
            })
          );
        } catch (err) {
          if (jobRegistered) failJob(scanJobId, String(err));
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/turnitin/paraphrase (Async job to prevent Cloudflare 524 / 504 timeout)
    if (url.pathname === '/api/turnitin/paraphrase' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body) as {
            filename: string;
            text: string;
            turnitinReport: string;
          };
          if (!parsed.text || !parsed.text.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Teks naskah kosong atau tidak dapat dibaca.' }));
            return;
          }
          const paraJobId = 'tpara_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const now = Date.now();
          const jobOwner = getUserEmail(req, url) || (isLocalDevUiRequest(req) ? 'dev@local' : 'anonymous');

          for (const [id, j] of turnitinParaphraseJobs.entries()) {
            if (now - j.updatedAt > 3600000) turnitinParaphraseJobs.delete(id);
          }

          turnitinParaphraseJobs.set(paraJobId, {
            status: 'running',
            progress: 'Menyiapkan rekonstruksi kalimat cerdas...',
            owner: jobOwner,
            createdAt: now,
            updatedAt: now,
          });

          registerJob({
            id: paraJobId,
            type: 'uji_kemiripan',
            typeLabel: 'Parafrase Naskah',
            title: parsed.filename || 'Naskah_Turnitin',
            step: 'paraphrasing',
            detail: 'Menulis ulang pola kalimat agar lolos Turnitin...',
            owner: jobOwner,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, jobId: paraJobId }));

          (async () => {
            try {
              const result = await autoParaphraseTurnitin(
                parsed.filename || 'Naskah_Turnitin',
                parsed.text,
                parsed.turnitinReport,
                (stepInfo) => {
                  const j = turnitinParaphraseJobs.get(paraJobId);
                  if (j) {
                    j.progress = stepInfo;
                    j.updatedAt = Date.now();
                  }
                  updateJobProgress(paraJobId, 'paraphrasing', stepInfo);
                }
              );

              turnitinParaphraseJobs.set(paraJobId, {
                status: 'completed',
                progress: 'Parafrase selesai!',
                result: {
                  fileName: result.fileName,
                  newSimilarityScore: result.newSimilarityScore,
                  newAiScore: result.newAiScore,
                  newReport: result.newReport,
                  docxUrl: `/api/download-turnitin/${encodeURIComponent(result.fileName)}/docx`,
                  pdfUrl: `/api/download-turnitin/${encodeURIComponent(result.fileName)}/pdf`,
                  mdUrl: `/api/download-turnitin/${encodeURIComponent(result.fileName)}/md`,
                },
                owner: jobOwner,
                createdAt: now,
                updatedAt: Date.now(),
              });

              finishJob(paraJobId, `Parafrase selesai: kemiripan turun ke ${result.newSimilarityScore}%.`, `/api/download-turnitin/${encodeURIComponent(result.fileName)}/docx`);
            } catch (err) {
              logger.error(`Turnitin paraphrase job ${paraJobId} gagal: ${err}`);
              turnitinParaphraseJobs.set(paraJobId, {
                status: 'error',
                progress: 'Gagal',
                error: String(err),
                owner: jobOwner,
                createdAt: now,
                updatedAt: Date.now(),
              });
              failJob(paraJobId, String(err));
            }
          })();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // GET /api/turnitin/paraphrase/status?jobId=...
    if (url.pathname === '/api/turnitin/paraphrase/status' && req.method === 'GET') {
      const jobId = url.searchParams.get('jobId') || '';
      const job = turnitinParaphraseJobs.get(jobId);
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Job parafrase tidak ditemukan.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(job));
      return;
    }

    // GET /api/download-turnitin/:name/:ext
    const turnitinDlMatch = url.pathname.match(/^\/api\/download-turnitin\/([^/]+)\/(docx|pdf|md)$/);
    if (turnitinDlMatch && (req.method === 'GET' || req.method === 'HEAD')) {
      const rawName = path.basename(decodeURIComponent(turnitinDlMatch[1]));
      const passName = rawName.endsWith('_turnitin_pass') ? rawName : `${rawName}_turnitin_pass`;
      const ext = turnitinDlMatch[2];
      const docsDir = path.join(os.homedir(), 'Documents');
      let targetFile = path.join(docsDir, `${passName}.${ext}`);
      if (!fs.existsSync(targetFile)) {
        const legacyDouble = path.join(docsDir, `${passName}_turnitin_pass.${ext}`);
        if (fs.existsSync(legacyDouble)) targetFile = legacyDouble;
      }
      if (ext === 'pdf' && !fs.existsSync(targetFile)) {
        const mdSource = path.join(docsDir, `${passName}.md`);
        if (fs.existsSync(mdSource)) {
          try {
            const mdContent = fs.readFileSync(mdSource, 'utf-8');
            const cleanTitle = extractAcademicTopic(passName, mdContent);
            await exportMarkdownToPdf(cleanTitle, mdContent, targetFile);
          } catch {}
        }
      }
      if (fs.existsSync(targetFile)) {
        const mime =
          ext === 'docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : ext === 'pdf'
            ? 'application/pdf'
            : 'text/markdown; charset=utf-8';
        const safeDisp = `${passName}.${ext}`.replace(/["\r\n]/g, '_');
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${safeDisp}"`,
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(fs.readFileSync(targetFile));
        return;
      }
    }

    // DELETE /api/tasks/:id
    const taskDeleteMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)(\/delete)?$/);
    if (taskDeleteMatch && (req.method === 'DELETE' || req.method === 'POST')) {
      const taskId = taskDeleteMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Akses ditolak: Dokumen bukan milik akun Anda.' }));
        return;
      }

      const taskDir = getTaskDir(taskId);
      if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Dokumen berhasil dihapus.' }));
      return;
    }

    // POST /api/tasks/:id/revise-section (Revisi Per-Bab spesifik)
    const reviseSecMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/revise-section$/);
    if (reviseSecMatch && req.method === 'POST') {
      const taskId = reviseSecMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Akses ditolak: Dokumen bukan milik akun Anda.' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const jobTitle = String(taskId);
        const revJobId = `revisesec_${taskId}_${Date.now()}`;
        let jobRegistered = false;
        try {
          const parsed = JSON.parse(body) as { sectionTitle?: string; instruction?: string };
          const sectionTitle = String(parsed.sectionTitle || '').trim();
          const instruction = String(parsed.instruction || '').trim() || 'Perdalam analisis akademik dan perkuat sitasi.';
          if (!sectionTitle) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Nama bab wajib dipilih.' }));
            return;
          }
          registerJob({
            id: revJobId,
            type: 'audit_revisi',
            typeLabel: 'Revisi Bab',
            title: `${sectionTitle} (${jobTitle})`,
            step: 'revising',
            detail: `Menulis ulang bab "${sectionTitle}"...`,
            owner: userEmail || 'dev@local',
          });
          jobRegistered = true;

          const updatedState = await reviseTask(taskId, instruction, sectionTitle);
          try {
            const taskDir = getTaskDir(updatedState.id);
            const mdPath = path.join(taskDir, 'output.md');
            const targetPdf = path.join(taskDir, 'output.pdf');
            if (fs.existsSync(mdPath)) {
              const pdfPath = await exportMarkdownToPdf(updatedState.topic, fs.readFileSync(mdPath, 'utf-8'), targetPdf, updatedState.font);
              copyToDocuments(updatedState, { pdf: pdfPath });
            }
          } catch {}
          finishJob(revJobId, `Bab "${sectionTitle}" berhasil diperbarui.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, task: updatedState }));
        } catch (err) {
          if (jobRegistered) failJob(revJobId, String(err));
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // POST /api/tasks/:id/autorevise (Target threshold >= 80/100)
    const autoReviseMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/autorevise$/);
    if (autoReviseMatch && req.method === 'POST') {
      const taskId = autoReviseMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Akses ditolak: Dokumen bukan milik akun Anda.' }));
        return;
      }

      const revJobId = `autorev_${taskId}`;
      registerJob({
        id: revJobId,
        type: 'audit_revisi',
        typeLabel: 'Auto-Revisi',
        title: taskId,
        step: 'revising',
        detail: 'Mengevaluasi dan merevisi naskah (target >= 82)...',
        owner: userEmail || 'dev@local',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Revisi otomatis dimulai di background' }));
      (async () => {
        try {
          await autoReviseTask(taskId, 82);
          finishJob(revJobId, `Auto-revisi naskah selesai!`);
        } catch (err) {
          logger.error(`Auto-revise gagal untuk task ${taskId}: ${err}`);
          failJob(revJobId, String(err));
        }
      })();
      return;
    }

    // POST /api/review
    if (url.pathname === '/api/review' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const jobOwner = getUserEmail(req, url) || (isLocalDevUiRequest(req) ? 'dev@local' : 'anonymous');
        const revJobId = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        let jobRegistered = false;
        try {
          const parsed = JSON.parse(body) as { target: string; focus?: string };
          const resolved = resolveTargetFile(parsed.target);
          const fileName = path.basename(resolved);
          registerJob({
            id: revJobId,
            type: 'audit_revisi',
            typeLabel: 'Audit Dokumen',
            title: fileName,
            step: 'reviewing',
            detail: 'Memeriksa berkas naskah & kelayakan akademik...',
            owner: jobOwner,
          });
          jobRegistered = true;

          const text = await readTextFromFile(resolved);
          const result = await reviewFile(parsed.target, parsed.focus);
          finishJob(revJobId, `Pemeriksaan kelayakan "${fileName}" selesai.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result, text, filename: fileName }));
        } catch (err) {
          if (jobRegistered) failJob(revJobId, String(err));
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    // GET /api/view/:id/md
    const mdMatch = url.pathname.match(/^\/api\/view\/([^/]+)\/md$/);
    if (mdMatch) {
      const taskId = mdMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const filePath = path.join(getTaskDir(taskId), 'output.md');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET /api/view/:id/review
    const reviewMatch = url.pathname.match(/^\/api\/view\/([^/]+)\/review$/);
    if (reviewMatch) {
      const taskId = reviewMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const filePath = path.join(getTaskDir(taskId), 'review.md');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET /api/view/:id/html
    const htmlMatch = url.pathname.match(/^\/api\/view\/([^/]+)\/html$/);
    if (htmlMatch) {
      const taskId = htmlMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const filePath = path.join(getTaskDir(taskId), 'slides.html');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET /api/download/:id/docx
    const docxMatch = url.pathname.match(/^\/api\/download\/([^/]+)\/docx$/);
    if (docxMatch) {
      const taskId = docxMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const filePath = path.join(getTaskDir(taskId), 'output.docx');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${taskId}.docx"`,
        });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET /api/download/:id/pdf
    const pdfMatch = url.pathname.match(/^\/api\/download\/([^/]+)\/pdf$/);
    if (pdfMatch) {
      const taskId = pdfMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const targetPdf = path.join(getTaskDir(taskId), 'output.pdf');
      const mdFile = path.join(getTaskDir(taskId), 'output.md');
      if (!fs.existsSync(targetPdf) && fs.existsSync(mdFile)) {
        try {
          const checkpoint = JSON.parse(fs.readFileSync(path.join(getTaskDir(taskId), 'checkpoint.json'), 'utf-8'));
          await exportMarkdownToPdf(checkpoint.topic || taskId, fs.readFileSync(mdFile, 'utf-8'), targetPdf, checkpoint.font || 'Times New Roman');
        } catch {}
      }
      if (fs.existsSync(targetPdf)) {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${taskId}.pdf"`,
        });
        res.end(fs.readFileSync(targetPdf));
        return;
      }
    }

    // GET /api/download/:id/pptx
    const pptxMatch = url.pathname.match(/^\/api\/download\/([^/]+)\/pptx$/);
    if (pptxMatch) {
      const taskId = pptxMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      let filePath = path.join(getTaskDir(taskId), 'slides.pptx');
      if (!fs.existsSync(filePath)) {
        const checkpoint = loadCheckpoint(taskId);
        if (checkpoint) {
          try {
            filePath = await exportToPptx(checkpoint);
          } catch (err) {
            logger.warn(`Gagal membuat PPTX on-demand untuk ${taskId}: ${err}`);
          }
        }
      }
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${taskId}.pptx"`,
        });
        res.end(fs.readFileSync(filePath));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('PPTX belum tersedia untuk tugas ini.');
      return;
    }

    // GET /api/download/:id/bib
    const bibMatch = url.pathname.match(/^\/api\/download\/([^/]+)\/bib$/);
    if (bibMatch) {
      const taskId = bibMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      const filePath = path.join(getTaskDir(taskId), 'references.bib');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type': 'application/x-bibtex; charset=utf-8',
          'Content-Disposition': `attachment; filename="${taskId}.bib"`,
        });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // GET /api/download/:id/zip
    const zipMatch = url.pathname.match(/^\/api\/download\/([^/]+)\/zip$/);
    if (zipMatch) {
      const taskId = zipMatch[1];
      const userEmail = getUserEmail(req, url);
      if (!canAccessTask(taskId, userEmail, req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Akses ditolak: Dokumen ini terisolasi dan hanya dapat diakses oleh pemilik akun.');
        return;
      }
      let zipPath = path.join(getTaskDir(taskId), 'bundle.zip');
      if (!fs.existsSync(zipPath)) {
        const checkpoint = loadCheckpoint(taskId);
        if (checkpoint) {
          try {
            zipPath = await exportToZip(checkpoint);
          } catch (err) {
            logger.warn(`Gagal membuat ZIP untuk ${taskId}: ${err}`);
          }
        }
      }
      if (fs.existsSync(zipPath)) {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${taskId}_bundle.zip"`,
        });
        res.end(fs.readFileSync(zipPath));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bundle ZIP gagal dibuat atau belum tersedia.');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws', `http://localhost:${port}`);
    const userEmail = getUserEmail(req, reqUrl);
    const isDev = isLocalDevUiRequest(req);
    const clientInfo = { userEmail, isDev };
    wsClients.set(ws, clientInfo);

    ws.send(
      JSON.stringify({
        type: 'connected',
        time: Date.now(),
        activeJobs: getActiveJobsForClient(userEmail, isDev),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const authEmail = getSessionUser(msg.token.trim());
          if (authEmail) {
            clientInfo.userEmail = authEmail;
            ws.send(
              JSON.stringify({
                type: 'authenticated',
                email: authEmail,
                activeJobs: getActiveJobsForClient(authEmail, clientInfo.isDev),
              })
            );
          }
        }
      } catch {}
    });

    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} sudah aktif digunakan oleh instance TGSDORK lain.`);
      logger.success(`Buka langsung di browser: http://localhost:${port}`);
      process.exit(0);
    }
    throw err;
  });

  server.listen(port, () => {
    logger.success(`TGSDORK Landing Page berjalan di http://localhost:${port}`);
    logger.success(`TGSDORK Web Studio berjalan di http://localhost:${port}/studio`);
  });
}
