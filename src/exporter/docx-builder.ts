import fs from 'node:fs';
import path from 'node:path';
import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
import { getTaskDir } from '../core/checkpoint.js';
import type { TaskState, CoverMeta } from '../types/index.js';

const PAGE_MARGIN = { top: 2268, left: 2268, bottom: 1701, right: 1701 };

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


export async function exportToDocx(state: TaskState, customFont?: string): Promise<string> {
  const font = customFont || state.font || 'Times New Roman';
  const paragraphs: Array<Paragraph | Table> = [];

  // Title
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: state.topic.toUpperCase(),
          font,
          bold: true,
          size: 28, // 14pt Judul
        }),
      ],
      spacing: { before: 200, after: 200 },
    })
  );

  // Subtitle
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Jenis Tugas: ${state.taskType.toUpperCase()} | Sumber: ${state.sources.length} Dokumen Terverifikasi`,
          font,
          italics: true,
          size: 20, // 10pt
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Sections
  for (const sec of state.sections) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: sec.title.toUpperCase(),
            font,
            bold: true,
            size: 24, // 12pt Bold
          }),
        ],
        spacing: { before: 360, after: 180 },
      })
    );

    const bodyParagraphs = sec.content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    for (let pIdx = 0; pIdx < bodyParagraphs.length; pIdx++) {
      const text = bodyParagraphs[pIdx];

      // ponytail: Cegah duplikasi judul bab jika baris pertama konten mengulang nama bab
      const cleanHeadingTest = text.replace(/^#{1,6}\s+/, '').trim().toLowerCase();
      const secTitleNorm = sec.title.trim().toLowerCase();
      if (
        pIdx === 0 &&
        (cleanHeadingTest === secTitleNorm ||
          cleanHeadingTest.replace(/[^a-z0-9]/g, '') === secTitleNorm.replace(/[^a-z0-9]/g, ''))
      ) {
        continue;
      }

      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const isTable = lines.length >= 2 && lines.every((l) => l.startsWith('|') && l.endsWith('|'));
      if (isTable) {
        const dataRows = lines.filter((l) => !/^\|\s*[-:]+/.test(l));
        if (dataRows.length > 0) {
          const tableRows = dataRows.map((rowLine, rIdx) => {
            const cells = rowLine
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim().replace(/\*\*/g, '').replace(/\*/g, ''));
            return new TableRow({
              children: cells.map(
                (cellText) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: cellText, font, bold: rIdx === 0, size: 20 })],
                      }),
                    ],
                  })
              ),
            });
          });
          paragraphs.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            })
          );
          continue;
        }
      }

      // ponytail: Format blok diagram Mermaid agar rapi di DOCX tanpa kode mentah
      if (text.includes('```mermaid') || text.startsWith('graph ') || text.startsWith('flowchart ')) {
        const diagramSteps = text
          .replace(/```(?:mermaid)?/g, '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !/^(graph|flowchart|subgraph|end)\b/i.test(l))
          .map((l) => l.replace(/^[A-Za-z0-9_]+\s*-->\s*/, '').replace(/[[\]()]/g, ''))
          .filter(Boolean)
          .join(' ➔ ');
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Gambar: Bagan Alur Penelitian & Kerangka Metodologi',
                font,
                bold: true,
                size: 22,
              }),
            ],
            spacing: { before: 200, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Alur: ${diagramSteps || text.replace(/```/g, '').trim().slice(0, 250)}`,
                font,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 200 },
          })
        );
        continue;
      }

      // Sub-headings (### 1.1 / #### a.) vs Paragraf tubuh
      const isSubHeading = /^#{2,4}\s+/.test(text) || /^(?:[0-9]+\.[0-9]+|[A-Z]\.)\s+/.test(text);
      const cleanLine = text.replace(/^#{1,6}\s+/, '').trim();
      paragraphs.push(
        new Paragraph({
          alignment: isSubHeading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          indent: isSubHeading ? undefined : { firstLine: 720 }, // 1.27 cm first line indent standar karya ilmiah
          children: [
            new TextRun({
              text: cleanLine,
              font,
              bold: isSubHeading,
              size: 24, // 12pt standar skripsi
            }),
          ],
          spacing: { line: 360, before: isSubHeading ? 200 : 0, after: isSubHeading ? 100 : 150 }, // 1.5 line spacing
        })
      );
    }
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
            spacing: { line: 360, after: 150 },
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
      spacing: { after: 300 },
    }),
  ];

  const blocks = markdownText.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const isTable = lines.length >= 2 && lines.every((l) => l.startsWith('|') && l.endsWith('|'));
    if (isTable) {
      const dataRows = lines.filter((l) => !/^\|\s*[-:]+/.test(l));
      if (dataRows.length > 0) {
        const tableRows = dataRows.map((rowLine, rIdx) => {
          const cells = rowLine
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim().replace(/\*\*/g, '').replace(/\*/g, ''));
          return new TableRow({
            children: cells.map(
              (cellText) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cellText, font, bold: rIdx === 0, size: 20 })],
                    }),
                  ],
                })
            ),
          });
        });
        paragraphs.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
        continue;
      }
    }

    if (block.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: block.replace(/^#\s+/, '').toUpperCase(),
              font,
              bold: true,
              size: 26,
            }),
          ],
          spacing: { before: 300, after: 150 },
        })
      );
    } else if (block.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: block.replace(/^##\s+/, '').toUpperCase(),
              font,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (block.startsWith('### ') || block.startsWith('#### ') || /^(?:[0-9]+\.[0-9]+|[A-Z]\.)\s+/.test(block)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: block.replace(/^#{1,4}\s+/, ''),
              font,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 180, after: 90 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 }, // 1.27 cm first line indent
          children: [
            new TextRun({
              text: block,
              font,
              size: 24,
            }),
          ],
          spacing: { line: 360, after: 150 },
        })
      );
    }
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
            spacing: { line: 360, after: 150 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 2268,
              left: 2268,
              bottom: 1701,
              right: 1701,
            },
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
