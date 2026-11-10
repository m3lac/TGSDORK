import fs from 'node:fs';
import path from 'node:path';
import { Document, Paragraph, TextRun, Packer, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { getTaskDir } from '../core/checkpoint.js';
import type { TaskState, CoverMeta } from '../types/index.js';

const PAGE_MARGIN = { top: 2268, left: 2268, bottom: 1701, right: 1701 };

function parseInlineRuns(
  text: string,
  font: string,
  baseOpts: { size?: number; bold?: boolean; italics?: boolean } = {}
): TextRun[] {
  const size = baseOpts.size ?? 24;
  const baseBold = baseOpts.bold ?? false;
  const baseItalics = baseOpts.italics ?? false;
  const tokenRegex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(tokenRegex).filter((p) => p.length > 0);
  if (parts.length === 0) {
    return [new TextRun({ text, font, size, bold: baseBold, italics: baseItalics })];
  }
  return parts.map((part) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      return new TextRun({ text: part.slice(3, -3), font, size, bold: true, italics: true });
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return new TextRun({ text: part.slice(2, -2), font, size, bold: true, italics: baseItalics });
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return new TextRun({ text: part.slice(1, -1), font, size, bold: baseBold, italics: true });
    }
    return new TextRun({ text: part, font, size, bold: baseBold, italics: baseItalics });
  });
}

function splitChapterHeading(raw: string): { isChapter: boolean; isAbstrak: boolean; num?: string; title: string } {
  const cleaned = raw.replace(/\s*\([^)]*\)/g, '').replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim();
  const chapMatch = cleaned.match(/^(BAB\s+[0-9IVX]+|BAGIAN\s+[0-9IVX]+|CHAPTER\s+[0-9IVX]+)\s*[:.-]?\s*(.*)$/i);
  if (chapMatch) {
    const num = chapMatch[1].toUpperCase();
    const rest = chapMatch[2].trim().toUpperCase();
    return { isChapter: true, isAbstrak: false, num, title: rest || num };
  }
  if (/^(?:daftar\s+pustaka|references|bibliography|lampiran|kata\s+pengantar)\b/i.test(cleaned)) {
    return { isChapter: true, isAbstrak: false, title: cleaned.toUpperCase() };
  }
  if (/^(?:abstrak|abstract)\b/i.test(cleaned)) {
    return { isChapter: true, isAbstrak: true, title: cleaned.toUpperCase() };
  }
  return { isChapter: false, isAbstrak: false, title: cleaned };
}

function buildChapterParagraphs(
  rawTitle: string,
  font: string,
  pageBreakBefore: boolean
): Paragraph[] {
  const info = splitChapterHeading(rawTitle);
  if (info.num && info.title !== info.num) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore,
        keepNext: true,
        spacing: { before: pageBreakBefore ? 0 : 320, after: 80 },
        children: [
          new TextRun({
            text: info.num,
            font,
            bold: true,
            size: 28,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { before: 0, after: 240 },
        children: [
          new TextRun({
            text: info.title,
            font,
            bold: true,
            size: 28,
          }),
        ],
      }),
    ];
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore,
      keepNext: true,
      spacing: { before: pageBreakBefore ? 0 : 320, after: 240 },
      children: [
        new TextRun({
          text: info.title || rawTitle.toUpperCase(),
          font,
          bold: true,
          size: 28,
        }),
      ],
    }),
  ];
}

function buildDocxTable(lines: string[], font: string): Table | null {
  const dataRows = lines.filter((l) => !/^\|\s*[-:]+/.test(l));
  if (dataRows.length === 0) return null;

  const tableRows = dataRows.map((rowLine, rIdx) => {
    const cells = rowLine
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    return new TableRow({
      cantSplit: true,
      tableHeader: rIdx === 0,
      children: cells.map(
        (cellText) =>
          new TableCell({
            shading: rIdx === 0 ? { fill: 'F3F4F6' } : undefined,
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: rIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: parseInlineRuns(cellText, font, { size: 20, bold: rIdx === 0 }),
                spacing: { line: 260, after: 0 },
              }),
            ],
          })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '333333' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    },
    rows: tableRows,
  });
}

