import { FAVICON_B64 } from './favicon.js';

export function renderLandingHtml(devUiMode = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#090a0f" />
  <meta name="description" content="TGSDORK — Automated Academic Research &amp; Manuscript Studio based on Google Dorking and AI." />
  <meta name="keywords" content="tgsdork, google dorking, riset akademik, makalah ai, skripsi ai, literature review, academic search, dorking studio" />
  <meta name="robots" content="index, follow" />
  <title>TGSDORK — Academic Research &amp; Manuscript Studio</title>
  <link rel="canonical" href="https://tgsdork.com/" />
  <meta property="og:site_name" content="TGSDORK" />
  <meta property="og:title" content="TGSDORK — Academic Research &amp; Manuscript Studio" />
  <meta property="og:description" content="Automated Academic Research &amp; Manuscript Studio based on Google Dorking and AI." />
  <meta property="og:url" content="https://tgsdork.com/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="TGSDORK — Academic Research &amp; Manuscript Studio" />
  <meta name="twitter:description" content="Automated Academic Research &amp; Manuscript Studio based on Google Dorking and AI." />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "TGSDORK",
    "url": "https://tgsdork.com",
    "description": "Automated Academic Research & Manuscript Studio based on Google Dorking and AI.",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "All"
  }
  </script>
  <link rel="icon" type="image/png" href="data:image/png;base64,${FAVICON_B64}" />
  <link rel="apple-touch-icon" href="data:image/png;base64,${FAVICON_B64}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/public/styles.css?v=20261112_02" />
  <link rel="stylesheet" href="/public/landing.css?v=20261112_01" />
