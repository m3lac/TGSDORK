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

function markdownToCleanHtml(title: string, markdown: string, font: string = 'Times New Roman'): string {
  // Convert markdown tables to HTML tables first
  const withTables = markdown.replace(/(?:^\|.*\|\s*$\n?){2,}/gm, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const dataLines = lines.filter((l) => !/^\|\s*[-:]+/.test(l));
    if (dataLines.length === 0) return tableBlock;
    const rowsHtml = dataLines
      .map((line, idx) => {
        const tag = idx === 0 ? 'th' : 'td';
        const cells = line
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => `<\${tag}>\${c.trim()}</\${tag}>`.replace(/\$\{tag\}/g, tag).replace('${c.trim()}', c.trim()))
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table>${rowsHtml}</table>\n\n`;
  });

  // Convert standard markdown headings, lists, bold, italics to clean printable HTML
  let body = withTables
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\s*-\s+(.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>')
    .replace(/\n\n+/g, '</p><p>');

  body = body.replace(/<\/ul>\s*<ul>/g, '');
  body = body.replace(/<\/ol>\s*<ol>/g, '');
  body = `<p>${body}</p>`;

  const fontStack = font === 'Times New Roman'
    ? `'Times New Roman', Times, serif`
    : `'${font}', 'Times New Roman', Times, serif`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm 20mm 20mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: ${fontStack};
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18pt;
      text-align: center;
      margin-bottom: 24pt;
      text-transform: uppercase;
      font-weight: bold;
    }
    h2 {
      font-size: 14pt;
      margin-top: 18pt;
      margin-bottom: 8pt;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    p {
      text-align: justify;
      text-indent: 10mm;
      margin-bottom: 8pt;
    }
    ul, ol {
      margin-left: 20mm;
      margin-bottom: 8pt;
    }
    li {
      margin-bottom: 4pt;
      text-align: justify;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 10.5pt;
    }
    th, td {
      border: 1px solid #444;
      padding: 6pt 8pt;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    pre, code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9.5pt;
      background: #f8f8f8;
    }
    pre {
      padding: 8pt;
      border: 1px solid #ddd;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  ${body}
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

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '25mm',
        bottom: '20mm',
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
