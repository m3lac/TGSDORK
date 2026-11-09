import fs from 'node:fs';
import path from 'node:path';
import PptxGenJSImport from 'pptxgenjs';
import { getTaskDir } from '../core/checkpoint.js';
import { generateText } from '../ai/client.js';
import { logger } from '../core/logger.js';
import { searchLocalJournals } from '../dorker/local-journal.js';
import JSZip from 'jszip';
import type { TaskState } from '../types/index.js';

// ponytail: dts pptxgenjs 4.x nge-export namespace, bukan konstruktor — cast di satu titik
const PptxGenJS: any = PptxGenJSImport;

type Layout = 'title' | 'section' | 'bullets' | 'two-col' | 'stats' | 'quote' | 'refs' | 'closing';

export interface CardItem {
  title?: string;
  desc: string;
}

export interface RefItem {
  text: string;
  url?: string;
}

export interface AiSlide {
  layout?: Layout;
  title?: string;
  subtitle?: string;
  cards?: CardItem[];
  bullets?: (string | { text: string; level?: number })[];
  columns?: { heading: string; bullets?: string[]; cards?: CardItem[] }[];
  stats?: { label: string; value: string; desc?: string }[];
  quote?: string;
  refs?: RefItem[];
  notes?: string;
}

export interface ThemeColors {
  name: string;
  bg: string;
  card: string;
  cardEdge: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  titleFont?: string;
  bodyFont?: string;
  lightMode?: boolean;
}

export const THEMES: Record<string, ThemeColors> = {
  // 1. Canva Editorial Minimalist (Pinterest Trend: Linen, Terracotta & Sage)
  'canva-editorial': {
    name: 'canva-editorial',
    bg: 'FAF7F2',
    card: 'FFFFFF',
    cardEdge: 'E8E1D5',
    accent: 'C2593F',   // Terracotta / Burnt Sienna
    accent2: '4A5D4E',  // Sage Green
    text: '1F2421',     // Deep Charcoal
    muted: '6B7280',    // Soft Slate Gray
    titleFont: 'Georgia',
    bodyFont: 'Calibri',
    lightMode: true,
  },
  // 2. Canva Modern Bento Dark (Midnight Indigo, Neon Cyan & Electric Purple)
  'canva-indigo': {
    name: 'canva-indigo',
    bg: '0B0F19',
    card: '131B2E',
    cardEdge: '22314E',
    accent: '6366F1',   // Electric Indigo
    accent2: '06B6D4',  // Neon Cyan
    text: 'F8FAFC',     // Crisp White
    muted: '94A3B8',     // Cool Slate
    titleFont: 'Segoe UI',
    bodyFont: 'Segoe UI',
    lightMode: false,
  },
  // 3. Canva Pure White Minimalist (Clean Slate, Royal Violet & Cobalt)
  'canva-minimal-light': {
    name: 'canva-minimal-light',
    bg: 'FFFFFF',
    card: 'F8FAFC',
    cardEdge: 'E2E8F0',
    accent: '7C3AED',   // Royal Violet
    accent2: '2563EB',  // Cobalt Blue
    text: '0F172A',     // Slate Noir
    muted: '64748B',    // Steel Gray
    titleFont: 'Segoe UI',
    bodyFont: 'Calibri',
    lightMode: true,
  },
  // 4. Pinterest Botanical / Nature (Forest Noir & Vivid Mint)
  nature: {
    name: 'nature',
    bg: '081711',
    card: '0E2A1E',
    cardEdge: '1C4834',
    accent: '10B981',   // Vivid Mint
    accent2: 'F59E0B',  // Warm Amber
    text: 'F0FDF4',     // Mint White
    muted: '86EFAC',    // Soft Leaf
    titleFont: 'Segoe UI',
    bodyFont: 'Calibri',
    lightMode: false,
  },
  // 5. Pinterest Aesthetic Rose / Warm (Mulled Berry Noir & Coral Rose)
  warm: {
    name: 'warm',
    bg: '140C10',
    card: '22141C',
    cardEdge: '3E2232',
    accent: 'F43F5E',   // Coral Rose
    accent2: 'EAB308',  // Golden Ochre
    text: 'FFF1F2',     // Rose White
    muted: 'FDA4AF',    // Soft Blush
    titleFont: 'Georgia',
    bodyFont: 'Calibri',
    lightMode: false,
  },
  // Aliases for backward compatibility
  tech: {
    name: 'canva-indigo',
    bg: '0B0F19',
    card: '131B2E',
    cardEdge: '22314E',
    accent: '6366F1',
    accent2: '06B6D4',
    text: 'F8FAFC',
    muted: '94A3B8',
    titleFont: 'Segoe UI',
    bodyFont: 'Segoe UI',
    lightMode: false,
  },
  corporate: {
    name: 'canva-editorial',
    bg: 'FAF7F2',
    card: 'FFFFFF',
    cardEdge: 'E8E1D5',
    accent: 'C2593F',
    accent2: '4A5D4E',
    text: '1F2421',
    muted: '6B7280',
    titleFont: 'Georgia',
    bodyFont: 'Calibri',
    lightMode: true,
  },
  industrial: {
    name: 'canva-minimal-light',
    bg: 'FFFFFF',
    card: 'F8FAFC',
    cardEdge: 'E2E8F0',
    accent: 'EA580C',
    accent2: '4F46E5',
    text: '0F172A',
    muted: '64748B',
    titleFont: 'Segoe UI',
    bodyFont: 'Calibri',
    lightMode: true,
  },
};