</head>
<body class="landing-body">
  <a href="#mainLanding" class="skip-link" data-i18n="skip_link">Skip to main content</a>

  <div class="lp-scroll-progress" aria-hidden="true"><span id="lpScrollBar"></span></div>
  <!-- HEADER WITH LANGUAGE SWITCHER (EN / ID) -->
  <header class="lp-header">
    <div class="lp-container lp-nav">
      <a href="/" class="lp-brand" aria-label="TGSDORK Home">
        <span class="brand-orb">
          <img src="data:image/png;base64,${FAVICON_B64}" alt="TGSDORK Logo" />
        </span>
        <span class="lp-brand-name">TGSDORK</span>
      </a>

      <nav class="lp-nav-links" aria-label="Primary Navigation">
        <a href="#alur" data-i18n="nav_pipeline">Pipeline</a>
        <a href="#contoh" data-i18n="nav_samples">Output</a>
        <a href="#compare" data-i18n="nav_compare">Why TGSDORK</a>
        <a href="#contact" data-i18n="nav_contact">Contact</a>
      </nav>

      <div class="lp-nav-actions">
        <div class="lp-lang-switch" role="group" aria-label="Language Switcher">
          <button type="button" class="lp-lang-btn active" data-lang-switch="en" aria-pressed="true">EN</button>
          <button type="button" class="lp-lang-btn" data-lang-switch="id" aria-pressed="false">ID</button>
        </div>

        <a href="/studio" class="btn-pill btn-white" id="lpNavStudioBtn">
          <span data-i18n="nav_open_studio">Open Studio</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
        </a>
      </div>
    </div>
  </header>

  <main id="mainLanding">
    <!-- HERO STAGE WITH INTERACTIVE 3D KNOWLEDGE POLYHEDRON CANVAS -->
    <section class="lp-hero" id="lpHeroSection">
      <canvas id="lp3DCanvas" class="lp-3d-canvas" aria-hidden="true"></canvas>
      <div class="lp-grid-mask" aria-hidden="true"></div>

      <div class="lp-container lp-hero-center" id="lpHeroContent">
        <div class="lp-logo-badge">
          <span class="lp-logo-circle">
            <img src="data:image/png;base64,${FAVICON_B64}" alt="TGSDORK Logo" />
          </span>
          <span data-i18n="hero_badge">TGSDORK Research Studio</span>
          <span class="lp-live-dot" aria-hidden="true"></span>
        </div>

        <h1 class="lp-hero-title">
          <span data-i18n="hero_title_1">From research topic to</span>
          <span class="lp-text-gradient" data-i18n="hero_title_highlight">verified manuscript.</span>
        </h1>
        <p class="lp-hero-sub" data-i18n="hero_sub">
          Automated Google Dorking across academic PDF repositories, locked real citations, and instant DOCX &amp; PowerPoint export.
        </p>

        <form class="lp-launcher" id="lpTopicForm" action="/studio" method="get">
          <input type="hidden" name="tab" value="generate" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path stroke-linecap="round" d="M20 20l-4-4"/></svg>
          <label for="lpTopicInput" class="sr-only" data-i18n="hero_input_label">Research topic or paper title</label>
          <input
            type="text"
            id="lpTopicInput"
            name="topic"
            placeholder="Enter your paper, thesis, or research topic..."
            data-i18n-placeholder="hero_placeholder"
            autocomplete="off"
          />
          <button type="submit" class="btn-pill btn-hot-pink">
            <span data-i18n="hero_cta">Start Research</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
          </button>
        </form>

        <div class="lp-topic-chips" aria-label="Quick topic examples">
          <span class="lp-chip-label" data-i18n="chips_label">Try topic:</span>
          <button type="button" class="lp-topic-chip" data-fill-topic="Lung X-Ray Classification with Vision Transformer" data-i18n="chip_1">Medical Vision Transformer</button>
          <button type="button" class="lp-topic-chip" data-fill-topic="Digital Payment QRIS Adoption in Culinary SMEs" data-i18n="chip_2">QRIS FinTech Adoption</button>
          <button type="button" class="lp-topic-chip" data-fill-topic="Project-Based Learning Impact on Science Literacy" data-i18n="chip_3">Project-Based Learning</button>
        </div>
      </div>
    </section>

    <!-- 3D SCROLL-SCRUBBED INTERACTIVE PIPELINE SHOWCASE -->
    <section id="alur" class="lp-pipeline-section">
      <div class="lp-container">
        <div class="lp-section-head">
          <div>
            <span class="lp-eyebrow" data-i18n="pipe_eyebrow">HOW THE STUDIO WORKS</span>
            <h2 data-i18n="pipe_heading">Not a generic text generator — a pipeline grounded in real papers.</h2>
          </div>
          <p class="lp-section-sub" data-i18n="pipe_sub">Click any stage to inspect how your topic turns into a submission-ready academic package.</p>
        </div>

        <div class="lp-pipeline-shell" id="lpPipelineShell" data-spotlight>
          <div class="lp-glare" aria-hidden="true"></div>
            <div class="lp-pipeline-steps" role="tablist" aria-label="Research pipeline stages">
              <button type="button" role="tab" aria-selected="true" class="lp-step-card active" data-step-target="step-dork">
                <div class="lp-step-top">
                  <span class="lp-step-num">01</span>
                  <span class="lp-step-title" data-i18n="step1_title">Academic Google Dorking</span>
                  <span class="lp-step-badge sky">Scraper + PDF</span>
                </div>
                <p class="lp-step-desc" data-i18n="step1_desc">Builds targeted Dork queries across university repositories (<code>.edu</code>, <code>.ac.id</code>), Scholar, &amp; peer-reviewed PDFs.</p>
                <div class="lp-step-progress"><span class="lp-step-bar"></span></div>
              </button>

              <button type="button" role="tab" aria-selected="false" class="lp-step-card" data-step-target="step-extract">
                <div class="lp-step-top">
                  <span class="lp-step-num">02</span>
                  <span class="lp-step-title" data-i18n="step2_title">PDF Extraction &amp; Citation Lock</span>
                  <span class="lp-step-badge pink" data-i18n="step2_badge">Verified XML</span>
                </div>
                <p class="lp-step-desc" data-i18n="step2_desc">Parses full-text PDFs and locks verified authors &amp; years inside <code>&lt;verified_sources&gt;</code>.</p>
                <div class="lp-step-progress"><span class="lp-step-bar"></span></div>
              </button>

              <button type="button" role="tab" aria-selected="false" class="lp-step-card" data-step-target="step-audit">
                <div class="lp-step-top">
                  <span class="lp-step-num">03</span>
                  <span class="lp-step-title" data-i18n="step3_title">Drafting &amp; Quality Audit</span>
                  <span class="lp-step-badge sky" data-i18n="step3_badge">Audit &amp; Turnitin</span>
                </div>
                <p class="lp-step-desc" data-i18n="step3_desc">Writes structured chapters, audits methodology rigor, and rewrites high-similarity sentences.</p>
                <div class="lp-step-progress"><span class="lp-step-bar"></span></div>
              </button>

              <button type="button" role="tab" aria-selected="false" class="lp-step-card" data-step-target="step-export">
                <div class="lp-step-top">
                  <span class="lp-step-num">04</span>
                  <span class="lp-step-title" data-i18n="step4_title">Submission-Ready Export</span>
                  <span class="lp-step-badge white">DOCX &bull; PPTX &bull; PDF</span>
                </div>
                <p class="lp-step-desc" data-i18n="step4_desc">Downloads formatted Word manuscripts, Literature Review matrices, and PowerPoint decks with speaker notes.</p>
                <div class="lp-step-progress"><span class="lp-step-bar"></span></div>
              </button>
            </div>

          <!-- Right Live Visual Stage -->
          <div class="lp-pipeline-stage">
            <div class="lp-stage-chrome">
              <div class="lp-chrome-dots" aria-hidden="true"><span></span><span></span><span></span></div>
              <span class="lp-chrome-url" id="lpChromeStatus">tgsdork://dorker/search?preset=global-scholar</span>
              <span class="lp-chrome-pill">Live Pipeline</span>
            </div>
              <!-- STEP 1 PANE: DORKING -->
              <div class="lp-step-pane active" id="step-dork" role="tabpanel">
                <div class="lp-term-box">
                  <div class="lp-term-line">
                    <span class="lp-term-prompt">$</span>
                    <span class="lp-term-cmd">tgsdork dork --topic "Vision Transformer Lung X-Ray" --preset global-scholar</span>
                  </div>
                  <div class="lp-dork-query">
                    <code id="lpDorkTypewriter">site:ac.id OR site:edu filetype:pdf ("Vision Transformer" OR "ViT") ("thorax" OR "lung") after:2022</code><span class="lp-type-caret" aria-hidden="true"></span>
                  </div>
                </div>

                <div class="lp-source-list">
                  <div class="lp-source-item">
                    <span class="lp-pdf-tag">PDF &bull; 1.8 MB</span>
                    <div class="lp-source-meta">
                      <strong>Lung Pathology Classification on X-Ray Using Vision Transformer</strong>
                      <span>jurnal.ugm.ac.id &bull; Pratama &amp; Santoso (2024)</span>
                    </div>
                    <span class="mini-pill sky">96% Match</span>
                  </div>
                  <div class="lp-source-item">
                    <span class="lp-pdf-tag">PDF &bull; 2.4 MB</span>
                    <div class="lp-source-meta">
                      <strong>Comparative Study of CNN and ViT Architectures for Pneumonia Detection</strong>
                      <span>scholar.ui.ac.id &bull; Hidayat et al. (2023)</span>
                    </div>
                    <span class="mini-pill sky">92% Match</span>
                  </div>
                  <div class="lp-source-item">
                    <span class="lp-pdf-tag">HTML &bull; SINTA 2</span>
                    <div class="lp-source-meta">
                      <strong>Multi-Head Attention Optimization on High-Resolution Medical Scans</strong>
                      <span>garuda.kemdikbud.go.id &bull; Lestari &amp; Putra (2024)</span>
                    </div>
                    <span class="mini-pill pink">Indexed</span>
                  </div>
                </div>
              </div>

              <!-- STEP 2 PANE: VERIFIED CITATION EXTRACTION -->
              <div class="lp-step-pane" id="step-extract" role="tabpanel" hidden>
                <div class="lp-xml-card">
                  <div class="lp-xml-head">
                    <span class="lp-xml-tag">&lt;verified_sources&gt;</span>
                    <span class="mini-pill pink" data-i18n="pane2_pill">Citations Locked</span>
                  </div>
                  <pre class="lp-xml-code"><code>&lt;source id="ref_1" citation="(Pratama &amp; Santoso, 2024)"&gt;
  Finding: ViT-B/16 achieved 94.6% accuracy on ChestX-ray14,
  outperforming ResNet-50 baseline (91.2%).