function buildCalloutBox(title: string, body: string, font: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      left: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
      right: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            shading: { fill: 'F8FAFC' },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: title, font, bold: true, size: 22 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0, line: 280 },
                children: [new TextRun({ text: body, font, italics: true, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function normalizeMarkdownBlocks(md: string): string[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let buffer: string[] = [];
  let inTable = false;
  let inCode = false;

  const flush = () => {
    if (buffer.length > 0) {
      blocks.push(buffer.join('\n').trim());
      buffer = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        buffer.push(rawLine);
        flush();
        inCode = false;
      } else {
        flush();
        inCode = true;
        buffer.push(rawLine);
      }
      continue;
    }
    if (inCode) {
      buffer.push(rawLine);
      continue;
    }

    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');
    if (isTableRow) {
      if (!inTable) {
        flush();
        inTable = true;
      }
      buffer.push(trimmed);
      continue;
    } else if (inTable) {
      flush();
      inTable = false;
    }

    if (!trimmed) {
      flush();
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed) || /^---+$/.test(trimmed)) {
      flush();
      blocks.push(trimmed);
      continue;
    }

    if (
      /^(?:bab\s+[0-9ivx]+|bagian\s+[0-9ivx]+|daftar\s+pustaka|abstrak|abstract|kata\s+pengantar|lampiran)\b/i.test(
        trimmed
      ) &&
      trimmed.length < 100 &&
      !/[.,;]$/.test(trimmed)
    ) {
      flush();
      blocks.push(`## ${trimmed}`);
      continue;
    }

    if (/^(?:[-*]|\d+\.)\s+/.test(trimmed)) {
      flush();
      blocks.push(trimmed);
      continue;
    }

    buffer.push(trimmed);
  }
  flush();
  return blocks.filter(Boolean);
}

function buildCover(cover: CoverMeta, topic: string, font: string): Paragraph[] {
  const out: Paragraph[] = [];
  const blank = (n: number) => {
    for (let i = 0; i < n; i++) out.push(new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }));
  };
  const add = (text?: string, o: { bold?: boolean; italic?: boolean; size?: number } = {}) => {
    if (!text || !text.trim()) return;
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text, font, bold: o.bold, italics: o.italic, size: o.size ?? 24 })],
      })
    );
  };

  blank(4);
  add(cover.institution?.toUpperCase(), { bold: true, size: 28 });
  add(cover.faculty?.toUpperCase());
  add(cover.program?.toUpperCase());
  blank(3);
  add(topic.toUpperCase(), { bold: true, size: 30 });
  blank(2);
  add('Disusun untuk Memenuhi Tugas Mata Kuliah', { italic: true, size: 22 });
  blank(2);
  add('Disusun oleh:');
  add(cover.author?.toUpperCase(), { bold: true });
  add(cover.nim ? `NIM: ${cover.nim}` : undefined);
  blank(3);
  add(cover.supervisor ? `Dosen Pembimbing: ${cover.supervisor}` : undefined);
  blank(3);
  add([cover.city?.toUpperCase(), cover.year].filter(Boolean).join(' '), { bold: true });
  return out;
}

