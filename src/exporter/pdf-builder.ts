import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium, type Browser } from 'playwright';
import { logger } from '../core/logger.js';

let pdfBrowser: Browser | null = null;

function findFallbackChromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const roots = ['/opt/ms-playwright', path.join(os.homedir(), '.cache', 'ms-playwright')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).sort().reverse();
    for (const dir of dirs) {
      const candidates = [
        path.join(root, dir, 'chrome-linux64', 'chrome'),
        path.join(root, dir, 'chrome-linux', 'chrome'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return undefined;
}

async function getPdfBrowser(): Promise<Browser> {
  if (!pdfBrowser || !pdfBrowser.isConnected()) {
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    try {
      pdfBrowser = await chromium.launch({ headless: true, args: launchArgs });
    } catch (err) {
      const fallbackExec = findFallbackChromiumExecutable();
      if (!fallbackExec) throw err;
      pdfBrowser = await chromium.launch({
        headless: true,
        executablePath: fallbackExec,
        args: launchArgs,
      });
    }
  }
  return pdfBrowser;
}

function formatInlineHtml(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function parseChapterHeading(raw: string): { isChapter: boolean; isAbstrak: boolean; num?: string; title: string } {
  const cleaned = raw.replace(/\s*\([^)]*\)/g, '').replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim();
  const chapMatch = cleaned.match(/^(BAB\s+[0-9IVX]+|BAGIAN\s+[0-9IVX]+|CHAPTER\s+[0-9IVX]+)\s*[:.-]?\s*(.*)$/i);
  if (chapMatch) {
    const num = chapMatch[1].toUpperCase();
    const rest = chapMatch[2].trim().toUpperCase();
    return { isChapter: true, isAbstrak: false, num, title: rest || num };
  }
  if (
    /^(?:daftar\s+pustaka|references|bibliography|lampiran|kata\s+pengantar|pendahuluan|tinjauan\s+pustaka|landasan\s+teori|kajian\s+pustaka|tinjauan\s+teoretis|metode\s+penelitian|metodologi(?:\s+penelitian)?|metode\s+kajian|metode\s+seleksi\s+literatur|hasil\s+dan\s+pembahasan|pembahasan|analisis\s+dan\s+pembahasan|kesimpulan(?:\s+dan\s+saran)?|penutup|simpulan)\b/i.test(
      cleaned
    ) &&
    cleaned.length < 100
  ) {
    return { isChapter: true, isAbstrak: false, title: cleaned.toUpperCase() };
  }
  if (/^(?:abstrak|abstract)\b/i.test(cleaned) && cleaned.length < 50) {
    return { isChapter: true, isAbstrak: true, title: cleaned.toUpperCase() };
  }
  return { isChapter: false, isAbstrak: false, title: cleaned };
}

function markdownToCleanHtml(docTitle: string, markdown: string, font: string = 'Times New Roman'): string {
  // 1. Convert markdown tables to styled HTML tables with thead/tbody & keep-together
  const withTables = markdown.replace(/(?:^\|.*\|\s*$\n?){2,}/gm, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const dataLines = lines.filter((l) => !/^\|\s*[-:]+/.test(l));
    if (dataLines.length === 0) return tableBlock;

    const parseRow = (line: string, tag: 'th' | 'td') => {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => `<${tag}>${formatInlineHtml(c.trim())}</${tag}>`)
        .join('');
      return `<tr>${cells}</tr>`;
    };

    const thead = `<thead>${parseRow(dataLines[0], 'th')}</thead>`;
    const tbody = `<tbody>${dataLines.slice(1).map((l) => parseRow(l, 'td')).join('')}</tbody>`;
    const isSmall = dataLines.length <= 9;
    return `\n<div class="table-container${isSmall ? ' keep-together' : ''}"><table>${thead}${tbody}</table></div>\n\n`;
  });

  // 2. Convert Mermaid diagrams or code blocks to styled callout boxes
  const withDiagrams = withTables.replace(/```(?:mermaid)?[\s\S]*?```/gim, (diagramBlock) => {
    const content = diagramBlock.replace(/```(?:mermaid)?/gi, '').trim();
    if (/^(?:graph|flowchart|subgraph|sequenceDiagram|classDiagram)\b/i.test(content)) {
      const steps = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^(graph|flowchart|subgraph|end)\b/i.test(l))
        .map((l) => l.replace(/^[A-Za-z0-9_]+\s*-->\s*/, '').replace(/[[\]()]/g, ''))
        .filter(Boolean)
        .join(' ➔ ');
      return `\n<div class="diagram-box"><div class="diagram-title">Gambar: Bagan Alur Penelitian &amp; Kerangka Metodologi</div><div class="diagram-flow">${steps || content.slice(0, 300)}</div></div>\n\n`;
    }
    const safeCode = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `\n<pre class="code-box"><code>${safeCode}</code></pre>\n\n`;
  });

  // 3. Line-by-line block parser
  const lines = withDiagrams.replace(/\r\n/g, '\n').split('\n');
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;
  let seenTitle = false;
  let seenFirstChapter = false;

  const closeLists = () => {
    if (inUl) { htmlParts.push('</ul>'); inUl = false; }
    if (inOl) { htmlParts.push('</ol>'); inOl = false; }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      continue;
    }

    if (line.startsWith('<div class="table-container') || line.startsWith('<div class="diagram-box') || line.startsWith('<pre class="code-box')) {
      closeLists();
      htmlParts.push(line);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeLists();
      htmlParts.push('<hr class="section-divider" />');
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      closeLists();
      const level = hMatch[1].length;
      const headingText = hMatch[2].trim();

      if (level === 1 && !seenTitle) {
        seenTitle = true;
        htmlParts.push(`<h1 class="paper-title">${formatInlineHtml(headingText.toUpperCase())}</h1>`);
        continue;
      }

      const chapInfo = parseChapterHeading(headingText);
      if (chapInfo.isChapter) {
        if (chapInfo.isAbstrak) {
          htmlParts.push(
            `<h2 class="chapter-heading abstrak-heading"><span class="chapter-title">ABSTRAK</span></h2>`
          );
          continue;
        }

        let chapterTitle = chapInfo.title;
        if (chapInfo.num && chapInfo.title === chapInfo.num) {
          let nextIdx = idx + 1;
          while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
          if (nextIdx < lines.length) {
            const nextClean = lines[nextIdx].replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim();
            if (
              nextClean.length > 2 &&
              nextClean.length < 90 &&
              !/[.,;]$/.test(nextClean) &&
              !/^(?:[0-9]+\.[0-9]+|BAB\s|BAGIAN\s)/i.test(nextClean) &&
              !/^(?:[-*]|\d+\.)\s+/.test(nextClean)
            ) {
              chapterTitle = nextClean.toUpperCase();
              lines[nextIdx] = ''; // consumed
            }
          }
        }

        const shouldBreak = seenFirstChapter || seenTitle;
        seenFirstChapter = true;
        const breakClass = shouldBreak ? ' page-break' : '';

        if (chapInfo.num && chapterTitle && chapterTitle !== chapInfo.num) {
          htmlParts.push(
            `<h2 class="chapter-heading${breakClass}"><span class="chapter-num">${chapInfo.num}</span><span class="chapter-title">${chapterTitle}</span></h2>`
          );
        } else {
          htmlParts.push(
            `<h2 class="chapter-heading${breakClass}"><span class="chapter-title">${chapterTitle || headingText.toUpperCase()}</span></h2>`
          );
        }
        continue;
      }

      if (level === 2) {
        htmlParts.push(`<h2 class="section-title">${formatInlineHtml(headingText)}</h2>`);
        continue;
      }
      if (level === 3) {
        htmlParts.push(`<h3 class="sub-heading">${formatInlineHtml(headingText)}</h3>`);
        continue;
      }
      htmlParts.push(`<h4 class="sub-sub-heading">${formatInlineHtml(headingText)}</h4>`);
      continue;
    }

    if (
      /^(?:bab\s+[0-9ivx]+|bagian\s+[0-9ivx]+|daftar\s+pustaka|abstrak|abstract|kata\s+pengantar|lampiran|pendahuluan|tinjauan\s+pustaka|landasan\s+teori|metode\s+penelitian|metodologi|hasil\s+dan\s+pembahasan|kesimpulan|penutup|simpulan)\b/i.test(
        line
      ) &&
      line.length < 100 &&
      !/[.,;]$/.test(line)
    ) {
      closeLists();
      const chapInfo = parseChapterHeading(line);
      if (chapInfo.isAbstrak) {
        htmlParts.push(`<h2 class="chapter-heading abstrak-heading"><span class="chapter-title">ABSTRAK</span></h2>`);
        continue;
      }

      let chapterTitle = chapInfo.title;
      if (chapInfo.num && chapInfo.title === chapInfo.num) {
        let nextIdx = idx + 1;
        while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++;
        if (nextIdx < lines.length) {
          const nextClean = lines[nextIdx].replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim();
          if (
            nextClean.length > 2 &&
            nextClean.length < 90 &&
            !/[.,;]$/.test(nextClean) &&
            !/^(?:[0-9]+\.[0-9]+|BAB\s|BAGIAN\s)/i.test(nextClean) &&
            !/^(?:[-*]|\d+\.)\s+/.test(nextClean)
          ) {
            chapterTitle = nextClean.toUpperCase();
            lines[nextIdx] = '';
          }
        }
      }

      const shouldBreak = seenFirstChapter || seenTitle;
      seenFirstChapter = true;
      const breakClass = shouldBreak ? ' page-break' : '';
      if (chapInfo.num && chapterTitle && chapterTitle !== chapInfo.num) {
        htmlParts.push(`<h2 class="chapter-heading${breakClass}"><span class="chapter-num">${chapInfo.num}</span><span class="chapter-title">${chapterTitle}</span></h2>`);
      } else {
        htmlParts.push(`<h2 class="chapter-heading${breakClass}"><span class="chapter-title">${chapterTitle || line.toUpperCase()}</span></h2>`);
      }
      continue;
    }
    if (/^\*Jenis Dokumen:.*\*$/i.test(line)) {
      closeLists();
      htmlParts.push(`<p class="paper-subtitle no-indent">${formatInlineHtml(line)}</p>`);
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) { htmlParts.push('</ol>'); inOl = false; }
      if (!inUl) { htmlParts.push('<ul>'); inUl = true; }
      htmlParts.push(`<li>${formatInlineHtml(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) { htmlParts.push('</ul>'); inUl = false; }
      if (!inOl) { htmlParts.push('<ol>'); inOl = true; }
      htmlParts.push(`<li>${formatInlineHtml(olMatch[1])}</li>`);
      continue;
    }

    closeLists();

    const isNoIndent =
      /^\*{1,3}(?:Kata Kunci|Keywords|Abstract|Catatan)/i.test(line) ||
      /^Kata Kunci\s*:/i.test(line) ||
      /^(?:Gambar|Tabel)\s+[0-9]/i.test(line);

    htmlParts.push(`<p${isNoIndent ? ' class="no-indent keywords"' : ''}>${formatInlineHtml(line)}</p>`);
  }
  closeLists();

  const fontStack = font === 'Times New Roman'
    ? `'Times New Roman', Times, serif`
    : `'${font}', 'Times New Roman', Times, serif`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm 22mm 20mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      font-family: ${fontStack};
      font-size: 12pt;
      line-height: 1.6;
      color: #111111;
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1.paper-title {
      font-size: 15pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      line-height: 1.35;
      letter-spacing: 0.02em;
      margin-top: 0;
      margin-bottom: 10pt;
      padding-top: 0;
      page-break-after: avoid;
      break-after: avoid;
    }

    .paper-subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      color: #374151;
      margin-bottom: 18pt;
      text-indent: 0;
    }

    .section-divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16pt 0;
    }

    .chapter-heading {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      line-height: 1.35;
      margin-top: 0;
      padding-top: 0;
      margin-bottom: 18pt;
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: none !important;
    }

    .chapter-heading.page-break {
      page-break-before: always !important;
      break-before: page !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    .chapter-heading.abstrak-heading {
      margin-top: 16pt;
      margin-bottom: 12pt;
    }

    .chapter-heading .chapter-num {
      display: block;
      font-size: 14pt;
      font-weight: bold;
      letter-spacing: 0.05em;
      margin-bottom: 4pt;
    }

    .chapter-heading .chapter-title {
      display: block;
      font-size: 14pt;
      font-weight: bold;
    }

    h2.section-title {
      font-size: 13pt;
      font-weight: bold;
      text-align: left;
      margin-top: 18pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: none;
    }

    h3.sub-heading {
      font-size: 12pt;
      font-weight: bold;
      text-align: left;
      margin-top: 16pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
      break-after: avoid;
      color: #111111;
    }

    h4.sub-sub-heading {
      font-size: 12pt;
      font-weight: bold;
      font-style: italic;
      text-align: left;
      margin-top: 12pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
      break-after: avoid;
      color: #111111;
    }

    p {
      text-align: justify;
      text-indent: 12.7mm;
      margin-top: 0;
      margin-bottom: 8pt;
      line-height: 1.6;
      orphans: 3;
      widows: 3;
    }

    p.no-indent,
    .keywords,
    .paper-subtitle {
      text-indent: 0 !important;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 10pt;
      padding-left: 14mm;
    }

    li {
      margin-bottom: 4pt;
      text-align: justify;
      line-height: 1.55;
    }

    .table-container {
      width: 100%;
      margin: 16pt 0 20pt 0;
      page-break-inside: auto;
      break-inside: auto;
      overflow: visible;
    }

    .table-container.keep-together {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      font-size: 10pt;
      line-height: 1.45;
      margin: 0;
      table-layout: auto;
    }

    thead {
      display: table-header-group !important;
      page-break-after: avoid;
      break-after: avoid;
    }

    tbody {
      display: table-row-group;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    th, td {
      border: 1px solid #1f2937 !important;
      padding: 7pt 9pt;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    th {
      background-color: #f3f4f6 !important;
      color: #111827;
      font-weight: bold;
      text-align: center;
    }

    td {
      background-color: #ffffff;
    }

    .diagram-box {
      width: 100% !important;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin: 16pt 0;
      padding: 12pt 16pt;
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 6px;
      text-align: center;
    }

    .diagram-title {
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 6pt;
      color: #0f172a;
    }

    .diagram-flow {
      font-size: 10pt;
      font-style: italic;
      color: #334155;
      line-height: 1.5;
    }

    pre.code-box {
      width: 100% !important;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      background: #f8fafc !important;
      padding: 10pt 14pt;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 14pt 0;
    }

    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background: rgba(0, 0, 0, 0.05);
      padding: 1pt 3pt;
      border-radius: 3pt;
    }
  </style>
</head>
<body>
  ${htmlParts.join('\n')}
</body>
</html>`;
}

export async function exportMarkdownToPdf(
  title: string,
  markdownText: string,
  outputPath: string,
  font: string = 'Times New Roman'
): Promise<string> {
  const browser = await getPdfBrowser();
  const page = await browser.newPage();
  try {
    const html = markdownToCleanHtml(title, markdownText, font);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fontStack = font === 'Times New Roman'
      ? `'Times New Roman', Times, serif`
      : `'${font}', 'Times New Roman', Times, serif`;

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:${fontStack};font-size:9pt;color:#6b7280;width:100%;padding:0 20mm;display:flex;justify-content:flex-end;"><span class="pageNumber"></span></div>`,
      margin: {
        top: '25mm',
        bottom: '22mm',
        left: '20mm',
        right: '20mm',
      },
    });
    logger.success(`PDF berhasil diekspor ke: ${outputPath}`);
    return outputPath;
  } finally {
    await page.close().catch(() => {});
  }
}