export function pickTheme(topic: string): ThemeColors {
  const t = topic.toLowerCase();
  if (/\b(ai|kecerdasan|data|software|sistem|algoritma|jaringan|cyber|komputer|digital|robot|cloud|web|iot)\b/.test(t)) {
    return THEMES.tech;
  }
  if (/\b(lingkungan|ekologi|tani|pertanian|hutan|tanaman|medis|kesehatan|biologi|protein|obat|klinis|iklim)\b/.test(t)) {
    return THEMES.nature;
  }
  if (/\b(ekonomi|keuangan|bisnis|manajemen|hukum|pasar|saham|bank|pajak|akuntansi|investasi|perdagangan)\b/.test(t)) {
    return THEMES.corporate;
  }
  if (/\b(sosial|budaya|psikologi|film|seni|pendidikan|filsafat|manusia|karakter|komunikasi|sastra)\b/.test(t)) {
    return THEMES.warm;
  }
  if (/\b(energi|pabrik|manufaktur|mesin|industri|transportasi|logistik|rantai|otomotif|konstruksi)\b/.test(t)) {
    return THEMES.industrial;
  }
  return THEMES.tech;
}

export interface Deck {
  title?: string;
  subtitle?: string;
  theme?: string;
  refs?: RefItem[];
  slides: AiSlide[];
}

// GEOMETRI: 13.333 x 7.5 (LAYOUT_WIDE standar 16:9)
const W = 13.333;
const H = 7.5;
const M = 0.62;
const RIGHT = W - M;
const CONTENT_W = RIGHT - M;

const T = (extra: Record<string, unknown> = {}, font = 'Segoe UI') => ({
  fontFace: font,
  margin: 0,
  fit: 'shrink',
  valign: 'top',
  ...extra,
});

function bg(slide: any, pptx: any, c: ThemeColors) {
  slide.background = { color: c.bg };
  if (c.lightMode) {
    // Pinterest / Canva Editorial organic soft backdrop
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 9.8,
      y: -2.0,
      w: 6.2,
      h: 6.2,
      fill: { color: c.accent, transparency: 94 },
      line: { color: c.accent, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -2.0,
      y: 4.8,
      w: 5.2,
      h: 5.2,
      fill: { color: c.accent2, transparency: 92 },
      line: { color: c.accent2, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: c.accent } });
  } else {
    // Canva Modern Dark / Midnight Bento
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 10.2,
      y: -2.6,
      w: 5.6,
      h: 5.6,
      fill: { color: c.accent2, transparency: 88 },
      line: { color: c.accent2, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -2.2,
      y: 5.4,
      w: 4.4,
      h: 4.4,
      fill: { color: c.accent, transparency: 93 },
      line: { color: c.accent, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: c.accent } });
  }
}

function footer(slide: any, topic: string, page: number, c: ThemeColors) {
  const bFont = c.bodyFont || 'Calibri';
  slide.addShape('rect', { x: M, y: 6.86, w: CONTENT_W, h: 0.014, fill: { color: c.cardEdge } });
  slide.addText(
    topic.slice(0, 74).toUpperCase(),
    T({ x: M, y: 7.0, w: CONTENT_W - 1.5, h: 0.3, fontSize: 9, color: c.muted, charSpacing: 0.8, bold: true }, bFont)
  );
  slide.addText(
    `SLIDE ${String(page).padStart(2, '0')}`,
    T({ x: RIGHT - 1.4, y: 7.0, w: 1.4, h: 0.3, fontSize: 9, color: c.accent, charSpacing: 1.0, bold: true, align: 'right' }, bFont)
  );
}

function heading(slide: any, pptx: any, title: string, num: number | undefined, c: ThemeColors) {
  const tFont = c.titleFont || 'Segoe UI';
  const bFont = c.bodyFont || 'Calibri';

  // Canva / Pinterest Category Pill Tag
  slide.addShape(pptx.ShapeType.roundRect, {
    x: M,
    y: 0.45,
    w: 2.3,
    h: 0.32,
    fill: { color: c.accent, transparency: c.lightMode ? 85 : 80 },
    line: { color: c.accent, width: 1 },
    rectRadius: 0.16,
  });
  slide.addText(
    '✦ ACADEMIC FOCUS ✦',
    T(
      {
        x: M,
        y: 0.45,
        w: 2.3,
        h: 0.32,
        fontSize: 9,
        bold: true,
        color: c.accent,
        align: 'center',
        valign: 'middle',
        charSpacing: 1.0,
      },
      bFont
    )
  );

  let x0 = M;
  if (num !== undefined) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: M,
      y: 0.88,
      w: 0.54,
      h: 0.54,
      fill: { color: c.accent },
      line: { color: c.accent2, width: 1 },
      rectRadius: 0.12,
    });
    slide.addText(
      String(num).padStart(2, '0'),
      T(
        {
          x: M,
          y: 0.88,
          w: 0.54,
          h: 0.54,
          fontSize: 14,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
          valign: 'middle',
        },
        tFont
      )
    );
    x0 = M + 0.74;
  }

  slide.addText(
    title,
    T(
      {
        x: x0,
        y: 0.85,
        w: RIGHT - x0,
        h: 0.65,
        fontSize: 23,
        bold: true,
        color: c.text,
        valign: 'middle',
      },
      tFont
    )
  );

  slide.addShape(pptx.ShapeType.rect, {
    x: x0,
    y: 1.54,
    w: 1.8,
    h: 0.045,
    fill: { color: c.accent },
  });
}

function applyTransitions(pptxPath: string): Promise<void> {
  // ponytail: patch OOXML langsung pakai JSZip — tambah slide transition wipe/fade di setiap slide
  return (async () => {
    try {
      const buf = fs.readFileSync(pptxPath);
      const zip = await JSZip.loadAsync(buf);
      const slideFiles = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));
      let patched = 0;
      for (const f of slideFiles) {
        const xml = await zip.files[f].async('text');
        // jika belum ada <p:transition>, sisipkan sebelum penutup </p:sld>
        if (!xml.includes('<p:transition') && xml.includes('</p:sld>')) {
          const transTag = '<p:transition spd="med"><p:wipe dir="r"/></p:transition></p:sld>';
          zip.file(f, xml.replace('</p:sld>', transTag));
          patched += 1;
        }
      }
      if (patched > 0) {
        const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        fs.writeFileSync(pptxPath, outBuf);
      }
    } catch (err) {
      logger.warn(`Gagal menambahkan animasi transisi: ${err}`);
    }
  })();
}