function pushMarkdownBlocks(
  blocks: string[],
  target: Array<Paragraph | Table>,
  font: string,
  opts: { skipTitle?: string; allowChapterBreak?: boolean } = {}
): void {
  let seenFirstChapter = false;

  for (let idx = 0; idx < blocks.length; idx++) {
    const text = blocks[idx];
    if (/^---+$/.test(text)) continue;

    if (opts.skipTitle && idx === 0) {
      const cleanFirst = text.replace(/^#{1,6}\s+/, '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const normTitle = opts.skipTitle.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (
        cleanFirst === normTitle ||
        cleanFirst.replace(/[^a-z0-9]/g, '') === normTitle.replace(/[^a-z0-9]/g, '')
      ) {
        continue;
      }
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const isTable = lines.length >= 2 && lines.every((l) => l.startsWith('|') && l.endsWith('|'));
    if (isTable) {
      const tbl = buildDocxTable(lines, font);
      if (tbl) {
        target.push(tbl);
        target.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
        continue;
      }
    }

    if (text.includes('```mermaid') || text.startsWith('graph ') || text.startsWith('flowchart ')) {
      const diagramSteps = text
        .replace(/```(?:mermaid)?/g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^(graph|flowchart|subgraph|end)\b/i.test(l))
        .map((l) => l.replace(/^[A-Za-z0-9_]+\s*-->\s*/, '').replace(/[[\]()]/g, ''))
        .filter(Boolean)
        .join(' ➔ ');
      target.push(
        buildCalloutBox(
          'Gambar: Bagan Alur Penelitian & Kerangka Metodologi',
          `Alur: ${diagramSteps || text.replace(/```/g, '').trim().slice(0, 250)}`,
          font
        )
      );
      target.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
      continue;
    }

    if (text.startsWith('```')) {
      const codeBody = text.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim();
      target.push(buildCalloutBox('Lampiran Kode / Data Teknis', codeBody, font));
      target.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
      continue;
    }

    if (/^#{1,6}\s+/.test(text)) {
      const chapInfo = splitChapterHeading(text);
      if (chapInfo.isChapter) {
        const shouldBreak = Boolean(opts.allowChapterBreak) && (!chapInfo.isAbstrak || seenFirstChapter);
        seenFirstChapter = true;
        target.push(...buildChapterParagraphs(text, font, shouldBreak));
        continue;
      }
      const cleanHeading = text.replace(/^#{1,6}\s+/, '').trim();
      target.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          keepNext: true,
          children: parseInlineRuns(cleanHeading, font, { bold: true, size: 24 }),
          spacing: { line: 360, before: 220, after: 100 },
        })
      );
      continue;
    }

    const isInlineSubHeading = /^(?:[0-9]+\.[0-9]+(?:\.[0-9]+)?|[A-Z]\.)\s+/.test(text) && text.length < 140;
    if (isInlineSubHeading) {
      target.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          keepNext: true,
          children: parseInlineRuns(text, font, { bold: true, size: 24 }),
          spacing: { line: 360, before: 220, after: 100 },
        })
      );
      continue;
    }

    const isList = /^(?:[-*]|\d+\.)\s+/.test(text);
    const isNoIndentMeta = /^(?:\*{1,3}(?:Kata Kunci|Keywords|Abstract|Catatan)|Kata Kunci\s*:|Keywords\s*:)/i.test(text);

    target.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: isList ? { left: 720, hanging: 360 } : isNoIndentMeta ? undefined : { firstLine: 720 },
        children: parseInlineRuns(text.replace(/^[-*]\s+/, '• '), font, { size: 24 }),
        spacing: { line: 360, before: 0, after: 140 },
      })
    );
  }
}

export async function exportToDocx(state: TaskState, customFont?: string): Promise<string> {
  const font = customFont || state.font || 'Times New Roman';
  const paragraphs: Array<Paragraph | Table> = [];

  // Title (Page 1 if no cover, Page 2 top if cover)
  if (!state.cover) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: state.topic.toUpperCase(),
            font,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 0, after: 160 },
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Jenis Tugas: ${state.taskType.toUpperCase()} | Sumber: ${state.sources.length} Dokumen Terverifikasi`,
            font,
            italics: true,
            size: 20,
          }),
        ],
        spacing: { after: 320 },
      })
    );
  }

  // Sections
  for (let sIdx = 0; sIdx < state.sections.length; sIdx++) {
    const sec = state.sections[sIdx];
    const chapInfo = splitChapterHeading(sec.title);
    const shouldBreak = (chapInfo.isChapter && !chapInfo.isAbstrak) || (sIdx === 0 && Boolean(state.cover) && !chapInfo.isAbstrak);

    paragraphs.push(...buildChapterParagraphs(sec.title, font, shouldBreak));

    const blocks = normalizeMarkdownBlocks(sec.content);
    pushMarkdownBlocks(blocks, paragraphs, font, { skipTitle: sec.title, allowChapterBreak: false });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font,
            size: 24,
          },
          paragraph: {
            spacing: { line: 360, after: 140 },
          },
        },
      },
    },
    sections: [
      ...(state.cover
        ? [{ properties: { page: { margin: PAGE_MARGIN } }, children: buildCover(state.cover, state.topic, font) }]
        : []),
      {
        properties: { page: { margin: PAGE_MARGIN } },
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const taskDir = getTaskDir(state.id);
  const filePath = path.join(taskDir, 'output.docx');

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function exportRawDocx(
  title: string,
  markdownText: string,
  outputPath: string,
  customFont: string = 'Times New Roman'
): Promise<string> {
  const font = customFont || 'Times New Roman';
  const paragraphs: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: title.toUpperCase(),
          font,
          bold: true,
          size: 28,
        }),
      ],
      spacing: { before: 0, after: 280 },
    }),
  ];

  const blocks = normalizeMarkdownBlocks(markdownText);
  pushMarkdownBlocks(blocks, paragraphs, font, { skipTitle: title, allowChapterBreak: true });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font,
            size: 24,
          },
          paragraph: {
            spacing: { line: 360, after: 140 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: PAGE_MARGIN,
          },
        },
        children: paragraphs,
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