&lt;/source&gt;
&lt;source id="ref_2" citation="(Hidayat et al., 2023)"&gt;
  Finding: Self-attention pre-training reduced false-negative
  rates by 18% on low-contrast lung radiographs.
&lt;/source&gt;</code></pre>
                </div>
                <div class="lp-guard-banner">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <div>
                    <strong data-i18n="pane2_guard_title">Zero Fabricated References</strong>
                    <p data-i18n="pane2_guard_desc">The writer pipeline is strictly bound to extracted journal metadata and cannot invent authors or years.</p>
                  </div>
                </div>
              </div>

              <!-- STEP 3 PANE: DRAFTING & AUDIT -->
              <div class="lp-step-pane" id="step-audit" role="tabpanel" hidden>
                <div class="lp-audit-grid">
                  <div class="lp-audit-box">
                    <span class="lp-audit-lbl" data-i18n="pane3_score_lbl">Academic Quality Score</span>
                    <div class="lp-audit-score"><strong data-count-to="92">92</strong><span>/100</span></div>
                    <div class="lp-audit-meter" aria-hidden="true"><span style="--meter-target: 92%"></span></div>
                    <span class="mini-pill sky" data-i18n="pane3_score_pill">Complete Chapter Rigor</span>
                  </div>
                  <div class="lp-audit-box">
                    <span class="lp-audit-lbl" data-i18n="pane3_sim_lbl">Similarity Estimate</span>
                    <div class="lp-audit-score"><strong data-count-to="11" data-count-suffix="%">11%</strong><span>Turnitin Safe</span></div>
                    <div class="lp-audit-meter pink" aria-hidden="true"><span style="--meter-target: 11%"></span></div>
                    <span class="mini-pill pink" data-i18n="pane3_sim_pill">Threshold &lt; 20%</span>
                  </div>
                </div>
                <div class="lp-diff-card">
                  <div class="lp-diff-row before">
                    <span class="lp-diff-tag" data-i18n="pane3_before_tag">Raw Draft</span>
                    <p data-i18n="pane3_before_text">Vision Transformer method is proven to be more accurate than standard CNN for detecting lung diseases.</p>
                  </div>
                  <div class="lp-diff-row after">
                    <span class="lp-diff-tag" data-i18n="pane3_after_tag">Academic Paraphrase</span>
                    <p data-i18n="pane3_after_text">Self-attention mechanisms within Vision Transformer architectures demonstrate superior thoracic pathology classification compared to conventional convolutional networks (Pratama &amp; Santoso, 2024).</p>
                  </div>
                </div>
              </div>

              <!-- STEP 4 PANE: EXPORT -->
              <div class="lp-step-pane" id="step-export" role="tabpanel" hidden>
                <div class="lp-export-cards">
                  <div class="lp-export-item">
                    <div class="lp-export-icon sky">DOCX</div>
                    <div class="lp-export-info">
                      <strong>Thesis_Manuscript_ViT_Lung.docx</strong>
                      <span data-i18n="pane4_docx_sub">Chapters I–III + Literature Matrix + APA 7th Bibliography</span>
                    </div>
                    <a href="/studio?tab=generate" class="btn-pill btn-white sm" data-i18n="btn_open">Open</a>
                  </div>
                  <div class="lp-export-item">
                    <div class="lp-export-icon pink">PPTX</div>
                    <div class="lp-export-info">
                      <strong>Defense_Presentation_ViT.pptx</strong>
                      <span data-i18n="pane4_pptx_sub">12 Clean Slides + Presenter Speaker Notes per Slide</span>
                    </div>
                    <a href="/studio?tab=pptx" class="btn-pill btn-white sm" data-i18n="btn_open">Open</a>
                  </div>
                  <div class="lp-export-item">
                    <div class="lp-export-icon white">PDF</div>
                    <div class="lp-export-info">
                      <strong>Literature_Review_Matrix.pdf</strong>
                      <span data-i18n="pane4_pdf_sub">Comparative table of findings, methods, and research gaps</span>
                    </div>
                    <a href="/studio?tab=workspace" class="btn-pill btn-white sm" data-i18n="btn_archive">Archive</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </section>

    <!-- 3D OUTPUT SAMPLE PREVIEW SECTION -->
    <section id="contoh" class="lp-sample-section">
      <div class="lp-container">
        <div class="lp-sample-head">
          <div>
            <span class="lp-eyebrow" data-i18n="sample_eyebrow">ARTIFACT PREVIEW</span>
            <h2 data-i18n="sample_heading">Sample Manuscript &amp; Slide Deck</h2>
            <p data-i18n="sample_sub">Standardized academic formatting and presentation slides with speaker notes.</p>
          </div>
          <div class="lp-sample-tabs" role="tablist" aria-label="Select sample format">
            <button type="button" role="tab" aria-selected="true" class="lp-sample-tab active" data-sample-tab="sample-paper" data-i18n="sample_tab_paper">Manuscript (.docx)</button>
            <button type="button" role="tab" aria-selected="false" class="lp-sample-tab" data-sample-tab="sample-pptx" data-i18n="sample_tab_pptx">PowerPoint (.pptx)</button>
          </div>
        </div>

        <div id="lpSampleDeck">
          <!-- Sample Paper Sheet -->
          <div class="lp-sample-pane active" id="sample-paper">
            <div class="sample-paper-sheet" data-spotlight>
              <div class="lp-glare" aria-hidden="true"></div>
              <div class="paper-header-meta">
                <span class="paper-badge" data-i18n="paper_badge">A4 &bull; University Standard</span>
                <span class="paper-page-num" data-i18n="paper_page">Page 1</span>
              </div>
              <h3 class="paper-title" data-i18n="paper_title">Impact of Project-Based Learning Models on Students' Critical Thinking Skills</h3>
              <p class="paper-author" data-i18n="paper_author">Nadia Putri &bull; Department of Educational Technology</p>
              <div class="paper-abstract">
                <strong data-i18n="paper_abs_label">ABSTRACT</strong>
                <p data-i18n="paper_abs_body">This study examines the effectiveness of project-based learning in enhancing students' analytical reasoning. Using a quasi-experimental design with 72 students, evaluation results demonstrate a statistically significant improvement in the experimental group. These findings confirm that contextualized project assignments strengthen autonomous problem-solving.</p>
                <div class="paper-keywords" data-i18n="paper_keywords"><strong>Keywords:</strong> Critical thinking, project-based learning, learning outcome evaluation.</div>
                </div>
                <div class="paper-body-snippet">
                  <h4 data-i18n="paper_ch1_title">CHAPTER I: INTRODUCTION</h4>
                  <p data-i18n="paper_ch1_body">Modern educational demands position critical thinking as a foundational competency. Empirical reviews indicate that one-way instructional methods rarely provide sufficient space for collaborative problem exploration (Suryadi &amp; Wijaya, 2023). Consequently, project-based interventions are implemented to bridge theoretical concepts with authentic case studies.</p>
                </div>
              </div>
            </div>

          <!-- Sample PPTX Deck -->
          <div class="lp-sample-pane" id="sample-pptx" hidden>
            <div class="sample-slide-card" data-spotlight>
              <div class="lp-glare" aria-hidden="true"></div>
              <div class="slide-card-top">
                <span class="slide-num-pill">Slide 03 / 12</span>
                <span class="slide-theme-lbl">Theme: Clean Light</span>
              </div>
                <h3 class="slide-title" data-i18n="slide_title">Literature Review &amp; Research Gap</h3>
                <ul class="slide-points">
                  <li data-i18n="slide_pt1">Passive instructional dominance limits students' analytical reasoning depth.</li>
                  <li data-i18n="slide_pt2">Prior studies emphasize formative evaluation grounded in real project artifacts.</li>
                  <li data-i18n="slide_pt3">Research gap: Limited quasi-experimental validation across current curriculum standards.</li>
                </ul>
              <div class="slide-speaker-notes">
                <span class="speaker-notes-tag" data-i18n="slide_notes_tag">Presenter Notes:</span>
                <p data-i18n="slide_notes_body">"Distinguished examiners, on this slide we outline the rationale behind selecting a project-based intervention. The primary challenge lies in low active learner engagement when formulating independent solutions..."</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3D COMPARISON & WORKFLOW ADVANTAGE (REPLACES OLD MODULES GRID) -->
    <section id="compare" class="lp-compare-section">
      <div class="lp-container">
        <div class="lp-section-head">
          <div>
            <span class="lp-eyebrow" data-i18n="cmp_eyebrow">WHY TGSDORK</span>
            <h2 data-i18n="cmp_heading">Built for academic rigor, not generic chat responses.</h2>
          </div>
          <p class="lp-section-sub" data-i18n="cmp_sub">See how a dedicated Dorking &amp; citation-locked pipeline compares to ordinary AI chat tools.</p>
        </div>

        <div class="lp-compare-grid">
          <!-- Card 1: Generic AI Chat -->
          <div class="lp-compare-card muted-card" data-spotlight>
            <div class="lp-glare" aria-hidden="true"></div>
            <div class="lp-cmp-head">
              <span class="lp-cmp-tag" data-i18n="cmp_old_tag">Standard AI Chatbots</span>
              <span class="lp-cmp-status bad" data-i18n="cmp_old_badge">Unverified</span>
            </div>
              <h3 data-i18n="cmp_old_title">Manual Prompting &amp; Copy-Paste</h3>
              <ul class="lp-cmp-list">
                <li>
                  <span class="cmp-icon cross" aria-hidden="true">&times;</span>
                  <span data-i18n="cmp_old_1">Invents fake author names, years, and non-existent DOIs.</span>
                </li>
                <li>
                  <span class="cmp-icon cross" aria-hidden="true">&times;</span>
                  <span data-i18n="cmp_old_2">Cannot scrape full-text university PDF repositories directly.</span>
                </li>
                <li>
                  <span class="cmp-icon cross" aria-hidden="true">&times;</span>
                  <span data-i18n="cmp_old_3">Produces unstructured walls of text requiring hours of Word &amp; slide formatting.</span>
                </li>
                <li>
                  <span class="cmp-icon cross" aria-hidden="true">&times;</span>
                  <span data-i18n="cmp_old_4">No chapter-level quality audit or Turnitin similarity paraphrasing.</span>
                </li>
              </ul>
            </div>

          <!-- Card 2: TGSDORK Studio -->
          <div class="lp-compare-card featured-card" data-spotlight>
            <div class="lp-glare" aria-hidden="true"></div>
            <div class="lp-cmp-head">
              <span class="lp-cmp-tag sky">TGSDORK Studio</span>
              <span class="lp-cmp-status good" data-i18n="cmp_new_badge">Source-Locked</span>
            </div>
              <h3 data-i18n="cmp_new_title">End-to-End Academic Pipeline</h3>
              <ul class="lp-cmp-list">
                <li>
                  <span class="cmp-icon check" aria-hidden="true">&#10003;</span>
                  <span data-i18n="cmp_new_1">Automated Google Dorking across <code>.ac.id</code>, <code>.edu</code>, Garuda, &amp; Scholar PDFs.</span>
                </li>
                <li>
                  <span class="cmp-icon check" aria-hidden="true">&#10003;</span>
                  <span data-i18n="cmp_new_2">Every in-text citation and bibliography entry locked to <code>&lt;verified_sources&gt;</code>.</span>
                </li>
                <li>
                  <span class="cmp-icon check" aria-hidden="true">&#10003;</span>
                  <span data-i18n="cmp_new_3">Instant export to formatted <code>.docx</code> manuscripts, <code>.pdf</code> matrices, &amp; <code>.pptx</code> slides.</span>
                </li>
                <li>
                  <span class="cmp-icon check" aria-hidden="true">&#10003;</span>
                  <span data-i18n="cmp_new_4">Built-in Academic Audit, Literature Review Matrix, &amp; similarity paraphraser.</span>
                </li>
              </ul>

            <div class="lp-cmp-actions">
              <a href="/studio?tab=generate" class="btn-pill btn-hot-pink">
                <span data-i18n="cmp_cta_primary">Launch Studio</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
              </a>
              <a href="/studio?tab=pptx" class="btn-pill btn-white" data-i18n="cmp_cta_secondary">Slide Generator</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT SECTION -->
    <section id="contact" class="lp-contact-section">
      <div class="lp-container">
        <div class="lp-section-head">
          <div>
            <span class="lp-eyebrow" data-i18n="contact_eyebrow">GET IN TOUCH</span>
            <h2 data-i18n="contact_heading">Contact &amp; Support</h2>
          </div>
          <p class="lp-section-sub" data-i18n="contact_sub">Have questions, feedback, partnership inquiries, or research challenges? Reach out directly.</p>
        </div>

        <div class="lp-contact-grid">
          <a href="mailto:founder@tgsdork.com" class="lp-contact-card">
            <div class="lp-contact-icon email">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
            </div>
            <div class="lp-contact-info">
              <span class="lp-contact-type" data-i18n="contact_email_label">Official Email</span>
              <strong class="lp-contact-val">founder@tgsdork.com</strong>
              <p class="lp-contact-note" data-i18n="contact_email_note">Direct inbox for inquiries, enterprise access, and research collaboration.</p>
            </div>
            <span class="lp-contact-action">
              <span data-i18n="contact_email_btn">Send Email</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
            </span>
          </a>

          <a href="https://instagram.com/nelosif_" target="_blank" rel="noopener noreferrer" class="lp-contact-card instagram">
            <div class="lp-contact-icon ig">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </div>
            <div class="lp-contact-info">
              <span class="lp-contact-type" data-i18n="contact_ig_label">Instagram</span>
              <strong class="lp-contact-val">@nelosif_</strong>
              <p class="lp-contact-note" data-i18n="contact_ig_note">Connect directly on Instagram for product updates, discussions, and quick DMs.</p>
            </div>
            <span class="lp-contact-action">
              <span data-i18n="contact_ig_btn">Follow</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  </main>

  <footer class="lp-footer">
    <div class="lp-container lp-footer-inner">
      <div class="lp-brand">
        <span class="brand-orb sm">
          <img src="data:image/png;base64,${FAVICON_B64}" alt="TGSDORK Logo" />
        </span>
        <span class="lp-brand-name">TGSDORK</span>
      </div>
      <div class="lp-footer-links">
        <a href="/studio?tab=generate" data-i18n="foot_generate">Manuscript</a>
        <a href="/studio?tab=review" data-i18n="foot_review">Audit</a>
        <a href="/studio?tab=turnitin" data-i18n="foot_turnitin">Similarity</a>
        <a href="/studio?tab=pptx" data-i18n="foot_pptx">PowerPoint</a>
        <a href="/studio?tab=workspace" data-i18n="foot_archive">Archive</a>
        <a href="mailto:founder@tgsdork.com">founder@tgsdork.com</a>
        <a href="https://instagram.com/nelosif_" target="_blank" rel="noopener noreferrer">@nelosif_</a>
      </div>
    </div>
  </footer>

  <script>window.__TGSDORK_DEV_UI__ = ${devUiMode ? 'true' : 'false'};</script>
  <script src="/public/landing.js?v=20261112_01" defer></script>
</body>
</html>`;
}