function normalizeCards(s: AiSlide): CardItem[] {
  if (Array.isArray(s.cards) && s.cards.length > 0) {
    return s.cards.map((c) => ({
      title: c.title?.trim() || undefined,
      desc: (c.desc || '').trim(),
    })).filter((c) => c.desc.length > 0);
  }
  const rawBullets = s.bullets ?? [];
  return rawBullets.map((b) => {
    const raw = typeof b === 'string' ? b : b.text ?? '';
    const clean = raw.replace(/^[-*•·]\s*/, '').trim();
    // Jika bullet memakai format "Judul: Penjelasan", pisahkan
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 2 && colonIdx < 35) {
      return {
        title: clean.slice(0, colonIdx).trim(),
        desc: clean.slice(colonIdx + 1).trim(),
      };
    }
    return { desc: clean };
  }).filter((c) => c.desc.length > 0);
}

function bulletRuns(items: (string | { text: string; level?: number })[], size: number, max = 7, c?: ThemeColors) {
  const textCol = c?.text || 'E6F1FC';
  const mutedCol = c?.muted || '8BA2BE';
  const bFont = c?.bodyFont || 'Calibri';
  return items.slice(0, max).map((b) => {
    const text = typeof b === 'string' ? b : b.text ?? '';
    const level = typeof b === 'string' ? 0 : b.level ?? 0;
    return {
      text: text.replace(/^[-*•·]\s*/, '').trim(),
      options: {
        fontFace: bFont,
        bullet: { characterCode: '25AA', indent: level === 0 ? 14 : 26 },
        indentLevel: level,
        fontSize: level === 0 ? size : size - 2,
        color: level === 0 ? textCol : mutedCol,
        breakLine: true,
        paraSpaceAfter: level === 0 ? 9 : 4,
      },
    };
  });
}

