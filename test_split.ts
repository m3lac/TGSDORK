import assert from 'node:assert';

export interface DocumentSection {
  title: string;
  content: string;
}

export function splitDocumentSections(text: string): DocumentSection[] {
  const lines = text.split('\n');
  const sections: DocumentSection[] = [];
  let currentTitle = 'Pengantar';
  let currentLines: string[] = [];

  const headingPattern =
    /^(?:#{1,2}\s+(.+)|(BAB\s+[IVX0-9]+(?:\s*[:.-]\s*.*)?)|(DAFTAR\s+PUSTAKA(?:\s*[:.-]\s*.*)?)|((?:ABSTRAK|ABSTRACT)\s*[:.-]?\s*))$/i;

  for (const line of lines) {
    const match = line.trim().match(headingPattern);
    if (match) {
      if (currentLines.length > 0) {
        const body = currentLines.join('\n').trim();
        if (body.length > 0) {
          sections.push({ title: currentTitle, content: body });
        }
        currentLines = [];
      }
      currentTitle = (match[1] || match[2] || match[3] || match[4] || line.trim()).replace(/^#+\s*/, '');
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const body = currentLines.join('\n').trim();
    if (body.length > 0) {
      sections.push({ title: currentTitle, content: body });
    }
  }

  // Fallback: If no headings or single giant block (> 12000 chars), split by paragraph blocks
  if (sections.length <= 1 && text.length > 12000) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunkSections: DocumentSection[] = [];
    let chunkLines: string[] = [];
    let chunkLen = 0;
    let partNum = 1;

    for (const p of paragraphs) {
      chunkLines.push(p);
      chunkLen += p.length;
      if (chunkLen >= 8000) {
        chunkSections.push({
          title: `Bagian ${partNum}`,
          content: chunkLines.join('\n\n'),
        });
        chunkLines = [];
        chunkLen = 0;
        partNum++;
      }
    }
    if (chunkLines.length > 0) {
      chunkSections.push({
        title: `Bagian ${partNum}`,
        content: chunkLines.join('\n\n'),
      });
    }
    return chunkSections;
  }

  return sections;
}

function runSelfCheck() {
  const sampleDoc = `# Judul Makalah
Abstrak singkat di sini.

## BAB I: PENDAHULUAN
Isi bab satu mengenai latar belakang.

## BAB II: KAJIAN TEORI
Teori dasar dan literatur.

## DAFTAR PUSTAKA
1. Doe, J. (2024). Title.`;

  const secs = splitDocumentSections(sampleDoc);
  assert.strictEqual(secs.length, 4, `Expected 4 sections, got ${secs.length}`);
  assert.strictEqual(secs[0].title, 'Judul Makalah');
  assert.strictEqual(secs[1].title, 'BAB I: PENDAHULUAN');
  assert.strictEqual(secs[2].title, 'BAB II: KAJIAN TEORI');
  assert.strictEqual(secs[3].title, 'DAFTAR PUSTAKA');

  const reassembled = secs.map((s) => s.content).join('\n\n');
  assert.ok(reassembled.includes('Abstrak singkat'));
  assert.ok(reassembled.includes('BAB II: KAJIAN TEORI'));
  assert.ok(reassembled.includes('Doe, J. (2024)'));

  console.log('✔ splitDocumentSections assertion check PASSED');
}

runSelfCheck();
