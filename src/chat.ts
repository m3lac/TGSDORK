import readline from 'node:readline';
import readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pc from 'picocolors';
import { generateText } from './ai/client.js';
import { initCheckpoint, listCheckpoints } from './core/checkpoint.js';
import { runTaskPipeline } from './pipelines/runner.js';
import { exportToMarkdown } from './exporter/markdown.js';
import { exportToDocx } from './exporter/docx-builder.js';
import { exportToMarpSlide } from './exporter/slide-builder.js';
import { exportToPptx } from './exporter/pptx-builder.js';
import { exportToBibtex } from './exporter/bibtex.js';
import { copyToDocuments } from './core/downloads.js';
import { reviewTask, reviewFile, reviseTask, autoReviseTask } from './pipelines/reviewer.js';
import { logger } from './core/logger.js';
import type { TaskType } from './types/index.js';

export async function startChat(): Promise<void> {
  const rl = readlinePromises.createInterface({ input, output });

  console.log(pc.bold(pc.cyan('\n🎓 TGSDORK — Academic Planning & Interactive Chat')));
  console.log(pc.dim('Diskusikan perencanaan tugas, rumusan masalah, struktur bab, atau buat naskah langsung.'));
  console.log(pc.dim('Perintah:'));
  console.log(pc.dim('  /plan <topik>              -> Rancang rencana & struktur bab lengkap'));
  console.log(pc.dim('  /makalah <topik> [--bab N] -> Buat makalah langsung'));
  console.log(pc.dim('  /skripsi <topik> [--bab N] -> Buat skripsi langsung'));
  console.log(pc.dim('  /buat                      -> Langsung buat dokumen dari topik yang dibahas'));
  console.log(pc.dim('  /review <file|taskId>      -> Audit kelayakan naskah'));
  console.log(pc.dim('  /autorevise <taskId>       -> Revisi otomatis dari hasil audit'));
  console.log(pc.dim('  /tasks                     -> Daftar tugas'));
  console.log(pc.dim('  /exit                      -> Keluar\n'));

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let lastTopic = '';
  let lastPlanChapters: string[] = [];

  const systemPrompt = `Kamu adalah Konsultan Akademik dan Planner Karya Ilmiah cerdas (TGSDORK).
Tugasmu:
1. Membantu mahasiswa dan akademisi merumuskan topik penelitian, judul naskah, latar belakang, dan rumusan masalah.
2. Membantu merancang struktur bab (bisa 3 bab, 4 bab, 5 bab, atau sesuai kebutuhan kampus).
3. Memberikan rekomendasi metodologi penelitian, sumber rujukan ilmiah (Garuda, Neliti, arXiv, DOAJ, Semantic Scholar), dan novelty penelitian.
4. Gunakan bahasa Indonesia akademis yang lugas, terstruktur, ramah, dan bernas.
5. Bila pengguna setuju dengan topik atau outline yang didiskusikan, ingatkan mereka bahwa mereka bisa langsung ketik "/buat" untuk menyusun dokumen lengkap.`;

  while (true) {
    let userInput = '';
    try {
      userInput = await rl.question(pc.bold(pc.green('Anda > ')));
    } catch {
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
      console.log(pc.yellow('Sampai jumpa!'));
      rl.close();
      break;
    }

    if (trimmed === '/tasks') {
      const tasks = listCheckpoints();
      if (tasks.length === 0) {
        console.log(pc.dim('Belum ada tugas di workspace.\n'));
      } else {
        console.log(pc.bold(`Ditemukan ${tasks.length} tugas di workspace:`));
        for (const t of tasks) {
          console.log(`- [${t.id}] ${t.topic} (${t.taskType}) [${t.step}]`);
        }
        console.log('');
      }
      continue;
    }

    // Planning command: /plan <topik>
    const planMatch = trimmed.match(/^\/plan\s+(.+)$/i);
    if (planMatch) {
      const topic = planMatch[1].trim();
      lastTopic = topic;
      console.log(pc.cyan(`\nMenyusun Academic Task Plan untuk: "${topic}"...\n`));

      const planPrompt = `Buatlah Rencana Penulisan Tugas Ilmiah Lengkap untuk topik: "${topic}".
Format output:
1. Rekomendasi Judul Formal
2. Latar Belakang Singkat & Urgensi
3. Rumusan Masalah (3 poin)
4. Rekomendasi Struktur Bab (Usulan Bab 1 s.d. Bab 5)
5. Kata Kunci Pencarian Literatur (Garuda / arXiv / DOAJ)`;

      try {
        const reply = await generateText({
          prompt: planPrompt,
          systemPrompt,
          role: 'writer',
        });
        console.log(reply + '\n');
        console.log(pc.green(`Tips: Ketik "/buat" untuk langsung meneliti dan mengenerate dokumen ini.\n`));
        history.push({ role: 'user', content: trimmed });
        history.push({ role: 'assistant', content: reply });
      } catch (err) {
        logger.error(`Gagal menyusun plan: ${String(err)}`);
      }
      continue;
    }

    // Direct review trigger: /review <taskId|file>
    const reviewMatch = trimmed.match(/^\/review\s+(.+)$/i);
    if (reviewMatch) {
      const target = reviewMatch[1].trim();
      const isFile = target.includes('/') || target.includes('.');
      console.log(pc.cyan(`\nMemulai audit naskah akademik: ${target}...`));
      try {
        const result = isFile ? await reviewFile(target) : await reviewTask(target);
        console.log('\n' + result + '\n');
      } catch (err) {
        logger.error(`Gagal: ${String(err)}`);
      }
      continue;
    }

    // Direct revise trigger: /revisi <taskId> <instruksi>
    const reviseMatch = trimmed.match(/^\/(revisi|revise)\s+(\S+)\s+(.+)$/i);
    if (reviseMatch) {
      const taskId = reviseMatch[2].trim();
      const instruction = reviseMatch[3].trim();
      console.log(pc.cyan(`\nMenerapkan revisi pada naskah ${taskId}...`));
      try {
        await reviseTask(taskId, instruction);
        console.log(pc.green(`✔ Revisi selesai dan file baru tersimpan di ~/Documents!\n`));
      } catch (err) {
        logger.error(`Gagal: ${String(err)}`);
      }
      continue;
    }

    // Direct autorevise trigger: /autorevise <taskId>
    const autoReviseMatch = trimmed.match(/^\/autorevise\s+(\S+)$/i);
    if (autoReviseMatch) {
      const taskId = autoReviseMatch[1].trim();
      console.log(pc.cyan(`\nMenjalankan Auto-Revise cerdas untuk tugas ${taskId}...`));
      try {
        await autoReviseTask(taskId);
        console.log(pc.green(`✔ Dokumen selesai direvisi berdasarkan peer-review di ~/Documents!\n`));
      } catch (err) {
        logger.error(`Gagal: ${String(err)}`);
      }
      continue;
    }

    // /buat trigger from discussion
    if (trimmed === '/buat' || trimmed === '/generate') {
      if (!lastTopic) {
        console.log(pc.yellow('Belum ada topik yang dibahas. Gunakan: /plan <topik> atau /makalah <topik>\n'));
        continue;
      }
      console.log(pc.cyan(`\nMengeksekusi pembuatan dokumen dari topik: "${lastTopic}"...`));
      const state = initCheckpoint(lastTopic, 'makalah');
      try {
        const finalState = await runTaskPipeline(state, {
          preset: 'academic-all',
          customChapters: lastPlanChapters.length > 0 ? lastPlanChapters : undefined,
        });
        const md = exportToMarkdown(finalState);
        const docx = await exportToDocx(finalState);
        const slides = exportToMarpSlide(finalState);
        const bib = exportToBibtex(finalState);
        let pptx: string | undefined;
        try { pptx = await exportToPptx(finalState); } catch {}
        copyToDocuments(finalState, { docx, md, html: slides.htmlPath, bib, pptx });
        console.log(pc.green(`✔ Naskah selesai dan tersimpan di ~/Documents/!\n`));
      } catch (err) {
        logger.error(`Gagal: ${String(err)}`);
      }
      continue;
    }

    // Direct pipeline triggers with optional --bab flag: /makalah, /skripsi, /slide, /lit
    const cmdMatch = trimmed.match(/^\/(makalah|skripsi|slide|presentasi|lit-review)\s+(.+)$/i);
    if (cmdMatch) {
      const rawType = cmdMatch[1].toLowerCase();
      let argString = cmdMatch[2].trim();
      const taskType: TaskType = rawType === 'slide' ? 'presentasi' : (rawType as TaskType);

      // Check optional --bab N
      let chapterCount: number | undefined;
      const babMatch = argString.match(/--bab\s+(\d+)/i);
      if (babMatch) {
        chapterCount = parseInt(babMatch[1], 10);
        argString = argString.replace(/--bab\s+\d+/i, '').trim();
      }

      const topic = argString;
      lastTopic = topic;

      console.log(pc.cyan(`\nMemulai otomasi ${taskType.toUpperCase()} untuk: "${topic}" ${chapterCount ? `(${chapterCount} Bab)` : ''}...`));
      const state = initCheckpoint(topic, taskType);
      try {
        const finalState = await runTaskPipeline(state, {
          preset: 'academic-all',
          chapterCount,
        });
        const md = exportToMarkdown(finalState);
        const docx = await exportToDocx(finalState);
        const slides = exportToMarpSlide(finalState);
        const bib = exportToBibtex(finalState);
        let pptx: string | undefined;
        try {
          pptx = await exportToPptx(finalState);
        } catch {}
        const downloaded = copyToDocuments(finalState, {
          docx,
          md,
          html: slides.htmlPath,
          bib,
          pptx,
        });

        console.log(pc.green(`\n✔ Berhasil disusun!`));
        console.log(`- Word DOCX: ${docx}`);
        console.log(`- BibTeX: ${bib}`);
        console.log(`- Slide Deck: ${slides.htmlPath}`);
        console.log(`- Markdown: ${md}`);
        if (downloaded.length > 0) {
          console.log(pc.green(`- Tersimpan di ~/Documents:`));
          for (const f of downloaded) {
            console.log(pc.dim(`  -> ${f}`));
          }
        }
        console.log('');
      } catch (err) {
        logger.error(`Gagal: ${String(err)}`);
      }
      continue;
    }

    // Conversational academic advice
    history.push({ role: 'user', content: trimmed });
    const conversationContext = history
      .slice(-6)
      .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n\n');

    process.stdout.write(pc.cyan('TGSDORK > ') + pc.dim('menganalisis...\r'));

    try {
      const reply = await generateText({
        prompt: conversationContext,
        systemPrompt,
        role: 'writer',
      });

      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      console.log(pc.cyan('TGSDORK > ') + reply + '\n');
      history.push({ role: 'assistant', content: reply });

      // Heuristic: capture topic candidate if user talks about a topic
      if (trimmed.length > 15 && !trimmed.startsWith('/')) {
        lastTopic = trimmed;
      }
    } catch (err) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.log(pc.red(`TGSDORK > Gagal merespon: ${String(err)}\n`));
    }
  }
}