export async function renderPptx(deck: Deck, outPath: string, topic: string, animate = false): Promise<string> {
  const pptx = new PptxGenJS();
  // ponytail: geometri semua kotak dihitung utk 13.33x7.5 — LAYOUT_WIDE, bukan 16x9 (10x5.625)
  pptx.layout = 'LAYOUT_WIDE';
  const slides: AiSlide[] = deck.slides.length > 0 ? deck.slides : [{ layout: 'title', title: topic }];
  if (slides[0].layout !== 'title') slides.unshift({ layout: 'title', title: deck.title || topic, subtitle: deck.subtitle });
  const theme = (deck.theme && THEMES[deck.theme]) ? THEMES[deck.theme] : pickTheme(`${deck.title || ''} ${topic}`);
  const c = theme;
  const tFont = c.titleFont || 'Segoe UI';
  const bFont = c.bodyFont || 'Calibri';
  const headingColor = c.lightMode ? c.text : 'FFFFFF';

  let page = 0;
  slides.forEach((s) => {
    const slide = pptx.addSlide();
    const layout: Layout = s.layout ?? 'bullets';
    const title = (s.title || topic).trim();
    bg(slide, pptx, c);
    if (layout !== 'title' && layout !== 'closing' && layout !== 'quote') page += 1;

    if (layout === 'title') {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: c.accent } });
      // Canva / Pinterest cover pill badge
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 1.35,
        y: 1.25,
        w: 2.8,
        h: 0.36,
        fill: { color: c.accent, transparency: c.lightMode ? 86 : 80 },
        line: { color: c.accent, width: 1 },
        rectRadius: 0.18,
      });
      slide.addText(
        '✦ EDITORIAL PRESENTATION ✦',
        T({ x: 1.35, y: 1.25, w: 2.8, h: 0.36, fontSize: 9, bold: true, color: c.accent, align: 'center', valign: 'middle', charSpacing: 1.2 }, bFont)
      );

      slide.addText(title, T({ x: 1.35, y: 1.85, w: 7.8, h: 2.3, fontSize: 34, bold: true, color: headingColor, valign: 'middle', lineSpacingMultiple: 1.15 }, tFont));
      slide.addShape(pptx.ShapeType.rect, { x: 1.38, y: 4.3, w: 1.8, h: 0.055, fill: { color: c.accent } });
      slide.addText(s.subtitle || 'Paparan Akademik Terstruktur', T({ x: 1.38, y: 4.52, w: 7.7, h: 0.65, fontSize: 16, bold: true, color: c.accent2, valign: 'top' }, bFont));

      // Floating Bento summary card (right)
      slide.addShape(pptx.ShapeType.roundRect, { x: 9.55, y: 1.85, w: 3.05, h: 3.9, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.14 });
      slide.addShape(pptx.ShapeType.rect, { x: 9.9, y: 2.25, w: 0.65, h: 0.05, fill: { color: c.accent } });
      slide.addText('RINGKASAN DEK', T({ x: 9.9, y: 2.42, w: 2.35, h: 0.3, fontSize: 9.5, bold: true, color: c.accent, charSpacing: 1.2 }, bFont));
      slide.addText('Disusun dengan tata letak editorial modern berbasis literatur ilmiah terstruktur.', T({ x: 9.9, y: 2.85, w: 2.35, h: 1.35, fontSize: 11.5, color: c.text, lineSpacingMultiple: 1.3 }, bFont));
      slide.addShape(pptx.ShapeType.roundRect, { x: 9.9, y: 4.55, w: 2.35, h: 0.82, fill: { color: c.bg }, line: { color: c.cardEdge, width: 1 }, rectRadius: 0.1 });
      slide.addText(`${slides.length} SLIDE · ${c.name.toUpperCase()}`, T({ x: 9.95, y: 4.82, w: 2.25, h: 0.3, fontSize: 9, bold: true, color: c.accent, align: 'center', valign: 'middle', charSpacing: 0.8 }, bFont));

      slide.addShape(pptx.ShapeType.roundRect, { x: 1.38, y: 6.22, w: 3.6, h: 0.52, fill: { color: c.card }, line: { color: c.cardEdge, width: 1 }, rectRadius: 0.12 });
      slide.addText('TGSDORK · STUDIO AKADEMIK', T({ x: 1.58, y: 6.33, w: 3.2, h: 0.3, fontSize: 9.5, color: c.muted, charSpacing: 1.2, bold: true, valign: 'middle' }, bFont));
    } else if (layout === 'section') {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: c.accent } });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 1.15,
        y: 1.85,
        w: 1.9,
        h: 0.34,
        fill: { color: c.accent, transparency: c.lightMode ? 86 : 80 },
        line: { color: c.accent, width: 1 },
        rectRadius: 0.17,
      });
      slide.addText(`BAGIAN ${String(page).padStart(2, '0')}`, T({ x: 1.15, y: 1.85, w: 1.9, h: 0.34, fontSize: 9.5, bold: true, color: c.accent, align: 'center', valign: 'middle', charSpacing: 1.1 }, bFont));
      slide.addText(String(page).padStart(2, '0'), T({ x: 1.1, y: 2.3, w: 3.2, h: 1.35, fontSize: 68, bold: true, color: c.accent, valign: 'middle' }, tFont));
      slide.addText(title, T({ x: 1.15, y: 3.72, w: RIGHT - 1.4, h: 1.1, fontSize: 31, bold: true, color: headingColor }, tFont));
      slide.addShape(pptx.ShapeType.rect, { x: 1.18, y: 4.9, w: 1.5, h: 0.05, fill: { color: c.accent2 } });
      if (s.subtitle) slide.addText(s.subtitle, T({ x: 1.18, y: 5.1, w: RIGHT - 1.6, h: 0.6, fontSize: 15, color: c.muted }, bFont));
    } else if (layout === 'stats') {
      heading(slide, pptx, title, page, c);
      const stats = (s.stats ?? []).slice(0, 3);
      const n = Math.max(1, stats.length);
      const gap = 0.34;
      const cw = (CONTENT_W - gap * (n - 1)) / n;
      const hasBullets = Boolean(s.bullets?.length);
      const ch = hasBullets ? 2.55 : 3.35;
      const startY = hasBullets ? 1.92 : 2.35;

      stats.forEach((st, idx) => {
        const x = M + idx * (cw + gap);
        slide.addShape(pptx.ShapeType.roundRect, { x, y: startY, w: cw, h: ch, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.12 });
        slide.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: startY + 0.22, w: 0.7, h: 0.05, fill: { color: idx % 2 === 0 ? c.accent : c.accent2 } });
        slide.addText((st.value || '—').slice(0, 12), T({ x, y: startY + 0.38, w: cw, h: 1.2, fontSize: 48, bold: true, color: idx % 2 === 0 ? c.accent : c.accent2, align: 'center', valign: 'middle' }, tFont));
        slide.addText((st.label || '').slice(0, 90), T({ x: x + 0.28, y: startY + 1.62, w: cw - 0.56, h: 0.75, fontSize: 14.5, bold: true, color: headingColor, align: 'center', valign: 'top', lineSpacingMultiple: 1.2 }, tFont));
        if (st.desc) slide.addText(st.desc.slice(0, 150), T({ x: x + 0.28, y: startY + 2.38, w: cw - 0.56, h: ch - 2.5, fontSize: 11.5, color: c.muted, align: 'center', valign: 'top', lineSpacingMultiple: 1.25 }, bFont));
      });
      if (s.bullets?.length) {
        slide.addText(bulletRuns(s.bullets, 13.5, 4, c), T({ x: M, y: startY + ch + 0.28, w: CONTENT_W, h: 1.5, lineSpacingMultiple: 1.2 }, bFont));
      }
      footer(slide, topic, page, c);
    } else if (layout === 'two-col') {
      heading(slide, pptx, title, page, c);
      const cols = (s.columns ?? []).slice(0, 2);
      const gap = 0.34;
      const cw = (CONTENT_W - gap) / 2;
      cols.forEach((col, idx) => {
        const x = M + idx * (cw + gap);
        const colAccent = idx === 0 ? c.accent : c.accent2;
        const colCards = col.cards && col.cards.length > 0 ? col.cards : undefined;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.88, w: cw, h: 4.55, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.12 });
        slide.addShape(pptx.ShapeType.rect, { x: x + 0.36, y: 2.12, w: 0.65, h: 0.05, fill: { color: colAccent } });
        slide.addText((col.heading || '').slice(0, 60), T({ x: x + 0.36, y: 2.26, w: cw - 0.72, h: 0.46, fontSize: 17, bold: true, color: colAccent }, tFont));
        if (colCards) {
          // ponytail: satu text box mengalir (runs) per kolom supaya judul & deskripsi tidak pernah tabrakan y-offset
          const runs: any[] = [];
          colCards.slice(0, 3).forEach((card) => {
            if (card.title) {
              runs.push({ text: card.title.slice(0, 52), options: { fontFace: tFont, bold: true, fontSize: 13.5, color: headingColor, breakLine: true, paraSpaceAfter: 3 } });
              runs.push({ text: card.desc.slice(0, 170), options: { fontFace: bFont, fontSize: 12, color: c.text, lineSpacingMultiple: 1.25, breakLine: true, paraSpaceAfter: 13 } });
            } else {
              runs.push({ text: card.desc.slice(0, 170), options: { fontFace: bFont, fontSize: 13, color: c.text, lineSpacingMultiple: 1.25, breakLine: true, paraSpaceAfter: 10 } });
            }
          });
          slide.addText(runs, T({ x: x + 0.36, y: 2.82, w: cw - 0.72, h: 3.45, valign: 'top' }, bFont));
        } else {
          slide.addText(bulletRuns(col.bullets ?? [], 14, 6, c), T({ x: x + 0.36, y: 2.78, w: cw - 0.72, h: 3.45, lineSpacingMultiple: 1.25, valign: 'top' }, bFont));
        }
      });
      if (s.subtitle) slide.addText(s.subtitle, T({ x: M, y: 6.5, w: CONTENT_W, h: 0.3, fontSize: 11, color: c.muted }, bFont));
      footer(slide, topic, page, c);
    } else if (layout === 'quote') {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: H, fill: { color: c.accent } });
      slide.addShape(pptx.ShapeType.roundRect, { x: 1.35, y: 1.65, w: CONTENT_W - 0.7, h: 4.35, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.14 });
      slide.addText('“', T({ x: 1.8, y: 1.8, w: 1.2, h: 1.0, fontSize: 64, bold: true, color: c.accent }, 'Georgia'));
      slide.addText((s.quote || title).trim(), T({ x: 1.9, y: 2.55, w: CONTENT_W - 1.8, h: 1.9, fontSize: 23, italic: true, bold: true, color: headingColor, lineSpacingMultiple: 1.35, valign: 'middle' }, tFont));
      slide.addShape(pptx.ShapeType.rect, { x: 1.9, y: 4.75, w: 1.5, h: 0.045, fill: { color: c.accent2 } });
      if (s.subtitle) slide.addText(s.subtitle, T({ x: 1.9, y: 4.95, w: CONTENT_W - 1.8, h: 0.5, fontSize: 13, bold: true, color: c.muted }, bFont));
    } else if (layout === 'refs') {
      heading(slide, pptx, title || 'Daftar Referensi', page, c);
      const refs = (s.refs ?? []).slice(0, 8);
      const rows = refs.length || 1;
      const rowH = Math.min(0.72, 4.4 / rows);
      refs.forEach((r, idx) => {
        const y = 1.92 + idx * rowH;
        slide.addShape(pptx.ShapeType.roundRect, { x: M, y: y + 0.03, w: 0.38, h: 0.38, fill: { color: c.card }, line: { color: c.accent, width: 1 }, rectRadius: 0.08 });
        slide.addText(String(idx + 1).padStart(2, '0'), T({ x: M, y: y + 0.03, w: 0.38, h: 0.38, fontSize: 10.5, bold: true, color: c.accent, align: 'center', valign: 'middle' }, tFont));
        slide.addText(r.text.slice(0, 220), T({ x: M + 0.52, y, w: CONTENT_W - 0.52, h: rowH - 0.06, fontSize: 11.5, color: c.text, lineSpacingMultiple: 1.2, valign: 'top' }, bFont));
        if (r.url) {
          slide.addText(r.url.slice(0, 85), T({ x: M + 0.52, y: y + rowH - 0.23, w: CONTENT_W - 0.52, h: 0.22, fontSize: 9, color: c.accent2 }, bFont));
        }
      });
      footer(slide, topic, page, c);
    } else if (layout === 'closing') {
      slide.addShape(pptx.ShapeType.roundRect, { x: (W - 9.4) / 2, y: 1.65, w: 9.4, h: 4.45, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.16 });
      slide.addShape(pptx.ShapeType.rect, { x: (W - 1.8) / 2, y: 2.1, w: 1.8, h: 0.055, fill: { color: c.accent } });
      slide.addText(topic.slice(0, 80), T({ x: (W - 8.6) / 2, y: 2.4, w: 8.6, h: 1.15, fontSize: 26, bold: true, color: headingColor, align: 'center', valign: 'middle' }, tFont));
      slide.addText(s.subtitle || 'Terima Kasih · Sesi Diskusi & Tanya Jawab', T({ x: (W - 8.6) / 2, y: 3.72, w: 8.6, h: 0.55, fontSize: 16, bold: true, color: c.accent, align: 'center' }, tFont));
      slide.addText('Kritik, saran, dan kolaborasi riset terbuka dipersilakan.', T({ x: (W - 8.6) / 2, y: 4.42, w: 8.6, h: 0.45, fontSize: 13, color: c.text, align: 'center' }, bFont));
      slide.addText('TGSDORK · EDITORIAL PRESENTATION STUDIO', T({ x: (W - 8.6) / 2, y: 5.25, w: 8.6, h: 0.35, fontSize: 9.5, color: c.muted, charSpacing: 1.4, bold: true, align: 'center' }, bFont));
    } else {
      heading(slide, pptx, title, page, c);
      const cards = normalizeCards(s).slice(0, 6);
      const n = cards.length;

      // Bento Grid kartu adaptif ala Canva / Pinterest
      if (n >= 3) {
        const cols = n === 3 || n === 5 || n === 6 ? 3 : 2;
        const totalRows = Math.ceil(n / cols);
        const gap = 0.28;
        const cw = (CONTENT_W - gap * (cols - 1)) / cols;
        const ch = Math.min(2.05, (4.55 - gap * (totalRows - 1)) / totalRows);
        const startY = 1.88 + (4.55 - (totalRows * ch + gap * (totalRows - 1))) / 2;

        cards.forEach((card, idx) => {
          const r = Math.floor(idx / cols);
          const cInRow = idx % cols;
          // ponytail: baris terakhir rata kiri mengikuti kolom, bukan center — hindari offset ganjil
          const x = M + cInRow * (cw + gap);
          const y = startY + r * (ch + gap);
          const badgeCol = idx % 2 === 0 ? c.accent : c.accent2;

          slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.11 });
          slide.addShape(pptx.ShapeType.roundRect, {
            x: x + 0.24,
            y: y + 0.2,
            w: 0.42,
            h: 0.26,
            fill: { color: badgeCol, transparency: c.lightMode ? 85 : 78 },
            line: { color: badgeCol, width: 0.8 },
            rectRadius: 0.08,
          });
          slide.addText(String(idx + 1).padStart(2, '0'), T({ x: x + 0.24, y: y + 0.2, w: 0.42, h: 0.26, fontSize: 9, bold: true, color: badgeCol, align: 'center', valign: 'middle' }, tFont));

          if (card.title) {
            slide.addText(card.title.slice(0, 60), T({ x: x + 0.76, y: y + 0.18, w: cw - 1.0, h: 0.36, fontSize: 14, bold: true, color: headingColor, valign: 'middle' }, tFont));
            slide.addText(card.desc, T({ x: x + 0.24, y: y + 0.62, w: cw - 0.48, h: ch - 0.74, fontSize: 12.5, color: c.text, lineSpacingMultiple: 1.25, valign: 'top' }, bFont));
          } else {
            slide.addText(card.desc, T({ x: x + 0.24, y: y + 0.54, w: cw - 0.48, h: ch - 0.66, fontSize: 13.5, color: c.text, lineSpacingMultiple: 1.25, valign: 'top' }, bFont));
          }
        });
      } else {
        const rows = Math.max(1, n);
        const gap = 0.28;
        const ch = Math.min(1.9, (4.4 - gap * (rows - 1)) / rows);
        cards.forEach((card, idx) => {
          const yTop = 1.95 + idx * (ch + gap);
          slide.addShape(pptx.ShapeType.roundRect, { x: M, y: yTop, w: CONTENT_W, h: ch, fill: { color: c.card }, line: { color: c.cardEdge, width: 1.2 }, rectRadius: 0.11 });
          slide.addShape(pptx.ShapeType.rect, { x: M + 0.28, y: yTop + 0.24, w: 0.08, h: ch - 0.48, fill: { color: idx % 2 === 0 ? c.accent : c.accent2 } });
          if (card.title) {
            slide.addText(card.title.slice(0, 70), T({ x: M + 0.54, y: yTop + 0.22, w: CONTENT_W - 0.84, h: 0.38, fontSize: 16, bold: true, color: headingColor }, tFont));
            slide.addText(card.desc.slice(0, 260), T({ x: M + 0.54, y: yTop + 0.64, w: CONTENT_W - 0.84, h: ch - 0.8, fontSize: 13.5, color: c.text, lineSpacingMultiple: 1.25 }, bFont));
          } else {
            slide.addText(card.desc, T({ x: M + 0.54, y: yTop + 0.26, w: CONTENT_W - 0.84, h: ch - 0.52, fontSize: 15, color: c.text, lineSpacingMultiple: 1.25, valign: 'middle' }, bFont));
          }
        });
      }
      footer(slide, topic, page, c);
    }

    if (s.notes) slide.addNotes(s.notes);
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await pptx.writeFile({ fileName: outPath });
  if (animate) {
    await applyTransitions(outPath);
  }
  return outPath;
}

