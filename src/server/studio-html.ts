import { FAVICON_B64 } from './favicon.js';

export function renderStudioHtml(devUiMode = false): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#090a0f" />
  <meta name="description" content="TGSDORK Studio — Otomasi riset dan penulisan naskah akademik berbasis Google Dorking dan AI." />
  <meta name="robots" content="index, follow" />
  <title>TGSDORK Studio</title>
  <link rel="canonical" href="https://tgsdork.com/studio" />
  <link rel="icon" type="image/png" href="data:image/png;base64,${FAVICON_B64}" />
  <link rel="apple-touch-icon" href="data:image/png;base64,${FAVICON_B64}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/public/styles.css?v=20261112_03" />
</head>
<body class="studio-body">
  <a href="#mainApp" class="skip-link">Lewati ke ruang kerja utama</a>

  <div class="studio-outer-frame">
    <div class="app-shell" id="appShell">
      <!-- MINIMALIST DARK SIDEBAR RAIL (Reference-faithful) -->
      <aside class="sidebar" id="studioSidebar" aria-label="Navigasi Utama">
        <div class="sidebar-top">
          <div class="brand-row">
            <a class="brand" href="/" title="Halaman Utama TGSDORK">
              <span class="brand-orb sm">
                <img src="data:image/png;base64,${FAVICON_B64}" alt="Logo TGSDORK" />
              </span>
              <span class="brand-text">
                <span class="brand-name">TGSDORK</span>
              </span>
            </a>
            <button
              type="button"
              class="rail-toggle-btn"
              id="railToggleBtn"
              aria-label="Ciutkan atau bentangkan navigasi"
              title="Ciutkan / Bentangkan"
              onclick="TGSDORK.toggleSidebarRail()"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 17l5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          </div>

          <nav class="nav" id="mainNav">
            <button type="button" class="nav-btn active" data-tab="overview" aria-current="page" title="Ringkasan" onclick="TGSDORK.switchNav('overview')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5v4.5l3 2.5"/></svg>
              <span class="nav-label" data-i18n="nav_overview">Ringkasan</span>
            </button>

            <button type="button" class="nav-btn" data-tab="workspace" aria-current="false" title="Arsip Dokumen" onclick="TGSDORK.switchNav('workspace')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2.5"/><path stroke-linecap="round" d="M9 9h6M9 13h6M9 17h4"/></svg>
              <span class="nav-label" data-i18n="nav_archive">Arsip</span>
              <span class="nav-count" id="navWorkspaceCount">0</span>
            </button>

            <button type="button" class="nav-btn" data-tab="generate" aria-current="false" title="Susun Naskah" onclick="TGSDORK.switchNav('generate')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><path stroke-linecap="round" d="M16.75 13.5v6.5m-3.25-3.25h6.5"/></svg>
              <span class="nav-label" data-i18n="nav_generate">Susun Naskah</span>
            </button>

            <button type="button" class="nav-btn" data-tab="review" aria-current="false" title="Audit & Revisi" onclick="TGSDORK.switchNav('review')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="nav-label" data-i18n="nav_review">Audit &amp; Revisi</span>
            </button>

            <button type="button" class="nav-btn" data-tab="turnitin" aria-current="false" title="Uji Kemiripan" onclick="TGSDORK.switchNav('turnitin')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span class="nav-label" data-i18n="nav_turnitin">Kemiripan</span>
            </button>

            <button type="button" class="nav-btn" data-tab="pptx" aria-current="false" title="PowerPoint" onclick="TGSDORK.switchNav('pptx')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 20h8m-4-4v4"/></svg>
              <span class="nav-label" data-i18n="nav_pptx">PowerPoint</span>
            </button>

            <button type="button" class="nav-btn" data-tab="chat" aria-current="false" title="Diskusi Topik" onclick="TGSDORK.switchNav('chat')">
              <svg fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h5m-8 6l3.5-3H19a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2v3z"/></svg>
              <span class="nav-label" data-i18n="nav_chat">Diskusi</span>
            </button>
          </nav>
        </div>

        <div class="sidebar-footer">
          <span class="sr-only" id="wsText">Terhubung</span>
          <button type="button" class="rail-contact-btn" title="Kontak &amp; Bantuan" aria-label="Kontak Kami" onclick="TGSDORK.openContactModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            <span class="nav-label" data-i18n="nav_contact">Kontak</span>
          </button>
          <button type="button" class="rail-exit-btn" title="Logout dari Studio" aria-label="Logout dari Studio" onclick="TGSDORK.logout()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span class="nav-label" data-i18n="nav_logout">Logout</span>
            <span class="status-dot" id="wsDot" title="Status Server"></span>
          </button>
        </div>
      </aside>

      <!-- MAIN BENTO STAGE -->
      <main class="main-stage">
        <!-- CLEAN STUDIO HEADER -->
        <header class="stage-heading-row" id="stageHeadingRow">
          <div class="stage-titles">
            <h1 id="stageTitle">Halo, Peneliti!</h1>
            <p id="stageSubtitle">Ringkasan riset dan dokumen akademik Anda.</p>
          </div>
          <div class="topbar-actions">
            <div id="userBadge" class="user-chip" style="display: none;">
              <span class="user-avatar-orb" id="userAvatarInitials" aria-hidden="true">TG</span>
              <span class="user-chip-email" id="userEmailLabel">Akun</span>
            </div>
            <div class="studio-lang-switch" role="group" aria-label="Pengalih Bahasa">
              <button type="button" class="studio-lang-btn" data-lang-switch="en" onclick="TGSDORK.setLanguage('en')">EN</button>
              <button type="button" class="studio-lang-btn active" data-lang-switch="id" onclick="TGSDORK.setLanguage('id')">ID</button>
            </div>
            <button type="button" class="btn-pill btn-white sm" id="headerContactBtn" onclick="TGSDORK.openContactModal()" title="Kontak &amp; Bantuan">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              <span data-i18n="top_contact">Kontak</span>
            </button>
            <button type="button" class="btn-pill btn-white sm" id="headerNewDocBtn" onclick="TGSDORK.switchNav('generate'); document.getElementById('topic')?.focus();">
              <span data-i18n="top_new_doc">+ Naskah Baru</span>
            </button>
          </div>
        </header>

        <!-- GLOBAL FLOATING LIVE PROGRESS PILL -->
        <div class="global-progress-banner" id="globalProgressBanner" style="display: none;">
          <span class="live-pulse-dot" aria-hidden="true"></span>
          <span class="progress-status-text" id="globalProgressText">Sedang menyusun naskah...</span>
          <button type="button" class="progress-link-btn" onclick="TGSDORK.switchNav('generate')">Lihat &rarr;</button>
        </div>

        <div class="stage-content" id="mainApp">
          <!-- VIEW 0: CLEAN OVERVIEW DASHBOARD -->
          <section id="tab-overview">
            <div class="ov-stats-grid">
              <article class="bento-card card-white">
                <span class="card-label" data-i18n="ov_total_docs">Total Dokumen</span>
                <div class="card-stat">
                  <strong id="ovTotalDocs">0</strong>
                  <span class="mini-pill sky" id="ovCompletedRate">0 selesai</span>
                </div>
                <span class="card-foot" data-i18n="ov_saved_archive">Tersimpan di arsip akun</span>
              </article>

              <article class="bento-card">
                <span class="card-label" data-i18n="ov_locked_ref">Rujukan Terkunci</span>
                <div class="card-stat">
                  <strong id="ovTotalSources">0</strong>
                  <span class="mini-pill pink" data-i18n="ov_verified">Terverifikasi</span>
                </div>
                <span class="card-foot" data-i18n="ov_citation_total">Total sitasi literatur</span>
              </article>

              <article class="bento-card">
                <span class="card-label" data-i18n="ov_drafted_sections">Bab Tersusun</span>
                <div class="card-stat">
                  <strong id="ovTotalSections">0</strong>
                  <span class="mini-pill sky" data-i18n="ov_sections_badge">Bagian</span>
                </div>
                <span class="card-foot" data-i18n="ov_abstract_to_close">Abstrak hingga penutup</span>
              </article>

              <article class="bento-card">
                <span class="card-label" data-i18n="ov_active_jobs">Proses Aktif Real-Time</span>
                <div class="card-stat">
                  <strong id="ovRunningCount">0</strong>
                  <span class="mini-pill sky" id="ovRunningPill" data-i18n="ov_calm">Tenang</span>
                </div>
                <span class="card-foot" id="ovRunningNote" data-i18n="ov_jobs_note">Semua proses jalan paralel tanpa antrean</span>
              </article>

            <div class="panel ov-live-jobs-panel" id="ovLiveJobsPanel" style="display: none; margin-bottom: 16px;">
              <div class="panel-header" style="margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="live-pulse-dot" aria-hidden="true"></span>
                  <div class="panel-title" style="margin: 0;">Aktivitas Proses Berjalan</div>
                  <span class="mini-pill sky" id="ovLiveJobsBadge">0 aktif</span>
                </div>
                <span style="font-size: 11.5px; color: var(--ink-muted);">Diproses bersamaan secara paralel &bull; Pembaruan otomatis 1:1</span>
              </div>
              <div id="ovLiveJobsList" class="ov-live-jobs-list"></div>
            </div>

            <div class="ov-quick-grid">
              <button type="button" class="ov-quick-card" onclick="TGSDORK.switchNav('generate')">
                <span class="ov-quick-icon sky">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                </span>
                <div class="ov-quick-text">
                  <strong data-i18n="quick_gen_title">Susun Naskah</strong>
                  <span data-i18n="quick_gen_sub">Makalah, Skripsi &amp; Tinjauan Pustaka</span>
                </div>
              </button>

              <button type="button" class="ov-quick-card" onclick="TGSDORK.switchNav('review')">
                <span class="ov-quick-icon pink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
                <div class="ov-quick-text">
                  <strong data-i18n="quick_rev_title">Audit &amp; Revisi</strong>
                  <span data-i18n="quick_rev_sub">Evaluasi mutu &amp; perbaikan otomatis</span>
                </div>
              </button>

              <button type="button" class="ov-quick-card" onclick="TGSDORK.switchNav('turnitin')">
                <span class="ov-quick-icon sky">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </span>
                <div class="ov-quick-text">
                  <strong data-i18n="quick_turnitin_title">Uji Kemiripan</strong>
                  <span data-i18n="quick_turnitin_sub">Cek skor kemiripan &amp; parafrase</span>
                </div>
              </button>

              <button type="button" class="ov-quick-card" onclick="TGSDORK.switchNav('pptx')">
                <span class="ov-quick-icon pink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 20h8m-4-4v4"/></svg>
                </span>
                <div class="ov-quick-text">
                  <strong data-i18n="quick_pptx_title">PowerPoint</strong>
                  <span data-i18n="quick_pptx_sub">Buat salindia &amp; catatan pemateri</span>
                </div>
              </button>
            </div>

            <div class="panel ov-recent-panel">
              <div class="panel-header" style="margin-bottom: 12px;">
                <div>
                  <div class="panel-title" data-i18n="ov_recent_title">Dokumen Terbaru</div>
                  <div class="panel-subtitle" data-i18n="ov_recent_sub">Naskah terakhir yang disusun di akun ini.</div>
                </div>
                <button type="button" class="action-btn" data-i18n="ov_view_all" onclick="TGSDORK.switchNav('workspace')">Lihat Semua &rarr;</button>
              </div>
              <div id="ovRecentList"></div>
            </div>

            <div class="panel ov-contact-card" style="margin-top: 16px;">
              <div class="ov-contact-row">
                <div class="ov-contact-info">
                  <div class="ov-quick-icon pink">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  </div>
                  <div>
                    <strong class="ov-contact-title" data-i18n="ov_contact_title">Hubungi Tim TGSDORK</strong>
                    <span class="ov-contact-sub" data-i18n="ov_contact_sub">Masukan fitur, kendala riset, atau kolaborasi langsung.</span>
                  </div>
                </div>
                <div class="ov-contact-actions">
                  <a href="mailto:founder@tgsdork.com" class="btn-pill btn-white sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
                    <span>founder@tgsdork.com</span>
                  </a>
                  <a href="https://instagram.com/nelosif_" target="_blank" rel="noopener noreferrer" class="btn-pill btn-hot-pink sm">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    <span>@nelosif_</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <!-- VIEW 1: SUSUN NASKAH -->
          <section id="tab-generate" style="display: none;">
            <div class="studio-split">
              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="gen_panel_title">Konfigurasi Naskah</div>
                    <div class="panel-subtitle" data-i18n="gen_panel_sub">Susun makalah, skripsi, atau tinjauan pustaka lengkap.</div>
                  </div>
                </div>

                <form id="generateForm">
                  <div class="form-group">
                    <label for="topic" data-i18n="gen_topic_label">Judul atau Topik Penelitian</label>
                    <input type="text" id="topic" data-i18n-placeholder="gen_topic_placeholder" placeholder="Contoh: Efektivitas Pembelajaran Berbasis Proyek terhadap Kreativitas Siswa" required />
                  </div>

                  <div class="form-row-2">
                    <div class="form-group">
                      <label for="taskType" data-i18n="gen_type_label">Jenis Dokumen</label>
                      <select id="taskType" onchange="TGSDORK.updateChapterOptions()">
                        <option value="makalah">Makalah Ilmiah</option>
                        <option value="skripsi">Skripsi / Tesis</option>
                        <option value="lit-review">Tinjauan Pustaka</option>
                        <option value="presentasi">Kerangka Presentasi</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="docFont" data-i18n="gen_font_label">Tipografi (.docx &amp; .pdf)</label>
                      <select id="docFont">
                        <option value="Times New Roman" selected>Times New Roman</option>
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Garamond">Garamond</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row-2">
                    <div class="form-group">
                      <label for="citationStyle" data-i18n="gen_citation_label">Format Sitasi</label>
                      <select id="citationStyle">
                        <option value="apa" selected>APA Edisi ke-7</option>
                        <option value="ieee">IEEE [1], [2]</option>
                        <option value="harvard">Harvard</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="chapterConfig" data-i18n="gen_structure_label">Struktur Bab</label>
                      <select id="chapterConfig" onchange="TGSDORK.handleChapterConfigChange()">
                        <option value="auto" selected>Standar Lengkap (Bab I–V)</option>
                        <option value="4">4 Bab + Abstrak</option>
                        <option value="3">3 Bab Ringkas</option>
                        <option value="5">5 Bab Skripsi Penuh</option>
                        <option value="custom">Daftar Bab Kustom</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group" id="customChapterWrap" style="display: none;">
                    <label for="customChapters">Daftar Bab Kustom <span class="label-hint">(satu per baris)</span></label>
                    <textarea id="customChapters" rows="4" placeholder="ABSTRAK&#10;BAB I: PENDAHULUAN&#10;BAB II: TINJAUAN PUSTAKA&#10;BAB III: METODE PENELITIAN&#10;BAB IV: HASIL DAN PEMBAHASAN&#10;BAB V: PENUTUP"></textarea>
                  </div>

                  <div class="form-row-2">
                    <div class="form-group">
                      <label for="coverToggle" data-i18n="gen_cover_label">Halaman Sampul</label>
                      <select id="coverToggle" onchange="TGSDORK.toggleCoverFields()">
                        <option value="off" selected>Tanpa sampul</option>
                        <option value="on">Sampul institusi</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="customRefInput">Lampiran Jurnal <span class="label-hint">(opsional)</span></label>
                      <input type="file" id="customRefInput" class="file-input-compact" accept=".pdf,.docx,.md,.txt" multiple />
                    </div>
                  </div>

                  <div id="coverFields" class="cover-box" style="display: none;">
                    <div class="form-group">
                      <label for="coverInstitution">Perguruan Tinggi</label>
                      <input type="text" id="coverInstitution" placeholder="UNIVERSITAS NEGERI SEMARANG" />
                    </div>
                    <div class="form-row-2">
                      <div class="form-group">
                        <label for="coverFaculty">Fakultas</label>
                        <input type="text" id="coverFaculty" placeholder="FAKULTAS TEKNIK" />
                      </div>
                      <div class="form-group">
                        <label for="coverProgram">Program Studi</label>
                        <input type="text" id="coverProgram" placeholder="TEKNIK INFORMATIKA" />
                      </div>
                    </div>
                    <div class="form-row-2">
                      <div class="form-group">
                        <label for="coverAuthor">Nama Penulis</label>
                        <input type="text" id="coverAuthor" placeholder="Nama Lengkap" />
                      </div>
                      <div class="form-group">
                        <label for="coverNim">NIM</label>
                        <input type="text" id="coverNim" placeholder="2406012..." />
                      </div>
                    </div>
                    <div class="form-row-2">
                      <div class="form-group" style="margin-bottom: 0;">
                        <label for="coverSupervisor">Dosen Pembimbing</label>
                        <input type="text" id="coverSupervisor" placeholder="Nama &amp; Gelar" />
                      </div>
                      <div class="form-group" style="margin-bottom: 0;">
                        <label for="coverCity">Kota</label>
                        <input type="text" id="coverCity" placeholder="Semarang" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" id="btnGen" class="btn-primary" data-i18n="gen_submit_btn">Susun Naskah</button>
                </form>
              </div>

              <div class="studio-right-stack">
                <div class="panel">
                  <div class="panel-header">
                    <div class="panel-title" data-i18n="gen_steps_title">Tahapan Penyusunan</div>
                  </div>

                  <div class="pipeline-steps">
                    <div class="step-item" id="pipe-dorking"><span class="step-num">1</span><div><span class="step-label">Perumusan Kueri</span><span class="step-desc">Menyusun kueri literatur</span></div></div>
                    <div class="step-item" id="pipe-searching"><span class="step-num">2</span><div><span class="step-label">Penelusuran Literatur</span><span class="step-desc">Pencarian artikel dan jurnal</span></div></div>
                    <div class="step-item" id="pipe-extracting"><span class="step-num">3</span><div><span class="step-label">Penyaringan Data</span><span class="step-desc">Ekstraksi dan verifikasi rujukan</span></div></div>
                    <div class="step-item" id="pipe-drafting"><span class="step-num">4</span><div><span class="step-label">Penulisan Bab</span><span class="step-desc">Sinkronisasi sitasi 1:1</span></div></div>
                    <div class="step-item" id="pipe-audit"><span class="step-num">5</span><div><span class="step-label">Audit &amp; Ekspor</span><span class="step-desc">Pemeriksaan mutu dan ekspor berkas</span></div></div>
                  </div>

                  <div class="log-console" id="genLog" style="display: none;"></div>

                  <div class="live-draft-box" id="liveStreamWrap" style="display: none;">
                    <div class="live-draft-head">
                      <strong id="liveSectionTitle">Menunggu...</strong>
                      <span id="liveStreamCounter" style="font-family: var(--font-mono); color: var(--ink-muted);">0 baris</span>
                    </div>
                    <div class="live-draft-body" id="liveStreamText"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- VIEW 2: POWERPOINT -->
          <section id="tab-pptx" style="display: none;">
            <div class="studio-split">
              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="pptx_panel_title">PowerPoint (.pptx)</div>
                    <div class="panel-subtitle" data-i18n="pptx_panel_sub">Susun 10–14 salindia lengkap dengan catatan pembicara langsung dari judul.</div>
                  </div>
                </div>
                <form id="pptxForm">
                  <div class="form-group">
                    <label for="pptxTopic" data-i18n="pptx_topic_label">Judul Materi Presentasi</label>
                    <input type="text" id="pptxTopic" data-i18n-placeholder="pptx_topic_placeholder" placeholder="Contoh: Arsitektur Keamanan Jaringan Berbasis Zero Trust pada Kampus" required />
                  </div>
                  <div class="form-group">
                    <label for="pptxTheme" data-i18n="pptx_theme_label">Tema Visual</label>
                    <select id="pptxTheme">
                      <option value="auto">Otomatis sesuai topik</option>
                      <option value="canva-editorial">Editorial Cream</option>
                      <option value="canva-indigo">Midnight Slate</option>
                      <option value="canva-minimal-light">Clean Light</option>
                      <option value="nature">Botanical Dark</option>
                      <option value="warm">Warm Berry</option>
                    </select>
                  </div>
                  <label class="checkbox-row" for="pptxAnimate">
                    <input type="checkbox" id="pptxAnimate" />
                    <span data-i18n="pptx_transition_label">Tambahkan transisi antar-slide</span>
                  </label>
                  <button type="submit" class="btn-primary" id="btnPptx" data-i18n="pptx_submit_btn">Buat File PowerPoint (.pptx)</button>
                </form>
                <div id="pptxStatus" class="status-callout" style="display: none;"></div>
                <div class="actions-row" id="pptxResult" style="display: none; margin-top: 14px;">
                  <a class="action-btn accent" id="pptxDownload" href="#" download data-i18n="pptx_download_btn">Unduh PowerPoint (.pptx)</a>
                </div>
              </div>

              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title">Struktur Salindia Standar</div>
                    <div class="panel-subtitle">Komposisi otomatis untuk sidang dan seminar akademik.</div>
                  </div>
                </div>
                <div class="pipeline-steps">
                  <div class="step-item"><span class="step-num">1</span><div><span class="step-label">Sampul &amp; Latar Belakang</span><span class="step-desc">Judul, urgensi topik, dan konteks fenomena riset</span></div></div>
                  <div class="step-item"><span class="step-num">2</span><div><span class="step-label">Rumusan &amp; Kajian Pustaka</span><span class="step-desc">Pertanyaan penelitian, landasan teori, dan celah riset</span></div></div>
                  <div class="step-item"><span class="step-num">3</span><div><span class="step-label">Metodologi &amp; Pembahasan</span><span class="step-desc">Alur kerja, analisis temuan utama, dan perbandingan data</span></div></div>
                  <div class="step-item"><span class="step-num">4</span><div><span class="step-label">Simpulan &amp; Catatan Pemateri</span><span class="step-desc">Ringkasan akhir beserta naskah bicara di setiap slide</span></div></div>
                </div>
              </div>
            </div>
          </section>

          <!-- VIEW 3: AUDIT & REVISI -->
          <section id="tab-review" style="display: none;">
            <div class="studio-split">
              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="review_panel_title">Audit &amp; Revisi Otomatis</div>
                    <div class="panel-subtitle" data-i18n="review_panel_sub">Evaluasi struktur dan perbaiki naskah secara otomatis.</div>
                  </div>
                </div>

                <div class="dropzone" id="dropArea" role="button" tabindex="0" aria-label="Pilih atau seret berkas naskah">
                  <input type="file" id="fileInput" accept=".docx,.pdf,.md,.txt" style="display: none;" />
                  <div class="dropzone-main" id="dropText"><strong>Pilih berkas naskah</strong> atau seret ke sini</div>
                  <div class="dropzone-sub">.docx, .pdf, .md, .txt</div>
                </div>

                <div class="form-group" style="margin-top: 14px;">
                  <label for="manualFilePath" data-i18n="review_manual_label">Atau nama berkas di ~/Documents</label>
                  <input type="text" id="manualFilePath" placeholder="Contoh: makalah_pendidikan.docx" />
                </div>

                <button type="button" id="btnAudit" class="btn-primary" data-i18n="review_submit_btn" onclick="TGSDORK.executeAudit()">Periksa Kelayakan Naskah</button>
              </div>

              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="review_eval_title">Hasil Evaluasi Kelayakan</div>
                    <div class="panel-subtitle" data-i18n="review_eval_sub">Skor mutu akademik, rincian temuan, dan perbaikan otomatis.</div>
                  </div>
                </div>

                <div class="report-wrap" id="reportArea" style="margin-top: 0;">
                  <div class="score-summary-bar">
                    <div class="score-number-group">
                      <span class="score-big" id="auditScoreValue">-- / 100</span>
                      <span class="score-status-pill" id="auditStatusPill">Belum Diperiksa</span>
                    </div>
                    <div class="actions-row">
                      <button type="button" class="action-btn accent" id="btnDoAutoRevise" data-i18n="btn_do_auto_revise" onclick="TGSDORK.triggerAuditAutoRevise()">Revisi Otomatis</button>
                      <button type="button" class="action-btn" data-i18n="btn_copy_report" onclick="TGSDORK.copyReportText()">Salin</button>
                    </div>
                  </div>

                  <div class="result-banner" id="reviseResultBanner" style="display: none;">
                    <div class="result-banner-title" id="reviseSuccessTitle">Revisi Selesai</div>
                    <div class="result-banner-desc" id="reviseSuccessMeta">Naskah siap diunduh.</div>
                    <div class="actions-row">
                      <a class="action-btn accent" id="dlDocxLink" href="#" download>DOCX</a>
                      <a class="action-btn" id="dlPdfLink" href="#" download>PDF</a>
                      <a class="action-btn" id="dlBibLink" href="#" download>BibTeX</a>
                      <a class="action-btn" id="dlMdLink" href="#" target="_blank">Markdown</a>
                    </div>
                  </div>

                  <div class="markdown-body" id="reportContent">
                    <p style="color: var(--ink-muted); margin-bottom: 0;">Unggah berkas naskah di panel kiri lalu klik <strong>Periksa Kelayakan Naskah</strong> untuk melihat skor struktur bab, kepatuhan sitasi 1:1, dan rekomendasi perbaikan.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- VIEW 4: UJI KEMIRIPAN -->
          <section id="tab-turnitin" style="display: none;">
            <div class="turnitin-container" id="turnitinContainer">
              <div class="panel turnitin-input-panel" id="turnitinInputPanel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="turnitin_panel_title">Uji Kemiripan &amp; Parafrase</div>
                    <div class="panel-subtitle" data-i18n="turnitin_panel_sub">Ukur proporsi kemiripan terhadap korpus mahasiswa, jurnal, dan web.</div>
                  </div>
                </div>

                <div class="dropzone" id="turnitinDropArea" role="button" tabindex="0" aria-label="Pilih berkas untuk uji kemiripan">
                  <input type="file" id="turnitinFileInput" accept=".docx,.pdf,.md,.txt" style="display: none;" />
                  <div class="dropzone-main" id="turnitinDropText"><strong>Pilih berkas naskah</strong> atau seret ke sini</div>
                  <div class="dropzone-sub">.docx, .pdf, .md, .txt</div>
                </div>

                <div class="form-group" style="margin-top: 14px;">
                  <label for="turnitinText" data-i18n="turnitin_manual_label">Atau tempel teks naskah</label>
                  <textarea id="turnitinText" rows="5" placeholder="Tempel teks naskah..."></textarea>
                </div>
                <div class="turnitin-options-box">
                  <div style="font-weight: 600; color: var(--ink-secondary); margin-bottom: 6px;">Filter Turnitin Kampus:</div>
                  <label class="turnitin-opt-row">
                    <input type="checkbox" id="chkTurnitinExcludeBib" checked />
                    <span>Kecualikan Daftar Pustaka (Exclude Bibliography)</span>
                  </label>
                  <label class="turnitin-opt-row">
                    <input type="checkbox" id="chkTurnitinExcludeQuotes" />
                    <span>Kecualikan Tanda Petik (Exclude Quotes)</span>
                  </label>
                </div>

                <button type="button" id="btnTurnitin" class="btn-primary" data-i18n="turnitin_submit_btn" onclick="TGSDORK.executeTurnitinScan()">Periksa Skor Kemiripan</button>
                <button type="button" id="btnTurnitinBackToResult" class="action-btn" style="display: none; width: 100%; margin-top: 8px; justify-content: center;" onclick="TGSDORK.showLastTurnitinResult()">Lihat Laporan Terakhir &rarr;</button>
              </div>

              <div class="panel turnitin-report-panel" id="turnitinReportPanel">
                <div class="panel-header turnitin-report-header">
                  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <button type="button" class="action-btn" id="btnTurnitinNewScan" style="display: none;" onclick="TGSDORK.resetTurnitinView()">&larr; Uji Berkas Lain</button>
                    <div>
                      <div class="panel-title" id="turnitinReportMainTitle">Laporan Kemiripan Turnitin</div>
                      <div class="panel-subtitle" id="turnitinDocFilename">Analisis kemiripan terhadap repositori mahasiswa, jurnal ilmiah, dan web.</div>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div class="turnitin-view-switch" id="turnitinViewSwitch" style="display: none;">
                      <button type="button" class="turnitin-tab-btn active" id="btnTurnitinViewDoc" onclick="TGSDORK.setTurnitinDisplayMode('doc')">Tampilan Dokumen</button>
                      <button type="button" class="turnitin-tab-btn" id="btnTurnitinViewText" onclick="TGSDORK.setTurnitinDisplayMode('text')">Laporan Ringkas</button>
                    </div>
                    <button type="button" class="action-btn" id="btnToggleSourcesPane" style="display: none;" onclick="TGSDORK.toggleTurnitinSourcesPane()">Sembunyikan Sumber</button>
                    <button type="button" class="action-btn accent" id="btnDoTurnitinParaphrase" data-i18n="turnitin_do_para_btn" onclick="TGSDORK.triggerTurnitinParaphrase()">Parafrase Otomatis</button>
                    <button type="button" class="action-btn" onclick="TGSDORK.copyTurnitinReport()">Salin</button>
                  </div>
                </div>

                <div class="report-wrap" id="turnitinReportArea" style="margin-top: 0;">
                  <div class="turnitin-metrics-quad">
                    <div class="metric-box">
                      <div class="metric-box-label">Indeks Kemiripan</div>
                      <div class="metric-box-value" id="simScoreBadge">--%</div>
                      <div class="metric-box-note" id="simStatusBadge">Batas aman &lt; 20%</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-box-label">Internet Sources</div>
                      <div class="metric-box-value" id="simInternetBadge" style="color: #38bdf8;">--%</div>
                      <div class="metric-box-note">Web &amp; Ensiklopedia</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-box-label">Publications</div>
                      <div class="metric-box-value" id="simPubBadge" style="color: #60a5fa;">--%</div>
                      <div class="metric-box-note">Jurnal SINTA/DOAJ</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-box-label">Student Papers</div>
                      <div class="metric-box-value" id="simStudentBadge" style="color: #c084fc;">--%</div>
                      <div class="metric-box-note">Korpus Mahasiswa</div>
                    </div>
                  </div>

                  <div class="turnitin-category-bar" id="turnitinCategoryBar" style="display: none;">
                    <div class="turnitin-cat-seg internet" id="catSegInternet" style="width: 0%;"></div>
                    <div class="turnitin-cat-seg pub" id="catSegPub" style="width: 0%;"></div>
                    <div class="turnitin-cat-seg student" id="catSegStudent" style="width: 0%;"></div>
                  </div>
                  <div class="turnitin-cat-legend" id="turnitinCategoryLegend" style="display: none;">
                    <span class="turnitin-legend-item"><span class="turnitin-legend-dot internet"></span> Internet (<span id="legInternetPct">0%</span>)</span>
                    <span class="turnitin-legend-item"><span class="turnitin-legend-dot pub"></span> Publikasi (<span id="legPubPct">0%</span>)</span>
                    <span class="turnitin-legend-item"><span class="turnitin-legend-dot student"></span> Naskah Mahasiswa (<span id="legStudentPct">0%</span>)</span>
                    <span class="turnitin-legend-item" style="margin-left: auto; color: var(--ink-muted);">AI Writing: <strong id="aiScoreBadge" style="color: #fff;">--%</strong> (<span id="aiStatusBadge">Alami</span>)</span>
                  </div>

                  <div class="result-banner" id="turnitinParaphraseBanner" style="display: none;">
                    <div class="result-banner-title" id="turnitinPassTitle">Parafrase Selesai</div>
                    <div class="result-banner-desc">Berkas hasil parafrase siap diunduh.</div>
                    <div class="actions-row">
                      <a class="action-btn accent" id="dlTurnitinDocx" href="#" download>DOCX</a>
                      <a class="action-btn" id="dlTurnitinPdf" href="#" download>PDF</a>
                      <a class="action-btn" id="dlTurnitinMd" href="#" target="_blank">Markdown</a>
                    </div>
                  </div>

                  <!-- Dual Interactive Turnitin Viewer -->
                  <div id="turnitinViewerDual" class="turnitin-dual-view" style="display: none;">
                    <div class="turnitin-doc-pane" id="turnitinDocPane">
                      <div id="turnitinAnnotatedDoc"></div>
                    </div>
                    <div class="turnitin-sources-pane" id="turnitinSourcesPane">
                      <div class="turnitin-sources-header">
                        <span class="turnitin-sources-title">Primary Sources</span>
                        <span class="turnitin-sources-count" id="turnitinSourcesCount">0 Sumber</span>
                      </div>
                      <div class="turnitin-source-filters" id="turnitinSourceFilters">
                        <button type="button" class="t-filter-chip active" data-src-filter="all" onclick="TGSDORK.filterTurnitinSources('all')">Semua</button>
                        <button type="button" class="t-filter-chip" data-src-filter="publication" onclick="TGSDORK.filterTurnitinSources('publication')">Publikasi</button>
                        <button type="button" class="t-filter-chip" data-src-filter="student_paper" onclick="TGSDORK.filterTurnitinSources('student_paper')">Mahasiswa</button>
                        <button type="button" class="t-filter-chip" data-src-filter="internet" onclick="TGSDORK.filterTurnitinSources('internet')">Internet</button>
                      </div>
                      <div id="turnitinSourcesList" class="turnitin-sources-list">
                        <div style="font-size: 11.5px; color: var(--ink-muted); padding: 8px 0;">Belum ada sumber kemiripan.</div>
                      </div>
                    </div>
                  </div>

                  <div class="markdown-body" id="turnitinReportContent">
                    <p style="color: var(--ink-muted); margin-bottom: 0;">Pilih berkas atau tempel teks di panel kiri lalu klik <strong>Periksa Skor Kemiripan</strong> untuk mendeteksi bagian yang perlu diparafrase.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- VIEW 5: ARSIP DOKUMEN (Minimalist "Order list" Reference Screen 2) -->
          <section id="tab-workspace" style="display: none;">
            <div class="archive-toolbar">
              <div class="archive-search-wrap">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path stroke-linecap="round" d="M20 20l-4-4"/></svg>
                <input type="text" id="searchDoc" data-i18n-placeholder="ws_search_placeholder" aria-label="Cari dokumen" placeholder="Cari judul naskah..." oninput="TGSDORK.filterDocs()" />
              </div>

              <div class="archive-filter-bar" role="group" aria-label="Filter jenis">
                <button type="button" class="filter-chip active" data-type-filter="all" data-i18n="ws_filter_all" onclick="TGSDORK.setArchiveTypeFilter('all')">Semua</button>
                <button type="button" class="filter-chip" data-type-filter="makalah" data-i18n="ws_filter_makalah" onclick="TGSDORK.setArchiveTypeFilter('makalah')">Makalah</button>
                <button type="button" class="filter-chip" data-type-filter="skripsi" data-i18n="ws_filter_skripsi" onclick="TGSDORK.setArchiveTypeFilter('skripsi')">Skripsi</button>
                <button type="button" class="filter-chip" data-type-filter="lit-review" data-i18n="ws_filter_lit" onclick="TGSDORK.setArchiveTypeFilter('lit-review')">Lit-Review</button>
                <button type="button" class="filter-chip" data-type-filter="presentasi" data-i18n="ws_filter_presentasi" onclick="TGSDORK.setArchiveTypeFilter('presentasi')">Presentasi</button>
                <button type="button" class="filter-clear-btn" id="btnClearArchiveFilters" style="display: none;" onclick="TGSDORK.resetArchiveFilters()">Reset</button>
              </div>

              <div class="archive-toolbar-right">
                <span class="archive-total-count" id="archiveResultCount">0 dokumen</span>
                <label for="archiveSortSelect" class="sr-only">Urutkan</label>
                <select id="archiveSortSelect" class="sort-pill-select" onchange="TGSDORK.filterDocs()">
                  <option value="newest" selected>Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="sources">Rujukan Terbanyak</option>
                  <option value="title">Judul A–Z</option>
                </select>
                <button type="button" class="action-btn" data-i18n="ws_reload_btn" onclick="TGSDORK.loadWorkspaceTasks()">Muat Ulang</button>
              </div>
            </div>

            <div id="workspaceList"></div>
          </section>

          <!-- VIEW 6: DISKUSI TOPIK -->
          <section id="tab-chat" style="display: none;">
            <div class="studio-split">
              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="chat_panel_title">Diskusi Topik &amp; Metodologi</div>
                    <div class="panel-subtitle" data-i18n="chat_panel_sub">Konsultasikan judul, variabel, atau kerangka bab.</div>
                  </div>
                  <div class="actions-row">
                    <button type="button" class="action-btn" data-i18n="chat_clear_btn" onclick="TGSDORK.chatReset()">Bersihkan</button>
                    <button type="button" class="action-btn accent" data-i18n="chat_use_topic_btn" onclick="TGSDORK.chatUseTopic()">Jadikan Judul</button>
                  </div>
                </div>

                <div class="chat-thread" id="chatLog"></div>

                <form id="chatForm" class="chat-input-bar">
                  <textarea id="chatInput" data-i18n-placeholder="chat_input_placeholder" rows="2" aria-label="Pesan diskusi" placeholder="Tulis ide topik atau pertanyaan metodologi..."></textarea>
                  <button type="submit" id="btnChat" class="btn-primary chat-send-btn" data-i18n="chat_send_btn">Kirim</button>
                </form>
              </div>

              <div class="panel">
                <div class="panel-header">
                  <div>
                    <div class="panel-title" data-i18n="chat_quick_title">Mulai Cepat Konsultasi</div>
                    <div class="panel-subtitle" data-i18n="chat_quick_sub">Klik salah satu topik di bawah untuk memulai diskusi.</div>
                  </div>
                </div>
                <div class="pipeline-steps">
                  <button type="button" class="chat-prompt-btn" onclick="TGSDORK.sendQuickChat('Rekomendasikan 5 judul skripsi yang spesifik beserta variabel penelitiannya.')">
                    <span class="step-num">1</span>
                    <div>
                      <span class="step-label">Rumuskan Ide Judul &amp; Variabel</span>
                      <span class="step-desc">Dapatkan opsi judul ilmiah beserta variabel X dan Y</span>
                    </div>
                  </button>
                  <button type="button" class="chat-prompt-btn" onclick="TGSDORK.sendQuickChat('Bantu susun rumusan masalah, tujuan penelitian, dan hipotesis untuk topik saya.')">
                    <span class="step-num">2</span>
                    <div>
                      <span class="step-label">Susun Rumusan Masalah</span>
                      <span class="step-desc">Pertanyaan penelitian terukur untuk Bab I</span>
                    </div>
                  </button>
                  <button type="button" class="chat-prompt-btn" onclick="TGSDORK.sendQuickChat('Metode penelitian, teknik pengumpulan data, dan instrumen analisis apa yang paling tepat?')">
                    <span class="step-num">3</span>
                    <div>
                      <span class="step-label">Pilih Desain Metodologi</span>
                      <span class="step-desc">Pendekatan kuantitatif, kualitatif, atau R&amp;D</span>
                    </div>
                  </button>
                  <button type="button" class="chat-prompt-btn" onclick="TGSDORK.sendQuickChat('Bagaimana cara menemukan research gap dan kebaruan (novelty) dari jurnal 5 tahun terakhir?')">
                    <span class="step-num">4</span>
                    <div>
                      <span class="step-label">Identifikasi Celah Riset (Novelty)</span>
                      <span class="step-desc">Memetakan pembeda penelitian dengan studi terdahulu</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  </div>
  <!-- IN-APP DOCUMENT READER MODAL -->
  <div class="reader-overlay" id="docReaderModal" role="dialog" aria-modal="true" aria-labelledby="readerDocTitle" style="display: none;">
    <div class="reader-sheet">
      <header class="reader-header">
        <div class="reader-meta">
          <span class="reader-badge" id="readerDocType">Makalah</span>
          <h2 id="readerDocTitle">Judul Naskah</h2>
        </div>
        <div class="reader-actions">
          <a class="action-btn accent" id="readerDocxDl" href="#" download>DOCX</a>
          <a class="action-btn" id="readerPdfDl" href="#" download>PDF</a>
          <button type="button" class="action-btn" id="readerCopyBtn" onclick="TGSDORK.copyReaderText()">Salin Teks</button>
          <button type="button" class="icon-btn" aria-label="Tutup pratinjau naskah" onclick="TGSDORK.closeDocReader()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </header>
      <div class="reader-body-wrap">
        <div class="reader-content markdown-body" id="readerDocBody">
          <p style="color:var(--ink-muted);">Memuat isi naskah...</p>
        </div>
      </div>
    </div>
  </div>

  <!-- AUTH MODAL -->
  <div class="auth-overlay" id="authOverlay" role="dialog" aria-modal="true" aria-labelledby="authModalTitle" style="display: none;">
    <div class="auth-card">
      <div class="auth-card-top">
        <a href="/" class="brand">
          <span class="brand-orb sm"><img src="data:image/png;base64,${FAVICON_B64}" alt="Logo TGSDORK" /></span>
          <span class="brand-name">TGSDORK</span>
        </a>
        <span class="auth-badge">Akses Terverifikasi</span>
      </div>

      <h2 id="authModalTitle" data-i18n="modal_auth_title">Masuk ke TGSDORK Studio</h2>
      <p id="authModalSubtitle" data-i18n="modal_auth_sub">Masukkan alamat email aktif Anda. Kami akan mengirimkan 6 digit kode verifikasi sekali pakai (OTP) dari <strong><!--email_off-->noreply@tgsdork.com<!--/email_off--></strong>.</p>

      <div id="authStep1">
        <div class="form-group">
          <label for="authEmail" data-i18n="modal_auth_email_label">Alamat Email</label>
          <input type="email" id="authEmail" data-i18n-placeholder="modal_auth_email_placeholder" placeholder="nama@kampus.ac.id atau email pribadi" autocomplete="email" onkeydown="if(event.key==='Enter'){event.preventDefault();TGSDORK.sendAuthCode();}" required />
        </div>
        <button type="button" id="btnSendCode" class="btn-primary" style="width: 100%;" data-i18n="modal_auth_send_otp" onclick="TGSDORK.sendAuthCode()">Kirim Kode Verifikasi (OTP)</button>
      </div>

      <div id="authStep2" style="display: none;">
        <div id="codeHint" class="otp-code-hint"></div>
        <div class="form-group">
          <label for="authCode" data-i18n="modal_auth_otp_label">6 Digit Kode Verifikasi (OTP)</label>
          <input type="text" id="authCode" placeholder="000000" maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" class="otp-code-input" onkeydown="if(event.key==='Enter'){event.preventDefault();TGSDORK.verifyAuthCode();}" />
        </div>
        <button type="button" id="btnVerifyCode" class="btn-primary" style="width: 100%;" data-i18n="modal_auth_verify_btn" onclick="TGSDORK.verifyAuthCode()">Verifikasi &amp; Masuk Studio</button>
        <div class="auth-step2-actions">
          <button type="button" class="btn-secondary" data-i18n="modal_auth_resend" onclick="TGSDORK.sendAuthCode()">Kirim Ulang Kode</button>
          <button type="button" class="btn-secondary" data-i18n="modal_auth_change_email" onclick="TGSDORK.resetAuthStep()">Ganti Alamat Email</button>
        </div>
      </div>
    </div>
  </div>

  <!-- CONTACT FOUNDER MODAL -->
  <div class="auth-overlay" id="contactModal" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle" style="display: none;" onclick="if(event.target===this)TGSDORK.closeContactModal()">
    <div class="auth-card contact-modal-card">
      <div class="auth-card-top">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="brand-orb sm"><img src="data:image/png;base64,${FAVICON_B64}" alt="Logo TGSDORK" /></span>
          <span class="brand-name">TGSDORK</span>
        </div>
        <button type="button" class="icon-btn" aria-label="Tutup kontak" onclick="TGSDORK.closeContactModal()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <h2 id="contactModalTitle" data-i18n="modal_contact_title">Kontak &amp; Bantuan</h2>
      <p id="contactModalSubtitle" data-i18n="modal_contact_sub">Punya pertanyaan, saran fitur, kerja sama riset, atau kendala? Hubungi langsung melalui kanal di bawah ini:</p>

      <div class="contact-modal-list">
        <div class="contact-modal-item">
          <div class="contact-modal-item-left">
            <div class="contact-modal-icon sky">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
            </div>
            <div class="contact-modal-meta">
              <span data-i18n="modal_email_label">Email Resmi</span>
              <strong>founder@tgsdork.com</strong>
            </div>
          </div>
          <div class="contact-modal-btns">
            <button type="button" class="btn-pill btn-white sm" data-i18n="modal_copy_btn" onclick="TGSDORK.copyFounderEmail(this)">Salin</button>
            <a href="mailto:founder@tgsdork.com" class="btn-pill btn-hot-pink sm" data-i18n="modal_send_btn">Kirim</a>
          </div>
        </div>

        <div class="contact-modal-item">
          <div class="contact-modal-item-left">
            <div class="contact-modal-icon pink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </div>
            <div class="contact-modal-meta">
              <span>Instagram</span>
              <strong>@nelosif_</strong>
            </div>
          </div>
          <a href="https://instagram.com/nelosif_" target="_blank" rel="noopener noreferrer" class="btn-pill btn-hot-pink sm" data-i18n="modal_open_btn">Buka</a>
        </div>
      </div>
    </div>
  </div>

  <div id="toastStack" class="toast-stack" aria-live="polite"></div>

  <script>window.__TGSDORK_DEV_UI__ = ${devUiMode ? 'true' : 'false'};</script>
  <script src="/public/app.js?v=20261112_03"></script>
</body>
</html>`;
}
