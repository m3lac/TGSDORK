/* TGSDORK Bilingual (EN/ID) + 3D Scroll-Scrubbing & Interactive Tilt Controller */
(function () {
  const I18N = {
    en: {
      skip_link: 'Skip to main content',
      nav_pipeline: 'Pipeline',
      nav_samples: 'Output',
      nav_compare: 'Why TGSDORK',
      nav_open_studio: 'Open Studio',
      hero_badge: 'TGSDORK Research Studio',
      hero_title_1: 'From research topic to',
      hero_title_highlight: 'verified manuscript',
      hero_sub:
        'Automated Google Dorking across academic PDF repositories, locked real citations, and instant DOCX & PowerPoint export.',
      hero_input_label: 'Research topic or paper title',
      hero_placeholder: 'Enter your paper, thesis, or research topic...',
      hero_cta: 'Start Research',
      chips_label: 'Try topic:',
      chip_1: 'Medical Vision Transformer',
      chip_1_fill: 'Lung X-Ray Classification with Vision Transformer',
      chip_2: 'QRIS FinTech Adoption',
      chip_2_fill: 'Digital Payment QRIS Adoption in Culinary SMEs',
      chip_3: 'Project-Based Learning',
      chip_3_fill: 'Project-Based Learning Impact on Science Literacy',
      pipe_eyebrow: 'HOW THE STUDIO WORKS',
      pipe_heading: 'Not a generic text generator — a pipeline grounded in real papers.',
      pipe_sub: 'Click any stage to inspect how your topic turns into a submission-ready academic package.',
      step1_title: 'Academic Google Dorking',
      step1_desc:
        'Builds targeted Dork queries across university repositories (<code>.edu</code>, <code>.ac.id</code>), Scholar, &amp; peer-reviewed PDFs.',
      step2_title: 'PDF Extraction & Citation Lock',
      step2_badge: 'Verified XML',
      step2_desc:
        'Parses full-text PDFs and locks verified authors &amp; years inside <code>&lt;verified_sources&gt;</code>.',
      step3_title: 'Drafting & Quality Audit',
      step3_badge: 'Audit & Turnitin',
      step3_desc:
        'Writes structured chapters, audits methodology rigor, and rewrites high-similarity sentences.',
      step4_title: 'Submission-Ready Export',
      step4_desc:
        'Downloads formatted Word manuscripts, Literature Review matrices, and PowerPoint decks with speaker notes.',
      pane2_pill: 'Citations Locked',
      pane2_guard_title: 'Zero Fabricated References',
      pane2_guard_desc:
        'The writer pipeline is strictly bound to extracted journal metadata and cannot invent authors or years.',
      pane3_score_lbl: 'Academic Quality Score',
      pane3_score_pill: 'Complete Chapter Rigor',
      pane3_sim_lbl: 'Similarity Estimate',
      pane3_sim_pill: 'Threshold < 20%',
      pane3_before_tag: 'Raw Draft',
      pane3_before_text:
        'Vision Transformer method is proven to be more accurate than standard CNN for detecting lung diseases.',
      pane3_after_tag: 'Academic Paraphrase',
      pane3_after_text:
        'Self-attention mechanisms within Vision Transformer architectures demonstrate superior thoracic pathology classification compared to conventional convolutional networks (Pratama &amp; Santoso, 2024).',
      pane4_docx_sub: 'Chapters I–III + Literature Matrix + APA 7th Bibliography',
      pane4_pptx_sub: '12 Clean Slides + Presenter Speaker Notes per Slide',
      pane4_pdf_sub: 'Comparative table of findings, methods, and research gaps',
      btn_open: 'Open',
      btn_archive: 'Archive',
      sample_eyebrow: 'ARTIFACT PREVIEW',
      sample_heading: 'Sample Manuscript & Slide Deck',
      sample_sub: 'Standardized academic formatting and presentation slides with speaker notes.',
      sample_tab_paper: 'Manuscript (.docx)',
      sample_tab_pptx: 'PowerPoint (.pptx)',
      paper_badge: 'A4 • University Standard',
      paper_page: 'Page 1',
      paper_title: "Impact of Project-Based Learning Models on Students' Critical Thinking Skills",
      paper_author: 'Nadia Putri • Department of Educational Technology',
      paper_abs_label: 'ABSTRACT',
      paper_abs_body:
        "This study examines the effectiveness of project-based learning in enhancing students' analytical reasoning. Using a quasi-experimental design with 72 students, evaluation results demonstrate a statistically significant improvement in the experimental group. These findings confirm that contextualized project assignments strengthen autonomous problem-solving.",
      paper_keywords:
        '<strong>Keywords:</strong> Critical thinking, project-based learning, learning outcome evaluation.',
      paper_ch1_title: 'CHAPTER I: INTRODUCTION',
      paper_ch1_body:
        'Modern educational demands position critical thinking as a foundational competency. Empirical reviews indicate that one-way instructional methods rarely provide sufficient space for collaborative problem exploration (Suryadi & Wijaya, 2023). Consequently, project-based interventions are implemented to bridge theoretical concepts with authentic case studies.',
      slide_title: 'Literature Review & Research Gap',
      slide_pt1: "Passive instructional dominance limits students' analytical reasoning depth.",
      slide_pt2: 'Prior studies emphasize formative evaluation grounded in real project artifacts.',
      slide_pt3: 'Research gap: Limited quasi-experimental validation across current curriculum standards.',
      slide_notes_tag: 'Presenter Notes:',
      slide_notes_body:
        '"Distinguished examiners, on this slide we outline the rationale behind selecting a project-based intervention. The primary challenge lies in low active learner engagement when formulating independent solutions..."',
      cmp_eyebrow: 'WHY TGSDORK',
      cmp_heading: 'Built for academic rigor, not generic chat responses.',
      cmp_sub: 'See how a dedicated Dorking & citation-locked pipeline compares to ordinary AI chat tools.',
      cmp_old_tag: 'Standard AI Chatbots',
      cmp_old_badge: 'Unverified',
      cmp_old_title: 'Manual Prompting & Copy-Paste',
      cmp_old_1: 'Invents fake author names, years, and non-existent DOIs.',
      cmp_old_2: 'Cannot scrape full-text university PDF repositories directly.',
      cmp_old_3: 'Produces unstructured walls of text requiring hours of Word & slide formatting.',
      cmp_old_4: 'No chapter-level quality audit or Turnitin similarity paraphrasing.',
      cmp_new_badge: 'Source-Locked',
      cmp_new_title: 'End-to-End Academic Pipeline',
      cmp_new_1: 'Automated Google Dorking across <code>.ac.id</code>, <code>.edu</code>, Garuda, &amp; Scholar PDFs.',
      cmp_new_2: 'Every in-text citation and bibliography entry locked to <code>&lt;verified_sources&gt;</code>.',
      cmp_new_3: 'Instant export to formatted <code>.docx</code> manuscripts, <code>.pdf</code> matrices, &amp; <code>.pptx</code> slides.',
      cmp_new_4: 'Built-in Academic Audit, Literature Review Matrix, &amp; similarity paraphraser.',
      cmp_cta_primary: 'Launch Studio',
      cmp_cta_secondary: 'Slide Generator',
      foot_generate: 'Manuscript',
      foot_review: 'Audit',
      foot_turnitin: 'Similarity',
      foot_pptx: 'PowerPoint',
      foot_archive: 'Archive',
    },
    id: {
      skip_link: 'Lewati ke konten utama',
      nav_pipeline: 'Alur Kerja',
      nav_samples: 'Contoh Hasil',
      nav_compare: 'Keunggulan',
      nav_open_studio: 'Buka Studio',
      hero_badge: 'TGSDORK Studio Riset',
      hero_title_1: 'Dari topik riset ke',
      hero_title_highlight: 'naskah terverifikasi',
      hero_sub:
        'Otomasi Google Dorking jurnal PDF akademik, penguncian sitasi nyata, serta ekspor instan ke dokumen DOCX & PowerPoint.',
      hero_input_label: 'Topik atau judul penelitian',
      hero_placeholder: 'Ketik judul makalah, skripsi, atau topik riset...',
      hero_cta: 'Mulai Riset',
      chips_label: 'Coba topik:',
      chip_1: 'Vision Transformer Medis',
      chip_1_fill: 'Klasifikasi Citra X-Ray Paru dengan Vision Transformer',
      chip_2: 'Adopsi QRIS UMKM',
      chip_2_fill: 'Adopsi Pembayaran Digital QRIS pada UMKM Kuliner',
      chip_3: 'Project-Based Learning',
      chip_3_fill: 'Pengaruh Project-Based Learning terhadap Literasi Sains',
      pipe_eyebrow: 'CARA KERJA STUDIO',
      pipe_heading: 'Bukan sekadar generator teks — alur riset yang melacak jurnal asli.',
      pipe_sub: 'Klik tahapan untuk melihat bagaimana topik Anda diproses menjadi paket naskah akademik siap kumpul.',
      step1_title: 'Google Dorking Akademik',
      step1_desc:
        'Meracik kueri Dork terarah ke repositori kampus (<code>.edu</code>, <code>.ac.id</code>), Scholar, &amp; jurnal PDF.',
      step2_title: 'Ekstraksi PDF & Kunci Sitasi',
      step2_badge: 'XML Terverifikasi',
      step2_desc:
        'Membaca teks lengkap PDF dan mengunci nama penulis serta tahun di blok <code>&lt;verified_sources&gt;</code>.',
      step3_title: 'Penyusunan & Audit Mutu',
      step3_badge: 'Audit & Turnitin',
      step3_desc:
        'Menyusun bab terstruktur, mengaudit ketajaman metodologi, dan memparafrase kalimat berisiko kemiripan tinggi.',
      step4_title: 'Ekspor Siap Kumpul',
      step4_desc:
        'Unduh naskah Word rapi, tabel matriks literatur, hingga salindia PowerPoint lengkap catatan pemateri.',
      pane2_pill: 'Sitasi Dikunci',
      pane2_guard_title: 'Tanpa Referensi Fiktif',
      pane2_guard_desc:
        'Pipeline penulis dikunci ketat pada metadata jurnal yang diekstrak dan dilarang mengarang sitasi.',
      pane3_score_lbl: 'Skor Mutu Akademik',
      pane3_score_pill: 'Struktur Bab Lengkap',
      pane3_sim_lbl: 'Estimasi Kemiripan',
      pane3_sim_pill: 'Batas Aman < 20%',
      pane3_before_tag: 'Draf Mentah',
      pane3_before_text:
        'Metode Vision Transformer terbukti lebih akurat dibandingkan CNN biasa untuk mendeteksi penyakit paru.',
      pane3_after_tag: 'Parafrase Ilmiah',
      pane3_after_text:
        'Mekanisme <em>self-attention</em> pada arsitektur Vision Transformer menunjukkan performa klasifikasi patologi toraks yang lebih unggul dibandingkan jaringan konvolusional konvensional (Pratama &amp; Santoso, 2024).',
      pane4_docx_sub: 'Bab I–III + Matriks Literatur + Daftar Pustaka APA 7th',
      pane4_pptx_sub: '12 Salindia Bersih + Catatan Pembicara per Slide',
      pane4_pdf_sub: 'Tabel komparasi temuan, metode, dan celah riset',
      btn_open: 'Buka',
      btn_archive: 'Arsip',
      sample_eyebrow: 'PRATINJAU HASIL',
      sample_heading: 'Contoh Naskah & Salindia Presentasi',
      sample_sub: 'Format penulisan akademik standar kampus dan salindia lengkap catatan pemateri.',
      sample_tab_paper: 'Makalah (.docx)',
      sample_tab_pptx: 'PowerPoint (.pptx)',
      paper_badge: 'A4 • Standar Kampus',
      paper_page: 'Hal. 1',
      paper_title: 'Penerapan Model Pembelajaran Berbasis Proyek terhadap Keterampilan Berpikir Kritis Siswa',
      paper_author: 'Nadia Putri • Program Studi Teknologi Pendidikan',
      paper_abs_label: 'ABSTRAK',
      paper_abs_body:
        'Penelitian ini menguji efektivitas pembelajaran berbasis proyek terhadap peningkatan penalaran analitis peserta didik. Menggunakan desain kuasi-eksperimen pada 72 siswa, hasil evaluasi menunjukkan peningkatan signifikan pada kelompok eksperimen. Temuan ini menegaskan bahwa penugasan kontekstual memperkuat kemandirian pemecahan masalah.',
      paper_keywords:
        '<strong>Kata Kunci:</strong> Berpikir kritis, pembelajaran berbasis proyek, evaluasi hasil belajar.',
      paper_ch1_title: 'BAB I: PENDAHULUAN',
      paper_ch1_body:
        'Tuntutan pendidikan modern menempatkan berpikir kritis sebagai kompetensi dasar. Tinjauan empiris menunjukkan metode instruksional satu arah jarang memberi ruang eksplorasi masalah kolaboratif (Suryadi & Wijaya, 2023). Oleh karena itu, intervensi berbasis proyek diterapkan untuk menjembatani teori dengan studi kasus nyata.',
      slide_title: 'Kajian Literatur & Kesenjangan Riset',
      slide_pt1: 'Dominasi pengajaran pasif membatasi kedalaman penalaran analitis siswa.',
      slide_pt2: 'Studi terdahulu menekankan evaluasi formatif berbasis artefak proyek nyata.',
      slide_pt3: 'Celah riset: Minimnya validasi kuasi-eksperimen pada kurikulum terbaru.',
      slide_notes_tag: 'Catatan Pemateri:',
      slide_notes_body:
        '"Bapak/Ibu penguji, pada salindia ini kami memaparkan alasan pemilihan intervensi berbasis proyek. Tantangan utama terletak pada rendahnya keterlibatan aktif peserta didik saat merumuskan solusi mandiri..."',
      cmp_eyebrow: 'KEUNGGULAN TGSDORK',
      cmp_heading: 'Dirancang untuk standar akademik, bukan sekadar obrolan AI biasa.',
      cmp_sub: 'Bandingkan alur Dorking & penguncian sitasi dengan chatbot AI umum.',
      cmp_old_tag: 'Chatbot AI Biasa',
      cmp_old_badge: 'Tanpa Verifikasi',
      cmp_old_title: 'Prompt Manual & Salin-Tempel',
      cmp_old_1: 'Sering mengarang nama penulis, tahun terbit, dan DOI fiktif.',
      cmp_old_2: 'Tidak bisa mengekstrak langsung repositori PDF kampus.',
      cmp_old_3: 'Menghasilkan teks mentah yang butuh berjam-jam dirapikan di Word & PowerPoint.',
      cmp_old_4: 'Tidak ada audit mutu per bab maupun parafrase uji kemiripan Turnitin.',
      cmp_new_badge: 'Sumber Terkunci',
      cmp_new_title: 'Alur Riset Akademik Terpadu',
      cmp_new_1: 'Google Dorking otomatis ke jurnal PDF <code>.ac.id</code>, <code>.edu</code>, Garuda, &amp; Scholar.',
      cmp_new_2: 'Setiap sitasi kalimat dan daftar pustaka dikunci ke <code>&lt;verified_sources&gt;</code>.',
      cmp_new_3: 'Ekspor instan ke naskah <code>.docx</code> rapi, matriks <code>.pdf</code>, &amp; salindia <code>.pptx</code>.',
      cmp_new_4: 'Dilengkapi Audit Mutu Akademik, Matriks Literatur, &amp; parafrase kemiripan.',
      cmp_cta_primary: 'Buka Studio',
      cmp_cta_secondary: 'Generator Salindia',
      foot_generate: 'Susun Naskah',
      foot_review: 'Audit',
      foot_turnitin: 'Kemiripan',
      foot_pptx: 'PowerPoint',
      foot_archive: 'Arsip',
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Bilingual Switcher (EN / ID)
    const langBtns = document.querySelectorAll('[data-lang-switch]');
    const htmlContainKeys = new Set([
      'step1_desc',
      'step2_desc',
      'pane3_after_text',
      'paper_keywords',
      'cmp_new_1',
      'cmp_new_2',
      'cmp_new_3',
      'cmp_new_4',
    ]);

    function applyLanguage(lang) {
      const dict = I18N[lang] || I18N.en;
      document.documentElement.lang = lang;

      langBtns.forEach((btn) => {
        const isActive = btn.getAttribute('data-lang-switch') === lang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!key || !(key in dict)) return;
        if (htmlContainKeys.has(key)) {
          el.innerHTML = dict[key];
        } else {
          el.textContent = dict[key];
        }
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key && dict[key]) {
          el.setAttribute('placeholder', dict[key]);
        }
      });

      // Update topic chips fill values
      const chip1 = document.querySelector('[data-i18n="chip_1"]');
      const chip2 = document.querySelector('[data-i18n="chip_2"]');
      const chip3 = document.querySelector('[data-i18n="chip_3"]');
      if (chip1 && dict.chip_1_fill) chip1.setAttribute('data-fill-topic', dict.chip_1_fill);
      if (chip2 && dict.chip_2_fill) chip2.setAttribute('data-fill-topic', dict.chip_2_fill);
      if (chip3 && dict.chip_3_fill) chip3.setAttribute('data-fill-topic', dict.chip_3_fill);

      try {
        window.localStorage.setItem('tgsdork_lang', lang);
      } catch (_) {}
    }

    let initialLang = 'en';
    try {
      const saved = window.localStorage.getItem('tgsdork_lang');
      if (saved === 'id' || saved === 'en') initialLang = saved;
    } catch (_) {}
    applyLanguage(initialLang);

    langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang-switch');
        if (lang) applyLanguage(lang);
      });
    });

    // 2. Quick Topic Chips -> fill input & focus
    const topicInput = document.getElementById('lpTopicInput');
    document.querySelectorAll('[data-fill-topic]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-fill-topic');
        if (topicInput && text) {
          topicInput.value = text;
          topicInput.focus();
        }
      });
    });

    // 3. Interactive 4-Step Pipeline Showcase
    const stepBtns = Array.from(document.querySelectorAll('[data-step-target]'));
    const stepPanes = document.querySelectorAll('.lp-step-pane');
    const chromeStatus = document.getElementById('lpChromeStatus');
    const shell = document.getElementById('lpPipelineShell');

    const statusMap = {
      'step-dork': 'tgsdork://dorker/search?preset=global-scholar',
      'step-extract': 'tgsdork://extractor/pdf-verify?lock=verified_sources',
      'step-audit': 'tgsdork://pipelines/audit-turnitin?score=92',
      'step-export': 'tgsdork://exporter/bundle?formats=docx,pptx,pdf',
    };

    let currentIdx = 0;
    let timerId = null;
    let isPaused = false;
    let typeTimer = null;
    const dorkCodeEl = document.getElementById('lpDorkTypewriter');
    const dorkFullText = dorkCodeEl ? dorkCodeEl.textContent.trim() : '';

    function runDorkTypewriter() {
      if (!dorkCodeEl || !dorkFullText) return;
      clearInterval(typeTimer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dorkCodeEl.textContent = dorkFullText;
        return;
      }
      dorkCodeEl.textContent = '';
      let charIdx = 0;
      typeTimer = window.setInterval(() => {
        charIdx += 2;
        dorkCodeEl.textContent = dorkFullText.slice(0, charIdx);
        if (charIdx >= dorkFullText.length) {
          clearInterval(typeTimer);
          typeTimer = null;
        }
      }, 18);
    }

    function runAuditCounters() {
      document.querySelectorAll('#step-audit [data-count-to]').forEach((el) => {
        const target = parseInt(el.getAttribute('data-count-to') || '0', 10);
        const suffix = el.getAttribute('data-count-suffix') || '';
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          el.textContent = `${target}${suffix}`;
          return;
        }
        const start = performance.now();
        const duration = 620;
        function tick(now) {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${Math.round(target * eased)}${suffix}`;
          if (p < 1) window.requestAnimationFrame(tick);
        }
        window.requestAnimationFrame(tick);
      });
    }

    function activateStep(targetId) {
      stepBtns.forEach((btn, idx) => {
        const isMatch = btn.getAttribute('data-step-target') === targetId;
        if (isMatch) currentIdx = idx;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });

      stepPanes.forEach((pane) => {
        const isMatch = pane.id === targetId;
        pane.classList.toggle('active', isMatch);
        if (isMatch) pane.removeAttribute('hidden');
        else pane.setAttribute('hidden', '');
      });

      if (chromeStatus && statusMap[targetId]) {
        chromeStatus.textContent = statusMap[targetId];
      }
      if (targetId === 'step-dork') runDorkTypewriter();
      if (targetId === 'step-audit') runAuditCounters();
    }
    function startCycle() {
      stopCycle();
      timerId = window.setInterval(() => {
        if (isPaused || !stepBtns.length) return;
        const nextIdx = (currentIdx + 1) % stepBtns.length;
        const target = stepBtns[nextIdx].getAttribute('data-step-target');
        if (target) activateStep(target);
      }, 5200);
    }

    function stopCycle() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    stepBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-step-target');
        if (target) {
          activateStep(target);
          startCycle();
        }
      });
    });

    if (shell) {
      shell.addEventListener('mouseenter', () => {
        isPaused = true;
        shell.classList.add('paused');
      });
      shell.addEventListener('mouseleave', () => {
        isPaused = false;
        shell.classList.remove('paused');
      });
    }
    runDorkTypewriter();
    startCycle();
    // 4. Output Sample Tabs switcher
    const sampleTabs = document.querySelectorAll('[data-sample-tab]');
    sampleTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-sample-tab');
        sampleTabs.forEach((b) => {
          const isMatch = b === btn;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
        document.querySelectorAll('.lp-sample-pane').forEach((pane) => {
          const isMatch = pane.id === target;
          pane.classList.toggle('active', isMatch);
          if (isMatch) pane.removeAttribute('hidden');
          else pane.setAttribute('hidden', '');
        });
      });
    });

    // 5. Crisp Mouse Spotlight (Zero Text Blur)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      document.querySelectorAll('[data-spotlight]').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--glare-x', `${((x / rect.width) * 100).toFixed(1)}%`);
          card.style.setProperty('--glare-y', `${((y / rect.height) * 100).toFixed(1)}%`);
          card.style.setProperty('--glare-opacity', '1');
        });
        card.addEventListener('mouseleave', () => {
          card.style.setProperty('--glare-opacity', '0');
        });
      });

      // 6. Scroll-Scrubbed Progress Bar & Crisp 3D Wireframe Knowledge Polyhedron Canvas
      const scrollBar = document.getElementById('lpScrollBar');
      const canvas = document.getElementById('lp3DCanvas');
      let scrollRatio = 0;
      let mouseX = 0;
      let mouseY = 0;

      function updateScrollProgress() {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollRatio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        if (scrollBar) {
          scrollBar.style.width = `${(scrollRatio * 100).toFixed(2)}%`;
        }
      }

      window.addEventListener('scroll', updateScrollProgress, { passive: true });
      window.addEventListener(
        'mousemove',
        (e) => {
          mouseX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 0.6;
          mouseY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 0.6;
        },
        { passive: true }
      );
      updateScrollProgress();

      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        const phi = (1 + Math.sqrt(5)) / 2;
        const rawVerts = [
          [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
          [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
          [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
        ];
        const edges = [];
        for (let i = 0; i < rawVerts.length; i++) {
          for (let j = i + 1; j < rawVerts.length; j++) {
            const dx = rawVerts[i][0] - rawVerts[j][0];
            const dy = rawVerts[i][1] - rawVerts[j][1];
            const dz = rawVerts[i][2] - rawVerts[j][2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 2.15) edges.push([i, j]);
          }
        }

        let width = 0;
        let height = 0;
        function resizeCanvas() {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          width = canvas.clientWidth || window.innerWidth;
          height = canvas.clientHeight || 420;
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas, { passive: true });

        let baseAngle = 0;
        function render3D() {
          baseAngle += 0.0035;
          const rx = baseAngle + scrollRatio * Math.PI * 2.2 + mouseY;
          const ry = baseAngle * 1.3 + scrollRatio * Math.PI * 3.0 + mouseX;
          const cx = width * 0.5;
          const cy = height * 0.48;
          const radius = Math.min(width, height) * 0.36;

          ctx.clearRect(0, 0, width, height);

          const projected = rawVerts.map(([vx, vy, vz]) => {
            // Rotate Y
            const x1 = vx * Math.cos(ry) - vz * Math.sin(ry);
            const z1 = vz * Math.cos(ry) + vx * Math.sin(ry);
            // Rotate X
            const y2 = vy * Math.cos(rx) - z1 * Math.sin(rx);
            const z2 = z1 * Math.cos(rx) + vy * Math.sin(rx);
            const perspective = 4.2 / (4.2 - z2 * 0.45);
            return {
              x: cx + x1 * radius * perspective * 0.55,
              y: cy + y2 * radius * perspective * 0.55,
              z: z2,
            };
          });

          ctx.lineWidth = 1;
          edges.forEach(([a, b]) => {
            const pa = projected[a];
            const pb = projected[b];
            const depthAlpha = Math.max(0.04, Math.min(0.22, (pa.z + pb.z + 4) / 28));
            ctx.strokeStyle = `rgba(56, 189, 248, ${depthAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          });

          projected.forEach((p, idx) => {
            const dotAlpha = Math.max(0.15, Math.min(0.65, (p.z + 2.5) / 5));
            ctx.fillStyle = idx % 3 === 0 ? `rgba(255, 46, 147, ${dotAlpha.toFixed(2)})` : `rgba(125, 211, 252, ${dotAlpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          });

          window.requestAnimationFrame(render3D);
        }
        window.requestAnimationFrame(render3D);
      }
    }
  });
})();