function fallbackDeck(state: TaskState): Deck {
  const slides: AiSlide[] = [
    { layout: 'title', title: state.topic, subtitle: `${state.taskType.toUpperCase()} · ${state.sources.length} sumber terverifikasi` },
  ];
  for (const sec of state.sections) {
    if (/daftar pustaka|referensi/i.test(sec.title)) continue;
    const points = sec.content
      .split('\n')
      .map((l) => l.replace(/^#+\s*/, '').replace(/^\s*[-*]\s*/, '').trim())
      .filter((l) => l.length > 25 && !l.startsWith('|') && l.length < 130)
      .slice(0, 5);
    if (points.length > 0) slides.push({ layout: 'bullets', title: sec.title, bullets: points });
  }
  slides.push({ layout: 'closing', title: 'Terima Kasih', subtitle: 'Sesi tanya jawab' });
  return { title: state.topic, slides };
}

const SCHEMA_BLOCK = `{"title":"...","subtitle":"...","theme":"canva-editorial|canva-indigo|canva-minimal-light|nature|warm","slides":[
  {"layout":"title","title":"...","subtitle":"...","notes":"..."},
  {"layout":"section","title":"...","subtitle":"...","notes":"..."},
  {"layout":"bullets","title":"...","subtitle":"...","cards":[{"title":"Konsep Kunci","desc":"Penjelasan padat 1-2 kalimat spesifik"}],"notes":"..."},
  {"layout":"two-col","title":"...","columns":[{"heading":"A","cards":[{"title":"Peluang 1","desc":"Penjelasan operasional 1-2 kalimat"}]},{"heading":"B","cards":[{"title":"Tantangan 1","desc":"Penjelasan risiko 1-2 kalimat"}]}],"notes":"..."},
  {"layout":"stats","title":"...","stats":[{"label":"Indikator Metrik","value":"87%","desc":"Konteks capaian atau dampak terukur"}],"notes":"..."},
  {"layout":"quote","quote":"Pernyataan kunci atau tesis sentral","subtitle":"Konteks atau implikasi teoritis","notes":"..."},
  {"layout":"refs","title":"Daftar Referensi Utama","refs":[{"text":"Nama Penulis dkk. (Tahun). Judul Artikel Jurnal Ilmiah. Nama Jurnal, Vol(No).","url":"https://doi.org/..."}],"notes":"..."},
  {"layout":"closing","title":"Terima Kasih","subtitle":"Sesi tanya jawab"}
]}`;

const DECK_RULES = `Kamu desainer presentasi akademik senior. Keluarkan HANYA JSON valid, tanpa markdown fence, tanpa teks lain.
SKEMA:
${SCHEMA_BLOCK}

PEDOMAN KONTEN PADAT & BERBOBOT:
1. Pilih satu "theme" bergaya Canva / Pinterest yang paling cocok dengan topik:
   - "canva-indigo" (AI, data, cyber, komputasi — Bento Dark Indigo & Cyan)
   - "canva-editorial" (bisnis, ekonomi, manajemen, hukum — Linen Cream, Terracotta & Georgia Serif)
   - "canva-minimal-light" (teknik, industri, energi, sains umum — Clean White, Violet & Cobalt)
   - "nature" (medis, biologi, lingkungan, pertanian — Botanical Forest & Mint)
   - "warm" (psikologi, sosial, pendidikan, seni, budaya — Mulled Berry & Coral Rose)
2. ISI HARUS PADAT & PENJELASAN OPERASIONAL, BUKAN CUMA KATA KUNCI:
   - Gunakan format "cards": [{"title":"Nama Konsep/Aspek", "desc":"Penjelasan operasional 1-2 kalimat (15-25 kata) yang berbobot dan informatif"}].
   - JANGAN membuat poin 3 kata yang kosong seperti "Adopsi internet". Tulis "Penetrasi Akses: Infrastruktur broadband menjangkau 78% populasi namun disparitas antar-wilayah masih lebar."
3. 11-14 slide. Slide 1 "title", terakhir "closing".
4. Setiap slide WAJIB punya "notes" narasi pemateri 2-3 kalimat yang mendalam.
5. Bahasa Indonesia baku akademik (PUEBI), tanpa emoji.
6. Ringkas materi naskah yang ada — jangan menambah klaim baru di luar materi.`;

const TOPIC_DECK_RULES = `Kamu desainer presentasi akademik senior. Keluarkan HANYA JSON valid, tanpa markdown fence, tanpa teks lain.
SKEMA:
${SCHEMA_BLOCK}

PEDOMAN KONTEN PADAT & BERBOBOT DARI JUDUL:
1. Pilih satu "theme" bergaya Canva / Pinterest yang paling cocok dengan judul:
   - "canva-indigo" (AI, data, cyber, komputasi — Bento Dark Indigo & Cyan)
   - "canva-editorial" (bisnis, ekonomi, manajemen, hukum — Linen Cream, Terracotta & Georgia Serif)
   - "canva-minimal-light" (teknik, industri, energi, sains umum — Clean White, Violet & Cobalt)
   - "nature" (medis, biologi, lingkungan, pertanian — Botanical Forest & Mint)
   - "warm" (psikologi, sosial, pendidikan, seni, budaya — Mulled Berry & Coral Rose)
2. PENJELASAN HARUS MENDALAM & SPESIFIK (15-25 KATA PER KARTU):
   - Wajib pakai "cards": [{"title":"Judul Konsep", "desc":"Uraian padat 1-2 kalimat dengan konteks, mekanisme, atau argumen nyata"}].
   - Contoh buruk: "Efisiensi tinggi" (terlalu singkat, tidak ada isi).
   - Contoh bagus: "Otomasi Proses: Pemanfaatan algoritma machine learning memangkas latensi pemrosesan data hingga 60% tanpa menurunkan akurasi."
3. Alur akademik 12-14 slide:
   - title
   - section (Latar Belakang & Konteks)
   - bullets (Urgensi & Dinamika Mutakhir, 3-4 cards padat)
   - bullets (Rumusan Masalah & Research Gap, 3-4 cards padat)
   - two-col (Peluang vs Tantangan, masing-masing 2-3 cards dengan judul & penjelasan)
   - stats (2-3 metrik dengan angka + label + desc penjelas)
   - bullets (Kerangka Teori & Pendekatan, 3-4 cards)
   - bullets (Metodologi / Model Analisis, 3-4 cards)
   - two-col (Komparasi Pendekatan Konvensional vs Modern)
   - bullets (Studi Kasus / Pembahasan Utama, 3-4 cards)
   - quote (Tesis atau kutipan inti yang kuat)
   - bullets (Implikasi Kebijakan & Rekomendasi Solutif, 3-4 cards)
   - refs (Daftar 4-6 Referensi Jurnal Utama dengan format baku APA, cantumkan DOI/URL riil bila ada)
   - closing
4. Setiap slide WAJIB punya "notes" berisi skrip narasi pemateri 2-3 kalimat.
5. Gunakan rujukan literatur kredibel dan format ilmiah baku (PUEBI/APA).`;

// ponytail: env override biar bisa tes/geser model tanpa rebuild
const DECK_MODEL_FALLBACK: Array<string | undefined> = process.env.TGSDORK_DECK_MODELS
  ? process.env.TGSDORK_DECK_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
  : [undefined];

function parseDeck(raw: string): Deck | null {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  const parsed = JSON.parse(jsonStr) as Deck;
  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;
  return parsed;
}

async function callDeckAI(prompt: string): Promise<Deck | null> {
  for (const model of DECK_MODEL_FALLBACK) {
    try {
      const raw = await generateText({ prompt, role: 'writer', jsonMode: true, model });
      const deck = parseDeck(raw);
      if (deck) return deck;
    } catch (err) {
      logger.warn(`Deck generation failed: ${String(err).slice(0, 160)}`);
    }
  }
  return null;
}

async function aiDeck(state: TaskState): Promise<Deck | null> {
  const material = state.sections
    .filter((s) => !/daftar pustaka|referensi/i.test(s.title))
    .map((s) => `## ${s.title}\n${s.content.replace(/\s+/g, ' ').slice(0, 1400)}`)
    .join('\n\n');
  if (!material) return aiDeckFromTopic(state.topic);

  const prompt = `${DECK_RULES}\n\nTOPIK: ${state.topic}\nJENIS: ${state.taskType}\nJUMLAH SUMBER: ${state.sources.length}\n\nMATERI NASKAH:\n${material.slice(0, 24000)}`;
  return callDeckAI(prompt);
}

export async function aiDeckFromTopic(topic: string): Promise<Deck | null> {
  const prompt = `${TOPIC_DECK_RULES}\n\nJUDUL PRESENTASI: ${topic}`;
  return callDeckAI(prompt);
}

export async function generatePptxFromTitle(
  topic: string,
  outPath: string,
  opts: { animate?: boolean; theme?: string } = {}
): Promise<{ path: string; deck: Deck }> {
  let deck: Deck | null = null;
  try {
    deck = await aiDeckFromTopic(topic);
  } catch (err) {
    logger.warn(`AI topic deck gagal: ${String(err)}`);
  }
  if (!deck) {
    deck = {
      title: topic,
      subtitle: 'Paparan Akademik',
      slides: [
        { layout: 'title', title: topic, subtitle: 'Paparan Akademik' },
        { layout: 'section', title: 'Latar Belakang' },
        { layout: 'bullets', title: 'Konteks dan Urgensi', bullets: ['Konteks pembahasan topik', 'Alasan topik relevan dibahas'] },
        { layout: 'two-col', title: 'Peluang dan Tantangan', columns: [{ heading: 'Peluang', bullets: ['Aspek pendukung'] }, { heading: 'Tantangan', bullets: ['Aspek penghambat'] }] },
        { layout: 'bullets', title: 'Kesimpulan', bullets: ['Ringkasan argumen utama', 'Arah pengembangan lanjutan'] },
        { layout: 'closing', title: 'Terima Kasih', subtitle: 'Sesi tanya jawab' },
      ],
    };
  }
  if (opts.theme && opts.theme !== 'auto' && THEMES[opts.theme]) {
    deck.theme = opts.theme;
  }
  // Top-up referensi nyata dari korpus OpenAlex lokal jika slide refs belum terisi atau kurang dari 3
  const hasRefsSlide = deck.slides.some((s) => s.layout === 'refs' && (s.refs?.length || 0) > 0);
  if (!hasRefsSlide) {
    const locals = searchLocalJournals(topic, 5);
    const refItems: RefItem[] = locals.map((l) => ({
      text: l.fullRef || l.title,
      url: l.url,
    }));
    if (refItems.length > 0) {
      // Sisipkan tepat sebelum slide closing
      const closingIdx = deck.slides.findIndex((s) => s.layout === 'closing');
      const insertAt = closingIdx >= 0 ? closingIdx : deck.slides.length;
      deck.slides.splice(insertAt, 0, {
        layout: 'refs',
        title: 'Daftar Referensi Utama',
        refs: refItems,
        notes: 'Berikut daftar rujukan ilmiah dan jurnal terverifikasi yang melandasi kajian materi presentasi ini.',
      });
    }
  }

  await renderPptx(deck, outPath, topic, Boolean(opts.animate));
  return { path: outPath, deck };
}

export async function exportToPptx(state: TaskState, force = false, animate = false): Promise<string> {
  const outPath = path.join(getTaskDir(state.id), 'slides.pptx');
  if (!force && fs.existsSync(outPath) && fs.statSync(outPath).size > 2000) return outPath;

  let deck: Deck | null = null;
  try {
    deck = await aiDeck(state);
  } catch (err) {
    logger.warn(`AI deck gagal, pakai fallback deterministik: ${String(err)}`);
  }
  const finalDeck = deck ?? fallbackDeck(state);

  // Jika state punya sources nyata, sisipkan slide referensi dari sources naskah
  if (state.sources && state.sources.length > 0) {
    const hasRefs = finalDeck.slides.some((s) => s.layout === 'refs');
    if (!hasRefs) {
      const closingIdx = finalDeck.slides.findIndex((s) => s.layout === 'closing');
      const insertAt = closingIdx >= 0 ? closingIdx : finalDeck.slides.length;
      finalDeck.slides.splice(insertAt, 0, {
        layout: 'refs',
        title: 'Daftar Referensi Naskah',
        refs: state.sources.slice(0, 6).map((src) => ({
          text: src.fullRef || src.title,
          url: src.url,
        })),
        notes: 'Daftar referensi yang disitasi langsung dari naskah akademik terverifikasi.',
      });
    }
  }

  return await renderPptx(finalDeck, outPath, state.topic, animate);
}

// self-check: offline render, no API calls (light & dark Canva/Pinterest themes)
if (process.argv[1] && process.argv[1].endsWith('pptx-builder.ts')) {
  (async () => {
    for (const themeKey of ['canva-editorial', 'canva-indigo', 'canva-minimal-light']) {
      const demo: Deck = {
        title: 'Uji Deck Editorial',
        subtitle: 'Self-check Canva & Pinterest',
        theme: themeKey,
        slides: [
          { layout: 'title', title: 'Transformasi Ekonomi Digital dan Tata Kelola Publik', subtitle: 'Studi Literatur & Kerangka Kebijakan' },
          { layout: 'section', title: 'Latar Belakang & Konteks', subtitle: 'Mengapa topik ini mendesak dikaji' },
          { layout: 'bullets', title: 'Poin Utama', subtitle: 'Konteks singkat', cards: [{ title: 'Integrasi Data', desc: 'Penyatuan basis data lintas instansi memangkas duplikasi layanan hingga empat puluh persen.' }, { title: 'Literasi Digital', desc: 'Peningkatan kapasitas aparatur menjadi prasyarat adopsi sistem cerdas.' }, { title: 'Keamanan Siber', desc: 'Enkripsi end-to-end melindungi privasi warga dari kebocoran data.' }], notes: 'catatan' },
          { layout: 'two-col', title: 'Peluang vs Tantangan', columns: [{ heading: 'Peluang Strategis', cards: [{ title: 'Efisiensi Anggaran', desc: 'Otomasi birokrasi menurunkan biaya operasional tahunan.' }] }, { heading: 'Tantangan Implementasi', cards: [{ title: 'Kesenjangan Infrastruktur', desc: 'Daerah 3T masih menghadapi keterbatasan jaringan pita lebar.' }] }] },
          { layout: 'stats', title: 'Indikator Capaian', stats: [{ label: 'Adopsi Layanan', value: '84%', desc: 'Kenaikan pengguna aktif tahunan' }, { label: 'Waktu Proses', value: '3,1x', desc: 'Lebih cepat dibanding manual' }] },
          { layout: 'quote', quote: 'Teknologi publik yang baik bekerja senyap mempermudah urusan warga, bukan memindahkan birokrasi ke layar.', subtitle: 'Sintesis Kajian Kebijakan Digital' },
          { layout: 'refs', title: 'Daftar Referensi', refs: [{ text: 'Pratama, R. (2025). Arsitektur Pemerintahan Digital di Indonesia. Jurnal Kebijakan Publik, 12(2), 45-62.', url: 'https://doi.org/10.1234/jkp.2025.01' }] },
          { layout: 'closing', title: 'Terima Kasih' },
        ],
      };
      const out = path.join(getTaskDir('selfcheck-pptx'), `slides-${themeKey}.pptx`);
      const p = await renderPptx(demo, out, 'Uji Deck Editorial', true);
      const buf = fs.readFileSync(p);
      if (buf.length < 15000) throw new Error(`pptx ${themeKey} terlalu kecil: ${buf.length}`);
      const zip = await JSZip.loadAsync(buf);
      const s1 = await zip.file('ppt/slides/slide1.xml')!.async('text');
      if (THEMES[themeKey].lightMode && s1.includes('val="FFFFFF"') && !s1.includes('val="1F2421"') && !s1.includes('val="0F172A"')) {
        throw new Error(`Theme lightMode ${themeKey} masih memakai teks putih pada judul!`);
      }
      console.log(`pptx ok [${themeKey}]: ${p} (${buf.length} bytes)`);
    }
  })();
}
