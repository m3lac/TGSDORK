/* TGSDORK Bento Studio Client Controller */
(function () {
  let uploadedFile = null;
  let uploadedTurnitinFile = null;
  let cachedTasks = [];
  let lastAuditState = null;
  let lastTurnitinState = null;
  let chatHistory = [];
  let workspacePollTimer = null;
  let activeTaskPollTimer = null;
  let streamLines = 0;
  let streamParas = 0;

  let activeJobsList = [];
  let archiveTypeFilter = 'all';
  let archiveStatusFilter = 'all';
  let currentReadingMarkdown = '';
  const openReviseRows = new Set();

  const STEP_LABELS = {
    init: 'Inisialisasi',
    dorking: 'Menyusun kueri',
    searching: 'Mencari jurnal',
    extracting: 'Verifikasi data',
    drafting: 'Menyusun bab',
    audit: 'Audit mutu',
    exporting: 'Mengekspor',
  };
  const DEV_UI_MODE = Boolean(window.__TGSDORK_DEV_UI__);

  function getDisplayUserName() {
    const email = localStorage.getItem('tgsdork_email') || (DEV_UI_MODE ? 'dev@local' : '');
    if (!email || email === 'dev@local') return 'Peneliti';
    const localPart = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    if (!localPart) return 'Peneliti';
    return localPart
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function getInitials(email) {
    if (!email || email === 'dev@local') return 'TG';
    const parts = email.split('@')[0].split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.slice(0, 2).toUpperCase();
  }

  const VIEW_META = {
    overview: {
      get title() {
        return 'Halo, ' + getDisplayUserName() + '!';
      },
      subtitle: 'Ringkasan riset dan dokumen akademik Anda.',
    },
    workspace: {
      title: 'Arsip Dokumen',
      subtitle: 'Unduh naskah atau revisi per bab.',
    },
    generate: {
      title: 'Susun Naskah',
      subtitle: 'Penelusuran pustaka dan penyusunan naskah.',
    },
    pptx: {
      title: 'PowerPoint',
      subtitle: '10–14 salindia dengan catatan pembicara.',
    },
    review: {
      title: 'Audit & Revisi',
      subtitle: 'Evaluasi struktur dan perbaikan naskah.',
    },
    turnitin: {
      title: 'Uji Kemiripan',
      subtitle: 'Ukur kemiripan dan parafrase akademis.',
    },
    chat: {
      title: 'Diskusi Topik',
      subtitle: 'Konsultasikan judul, variabel, dan kerangka bab.',
    },
  };

  function notifyToast(message, kind) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = 'toast' + (kind ? ' ' + kind : '');
    item.setAttribute('role', 'status');
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInlineMarkdown(line) {
    return escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function renderMarkdownToHtml(md) {
    const lines = String(md || '').split('\n');
    const html = [];
    let inUl = false;
    let inOl = false;
    let tableRows = [];

    function flushLists() {
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (inOl) { html.push('</ol>'); inOl = false; }
    }

    function flushTable() {
      if (tableRows.length === 0) return;
      const dataRows = tableRows.filter((r) => !/^\|\s*[-:]+/.test(r));
      if (dataRows.length > 0) {
        html.push('<table>');
        dataRows.forEach((row, idx) => {
          const tag = idx === 0 ? 'th' : 'td';
          const cells = row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => '<' + tag + '>' + formatInlineMarkdown(c.trim()) + '</' + tag + '>')
            .join('');
          html.push('<tr>' + cells + '</tr>');
        });
        html.push('</table>');
      }
      tableRows = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        flushLists();
        tableRows.push(line);
        continue;
      } else {
        flushTable();
      }

      if (!line) {
        flushLists();
        continue;
      }
      if (/^---+$/.test(line)) {
        flushLists();
        html.push('<hr />');
        continue;
      }
      const h3 = line.match(/^###\s+(.+)/);
      if (h3) {
        flushLists();
        html.push('<h3>' + formatInlineMarkdown(h3[1]) + '</h3>');
        continue;
      }
      const h2 = line.match(/^##\s+(.+)/);
      if (h2) {
        flushLists();
        const raw = h2[1].trim();
        const chapMatch = raw.match(/^(BAB\s+[0-9IVX]+|BAGIAN\s+[0-9IVX]+|CHAPTER\s+[0-9IVX]+)\s*[:.-]?\s*(.*)$/i);
        if (chapMatch) {
          const num = escapeHtml(chapMatch[1].toUpperCase());
          const rest = escapeHtml((chapMatch[2] || '').trim().toUpperCase());
          html.push(
            '<div class="reader-chapter-divider"><hr /></div>' +
            '<h2 class="chapter-heading">' +
            '<span class="chapter-num">' + num + '</span>' +
            (rest ? '<span class="chapter-title">' + rest + '</span>' : '') +
            '</h2>'
          );
        } else if (/^(?:daftar\s+pustaka|references|bibliography|lampiran)\b/i.test(raw)) {
          html.push(
            '<div class="reader-chapter-divider"><hr /></div>' +
            '<h2 class="chapter-heading"><span class="chapter-title">' + escapeHtml(raw.toUpperCase()) + '</span></h2>'
          );
        } else if (/^(?:abstrak|abstract)\b/i.test(raw)) {
          html.push(
            '<h2 class="chapter-heading abstrak-heading"><span class="chapter-title">' + escapeHtml(raw.toUpperCase()) + '</span></h2>'
          );
        } else {
          html.push('<h2>' + formatInlineMarkdown(raw) + '</h2>');
        }
        continue;
      }
      const h1 = line.match(/^#\s+(.+)/);
      if (h1) {
        flushLists();
        html.push('<h1>' + formatInlineMarkdown(h1[1]) + '</h1>');
        continue;
      }
      const ul = line.match(/^[-*]\s+(.+)/);
      if (ul) {
        if (inOl) { html.push('</ol>'); inOl = false; }
        if (!inUl) { html.push('<ul>'); inUl = true; }
        html.push('<li>' + formatInlineMarkdown(ul[1]) + '</li>');
        continue;
      }
      const ol = line.match(/^\d+\.\s+(.+)/);
      if (ol) {
        if (inUl) { html.push('</ul>'); inUl = false; }
        if (!inOl) { html.push('<ol>'); inOl = true; }
        html.push('<li>' + formatInlineMarkdown(ol[1]) + '</li>');
        continue;
      }
      flushLists();
      html.push('<p>' + formatInlineMarkdown(line) + '</p>');
    }
    flushLists();
    flushTable();
    return html.join('\n');
  }

  function parseAuditSummary(reportText) {
    const scoreMatch =
      String(reportText || '').match(/Skor[^:\n]*?:?\s*\*?\*?\s*([0-9]{1,3})\s*(?:\/|\s*dari\s*)\s*100/i) ||
      String(reportText || '').match(/([0-9]{1,3})\s*\/\s*100/);
    const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : null;
    const statusMatch = String(reportText || '').match(/Status\s*Kelayakan\s*:?\s*\*?\*?\s*([^\n*]+)/i);
    const status = statusMatch
      ? statusMatch[1].trim()
      : score !== null
      ? score >= 80
        ? 'Siap Kumpul'
        : score >= 70
        ? 'Perlu Revisi Minor'
        : 'Perlu Revisi Mayor'
      : 'Selesai Dianalisis';
    return { score, status };
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const str = String(reader.result || '');
        const comma = str.indexOf(',');
        resolve(comma >= 0 ? str.slice(comma + 1) : str);
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas dari perangkat.'));
      reader.readAsDataURL(file);
    });
  }

  function getAuthToken() {
    const existing = localStorage.getItem('tgsdork_token');
    if (existing) return existing;
    if (DEV_UI_MODE && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      return 'dev-local-ui';
    }
    return null;
  }

  function checkAuth() {
    let token = getAuthToken();
    let email = localStorage.getItem('tgsdork_email');
    if (DEV_UI_MODE && (!token || !email) && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      token = 'dev-local-ui';
      email = 'dev@local';
    }
    const overlay = document.getElementById('authOverlay');
    const userBadge = document.getElementById('userBadge');
    const emailLabel = document.getElementById('userEmailLabel');
    const avatarOrb = document.getElementById('userAvatarInitials');

    if (!token || !email) {
      if (overlay) overlay.style.display = 'flex';
      if (userBadge) userBadge.style.display = 'none';
      return false;
    }
    if (overlay) overlay.style.display = 'none';
    if (userBadge) userBadge.style.display = 'inline-flex';
    if (emailLabel) emailLabel.textContent = email;
    if (avatarOrb) avatarOrb.textContent = getInitials(email);

    // Refresh greeting if currently on overview tab
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === 'overview') {
      const st = document.getElementById('stageTitle');
      if (st) st.textContent = VIEW_META.overview.title;
    }
    return true;
  }

  async function sendAuthCode() {
    const email = document.getElementById('authEmail').value.trim();
    if (!email || !email.includes('@')) {
      notifyToast('Mohon masukkan alamat email yang valid (contoh: nama@kampus.ac.id).', 'error');
      return;
    }
    const btn = document.getElementById('btnSendCode');
    btn.disabled = true;
    btn.textContent = 'Mengirim kode verifikasi...';
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      document.getElementById('authStep1').style.display = 'none';
      document.getElementById('authStep2').style.display = 'block';
      const titleEl = document.getElementById('authModalTitle');
      const subEl = document.getElementById('authModalSubtitle');
      if (titleEl) titleEl.textContent = 'Periksa Kotak Masuk Email Anda';
      if (subEl) {
        subEl.innerHTML = 'Masukkan 6 digit kode verifikasi (OTP) yang baru saja kami kirimkan untuk membuka ruang kerja Anda.';
      }
      const hintEl = document.getElementById('codeHint');
      if (hintEl) {
        if (d.previewCode) {
          hintEl.innerHTML =
            '<div class="otp-hint-title">Kode Verifikasi Sistem Siap Digunakan</div>' +
            '<div class="otp-hint-body">' + escapeHtml(d.message) + '</div>';
        } else {
          hintEl.innerHTML =
            '<div class="otp-hint-title">Kode OTP terkirim ke <strong>' + escapeHtml(email) + '</strong></div>' +
            '<div class="otp-hint-body">Dikirim melalui <code>noreply@tgsdork.com</code>. Silakan periksa <strong>Kotak Masuk (Inbox)</strong> atau folder <strong>Spam / Promosi</strong> Anda. Kode berlaku selama 10 menit.</div>';
        }
      }
      notifyToast('Kode OTP 6 digit telah dikirim ke ' + email + '. Silakan cek Inbox atau folder Spam Anda.', 'success');
      document.getElementById('authCode').focus();
    } catch (err) {
      notifyToast('Gagal mengirim kode OTP: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Kode Verifikasi (OTP)';
    }
  }

  async function verifyAuthCode() {
    const email = document.getElementById('authEmail').value.trim();
    const code = document.getElementById('authCode').value.trim();
    if (!code || code.length < 6) {
      notifyToast('Mohon masukkan lengkap 6 digit angka kode verifikasi (OTP).', 'error');
      return;
    }
    const btn = document.getElementById('btnVerifyCode');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi kode OTP...';
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const d = await res.json();
      if (!d.success || !d.token) throw new Error(d.error || 'Verifikasi gagal');
      localStorage.setItem('tgsdork_token', d.token);
      localStorage.setItem('tgsdork_email', d.email);
      checkAuth();
      loadWorkspaceTasks();
      loadActiveJobs();
      if (appWs && appWs.readyState === WebSocket.OPEN) {
        try { appWs.send(JSON.stringify({ type: 'auth', token: d.token })); } catch {}
      }
      notifyToast('Verifikasi berhasil! Selamat datang di TGSDORK Studio (' + d.email + ').', 'success');
    } catch (err) {
      notifyToast(err.message || 'Kode verifikasi tidak valid.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verifikasi & Masuk Studio';
    }
  }

  function resetAuthStep() {
    document.getElementById('authStep1').style.display = 'block';
    document.getElementById('authStep2').style.display = 'none';
    document.getElementById('authCode').value = '';
    const titleEl = document.getElementById('authModalTitle');
    const subEl = document.getElementById('authModalSubtitle');
    if (titleEl) titleEl.textContent = 'Masuk ke TGSDORK Studio';
    if (subEl) {
      subEl.innerHTML = 'Masukkan alamat email aktif Anda. Kami akan mengirimkan 6 digit kode verifikasi sekali pakai (OTP) dari <strong>noreply@tgsdork.com</strong>.';
    }
  }

  async function logout() {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        });
      } catch {}
    }
    localStorage.removeItem('tgsdork_token');
    localStorage.removeItem('tgsdork_email');
    window.location.href = '/';
  }

  function toggleSidebarRail() {
    const shell = document.getElementById('appShell');
    if (!shell) return;
    const collapsed = shell.classList.toggle('rail-collapsed');
    localStorage.setItem('tgsdork_rail_collapsed', collapsed ? '1' : '0');
  }

  function switchNav(tab) {
    const validTabs = ['overview', 'workspace', 'generate', 'pptx', 'review', 'turnitin', 'chat'];
    const targetTab = validTabs.includes(tab) ? tab : 'overview';

    document.querySelectorAll('.nav-btn').forEach((b) => {
      const isTarget = b.getAttribute('data-tab') === targetTab;
      b.classList.toggle('active', isTarget);
      b.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });

    const meta = VIEW_META[targetTab] || VIEW_META.overview;
    const st = document.getElementById('stageTitle');
    const sub = document.getElementById('stageSubtitle');
    if (st) st.textContent = meta.title;
    if (sub) sub.textContent = meta.subtitle;
    const newDocBtn = document.getElementById('headerNewDocBtn');
    if (newDocBtn) {
      newDocBtn.style.display = targetTab === 'generate' ? 'none' : 'inline-flex';
    }

    for (const name of validTabs) {
      const el = document.getElementById('tab-' + name);
      if (el) el.style.display = name === targetTab ? 'block' : 'none';
    }

    if (targetTab === 'workspace' || targetTab === 'overview') {
      loadWorkspaceTasks();
    }
  }

  function quickSearchArchive(query) {
    switchNav('workspace');
    const searchEl = document.getElementById('searchDoc');
    if (searchEl) {
      searchEl.value = String(query || '').trim();
      filterDocs();
      searchEl.focus();
    }
  }

  function toggleCoverFields() {
    const on = document.getElementById('coverToggle').value === 'on';
    document.getElementById('coverFields').style.display = on ? 'block' : 'none';
  }

  function updateChapterOptions() {
    const taskType = document.getElementById('taskType').value;
    const select = document.getElementById('chapterConfig');
    if (taskType === 'skripsi') {
      select.value = '5';
    } else if (taskType === 'makalah') {
      select.value = 'auto';
    }
    handleChapterConfigChange();
  }

  function handleChapterConfigChange() {
    const val = document.getElementById('chapterConfig').value;
    document.getElementById('customChapterWrap').style.display = val === 'custom' ? 'block' : 'none';
  }

  function setPipelineStepState(stepName) {
    const order = ['dorking', 'searching', 'extracting', 'drafting', 'audit'];
    const currentIdx = stepName === 'completed' ? order.length : order.indexOf(stepName);
    order.forEach((key, idx) => {
      const el = document.getElementById('pipe-' + key);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (currentIdx > idx || stepName === 'completed') {
        el.classList.add('done');
      } else if (currentIdx === idx) {
        el.classList.add('active');
      }
    });
  }

  // Audit & Revise
  function setAuditFile(file) {
    if (!file) return;
    uploadedFile = file;
    document.getElementById('dropText').innerHTML =
      'Berkas dipilih: <strong>' + escapeHtml(file.name) + '</strong> (' + (file.size / 1024).toFixed(1) + ' KB)';
    document.getElementById('manualFilePath').value = '';
  }

  function updateAuditReportUI(reportMarkdown) {
    const { score, status } = parseAuditSummary(reportMarkdown);
    const scoreEl = document.getElementById('auditScoreValue');
    const pillEl = document.getElementById('auditStatusPill');
    if (scoreEl) {
      scoreEl.textContent = score !== null ? score + ' / 100' : '-- / 100';
    }
    if (pillEl) {
      pillEl.textContent = status;
      pillEl.className = 'score-status-pill ' + (score === null ? '' : score >= 80 ? 'good' : score >= 65 ? 'warn' : 'bad');
    }
    document.getElementById('reportContent').innerHTML = renderMarkdownToHtml(reportMarkdown);
  }

  async function executeAudit() {
    const btn = document.getElementById('btnAudit');
    const repArea = document.getElementById('reportArea');
    const revBanner = document.getElementById('reviseResultBanner');
    const manual = document.getElementById('manualFilePath').value.trim();

    if (!uploadedFile && !manual) {
      notifyToast('Pilih berkas naskah (.docx/.pdf/.md) terlebih dahulu atau isi nama file.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memeriksa struktur, sitasi & PUEBI...';
    revBanner.style.display = 'none';
    document.getElementById('reportContent').innerHTML = '<p style="color:var(--ink-muted);margin:0;">Sedang menganalisis struktur naskah, sitasi, dan tata bahasa...</p>';
    try {
      let d;
      if (uploadedFile) {
        const base64Data = await readFileAsBase64(uploadedFile);
        const res = await fetch('/api/upload-review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getAuthToken(),
          },
          body: JSON.stringify({ filename: uploadedFile.name, data: base64Data }),
        });
        d = await res.json();
        if (d.error) throw new Error(d.error);
        lastAuditState = { filename: d.filename || uploadedFile.name, text: d.text, report: d.result };
      } else {
        const res = await fetch('/api/review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + getAuthToken(),
          },
          body: JSON.stringify({ target: manual }),
        });
        d = await res.json();
        if (d.error) throw new Error(d.error);
        lastAuditState = { filename: d.filename || manual, text: d.text || '', report: d.result };
      }

      updateAuditReportUI(d.result);
      repArea.style.display = 'block';
      notifyToast('Audit akademik selesai.', 'success');
    } catch (err) {
      notifyToast('Audit gagal: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Periksa Kelayakan Naskah';
    }
  }

  async function triggerAuditAutoRevise() {
    if (!lastAuditState || !lastAuditState.text) {
      notifyToast('Jalankan audit naskah terlebih dahulu sebelum memulai revisi.', 'error');
      return;
    }
    const btn = document.getElementById('btnDoAutoRevise');
    const banner = document.getElementById('reviseResultBanner');
    btn.disabled = true;
    btn.textContent = 'Menyiapkan jurnal Indonesia & revisi...';

    try {
      const res = await fetch('/api/audit-revise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getAuthToken(),
        },
        body: JSON.stringify({
          filename: lastAuditState.filename,
          text: lastAuditState.text,
          auditReport: lastAuditState.report,
        }),
      });
      const initData = JSON.parse(await res.text());
      if (initData.error) throw new Error(initData.error);
      const jobId = initData.jobId;

      await new Promise((resolve, reject) => {
        const timer = setInterval(async () => {
          try {
            const sRes = await fetch('/api/audit-revise/status?jobId=' + encodeURIComponent(jobId), {
              headers: { Authorization: 'Bearer ' + getAuthToken() },
            });
            const sData = JSON.parse(await sRes.text());
            if (sData.status === 'completed') {
              clearInterval(timer);
              const d = sData.result;
              document.getElementById('dlDocxLink').href = d.docxUrl;
              document.getElementById('dlPdfLink').href = d.pdfUrl;
              document.getElementById('dlBibLink').href = d.bibUrl;
              document.getElementById('dlMdLink').href = d.mdUrl;
              document.getElementById('reviseSuccessTitle').textContent = 'Revisi Selesai';
              document.getElementById('reviseSuccessMeta').textContent =
                'Diselesaikan dalam ' + (d.rounds || 1) + ' putaran evaluasi dengan rujukan jurnal Indonesia terverifikasi.';
              if (d.finalReport) {
                lastAuditState.report = d.finalReport;
                if (d.revisedText) lastAuditState.text = d.revisedText;
                updateAuditReportUI(d.finalReport);
              }
              banner.style.display = 'block';
              notifyToast('Revisi selesai dengan skor ' + d.finalScore + '/100.', 'success');
              resolve(null);
            } else if (sData.status === 'error') {
              clearInterval(timer);
              reject(new Error(sData.error || 'Revisi otomatis gagal'));
            } else if (sData.progress) {
              btn.textContent = sData.progress;
            }
          } catch {}
        }, 3000);
      });
    } catch (err) {
      notifyToast('Revisi gagal: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Perbaiki Otomatis';
    }
  }

  function copyReportText() {
    if (!lastAuditState || !lastAuditState.report) return;
    navigator.clipboard.writeText(lastAuditState.report).then(() => {
      notifyToast('Laporan audit disalin ke papan klip.', 'success');
    });
  }

  // Turnitin / Similarity
  function setTurnitinFile(file) {
    if (!file) return;
    uploadedTurnitinFile = file;
    document.getElementById('turnitinDropText').innerHTML =
      'Berkas dipilih: <strong>' + escapeHtml(file.name) + '</strong> (' + (file.size / 1024).toFixed(1) + ' KB)';
    document.getElementById('turnitinText').value = '';
  }

  function renderTurnitinResult(d) {
    lastTurnitinState = { filename: d.filename, text: d.text, report: d.result };
    document.getElementById('turnitinReportContent').innerHTML = renderMarkdownToHtml(d.result);

    const sim = Number(d.similarityScore || 0);
    const ai = Number(d.aiScore || 0);
    const simBadge = document.getElementById('simScoreBadge');
    const simNote = document.getElementById('simStatusBadge');
    simBadge.textContent = sim + '%';
    if (sim < 20) {
      simBadge.style.color = 'var(--sky-ink)';
      simNote.textContent = 'Di bawah batas kemiripan 20%';
    } else if (sim <= 30) {
      simBadge.style.color = 'var(--warning)';
      simNote.textContent = 'Sedang — disarankan parafrase';
    } else {
      simBadge.style.color = 'var(--pink-cta)';
      simNote.textContent = 'Tinggi — wajib parafrase ulang';
    }

    const aiBadge = document.getElementById('aiScoreBadge');
    const aiNote = document.getElementById('aiStatusBadge');
    aiBadge.textContent = ai + '%';
    if (ai < 15) {
      aiBadge.style.color = 'var(--sky-ink)';
      aiNote.textContent = 'Variasi kalimat alami';
    } else {
      aiBadge.style.color = 'var(--pink-cta)';
      aiNote.textContent = 'Pola kalimat monoton terdeteksi';
    }

    document.getElementById('turnitinReportArea').style.display = 'block';
  }

  async function executeTurnitinScan() {
    const btn = document.getElementById('btnTurnitin');
    const repArea = document.getElementById('turnitinReportArea');
    const banner = document.getElementById('turnitinParaphraseBanner');
    const textManual = document.getElementById('turnitinText').value.trim();

    if (!uploadedTurnitinFile && !textManual) {
      notifyToast('Pilih berkas naskah atau tempel teks yang akan diperiksa.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Memindai kemiripan naskah...';
    banner.style.display = 'none';
    document.getElementById('turnitinReportContent').innerHTML = '<p style="color:var(--ink-muted);margin:0;">Sedang memindai proporsi kemiripan dan pola kalimat...</p>';
    try {
      let payload;
      if (uploadedTurnitinFile) {
        const base64Data = await readFileAsBase64(uploadedTurnitinFile);
        payload = { filename: uploadedTurnitinFile.name, data: base64Data };
      } else {
        payload = { filename: 'Naskah_Input.txt', text: textManual };
      }

      const res = await fetch('/api/turnitin/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getAuthToken(),
        },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      renderTurnitinResult(d);
      notifyToast('Pemeriksaan kemiripan selesai.', 'success');
    } catch (err) {
      notifyToast('Pemindaian gagal: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Periksa Skor Kemiripan';
    }
  }

  async function triggerTurnitinParaphrase() {
    if (!lastTurnitinState) {
      notifyToast('Jalankan pemeriksaan kemiripan terlebih dahulu.', 'error');
      return;
    }
    const btn = document.getElementById('btnDoTurnitinParaphrase');
    const banner = document.getElementById('turnitinParaphraseBanner');
    btn.disabled = true;
    btn.textContent = 'Menulis ulang struktur kalimat...';

    try {
      const res = await fetch('/api/turnitin/paraphrase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getAuthToken(),
        },
        body: JSON.stringify({
          filename: lastTurnitinState.filename,
          text: lastTurnitinState.text,
          turnitinReport: lastTurnitinState.report,
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);

      document.getElementById('dlTurnitinDocx').href = d.docxUrl;
      document.getElementById('dlTurnitinPdf').href = d.pdfUrl;
      document.getElementById('dlTurnitinMd').href = d.mdUrl;
      document.getElementById('turnitinPassTitle').textContent =
        'Parafrase Selesai — Kemiripan Turun ke ' + d.newSimilarityScore + '% (Indeks AI ' + d.newAiScore + '%)';
      if (d.newReport) {
        renderTurnitinResult({
          filename: d.fileName,
          text: lastTurnitinState.text,
          result: d.newReport,
          similarityScore: d.newSimilarityScore,
          aiScore: d.newAiScore,
        });
      }
      banner.style.display = 'block';
      notifyToast('Parafrase selesai dan berkas siap diunduh.', 'success');
    } catch (err) {
      notifyToast('Parafrase gagal: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Parafrase Naskah Otomatis';
    }
  }

  function copyTurnitinReport() {
    if (!lastTurnitinState || !lastTurnitinState.report) return;
    navigator.clipboard.writeText(lastTurnitinState.report).then(() => {
      notifyToast('Laporan kemiripan disalin ke papan klip.', 'success');
    });
  }

  // =========================================================================
  // OVERVIEW BENTO DASHBOARD & WORKSPACE ARCHIVE ("Order list" Reference)
  // =========================================================================

  function isTaskActivelyRunning(t) {
    if (!t || !t.step || t.step === 'completed' || t.step === 'failed') return false;
    const ageMs = Date.now() - Number(t.updatedAt || 0);
    return ageMs >= 0 && ageMs < 15 * 60 * 1000;
  }

  function getMergedRunningJobs() {
    const runningFromWs = (Array.isArray(activeJobsList) ? activeJobsList : []).filter((j) => j.status === 'running');
    const wsIds = new Set(runningFromWs.map((j) => j.id));
    const fallbackTasks = (Array.isArray(cachedTasks) ? cachedTasks : [])
      .filter((t) => isTaskActivelyRunning(t) && !wsIds.has(t.id))
      .map((t) => ({
        id: t.id,
        type: 'susun_naskah',
        typeLabel: 'Susun Naskah',
        title: t.topic,
        step: t.step,
        detail: (STEP_LABELS[t.step] || t.step) + '...',
        status: 'running',
      }));
    return [...runningFromWs, ...fallbackTasks];
  }

  function updateUnifiedRealtimeStatus(jobs) {
    if (Array.isArray(jobs)) {
      activeJobsList = jobs;
    }
    const runningJobs = getMergedRunningJobs();
    const runningCount = runningJobs.length;

    const countEl = document.getElementById('ovRunningCount');
    const pillEl = document.getElementById('ovRunningPill');
    const noteEl = document.getElementById('ovRunningNote');
    if (countEl) countEl.textContent = String(runningCount);
    if (pillEl) {
      pillEl.textContent = runningCount > 0 ? (runningCount + ' Aktif') : 'Tenang';
      pillEl.className = 'mini-pill ' + (runningCount > 0 ? 'pink' : 'sky');
    }
    if (noteEl) {
      if (runningCount === 0) {
        noteEl.textContent = 'Semua proses jalan paralel tanpa antrean';
      } else if (runningCount === 1) {
        const j = runningJobs[0];
        noteEl.textContent = `${j.typeLabel || 'Proses'}: ${j.title || j.detail}`;
      } else {
        const types = Array.from(new Set(runningJobs.map((j) => j.typeLabel || 'Proses'))).join(', ');
        noteEl.textContent = `${runningCount} proses berjalan paralel (${types})`;
      }
    }

    const panel = document.getElementById('ovLiveJobsPanel');
    const listEl = document.getElementById('ovLiveJobsList');
    const badgeEl = document.getElementById('ovLiveJobsBadge');
    if (panel && listEl) {
      if (runningCount === 0) {
        panel.style.display = 'none';
        listEl.innerHTML = '';
      } else {
        panel.style.display = 'block';
        if (badgeEl) badgeEl.textContent = runningCount + ' aktif';
        listEl.innerHTML = runningJobs
          .map((j) => {
            const typeClass =
              j.type === 'susun_naskah' ? 'sky' :
              j.type === 'audit_revisi' ? 'amber' :
              j.type === 'uji_kemiripan' ? 'cyan' : 'pink';
            const targetNav =
              j.type === 'susun_naskah' ? 'generate' :
              j.type === 'audit_revisi' ? 'review' :
              j.type === 'uji_kemiripan' ? 'turnitin' : 'pptx';
            return (
              '<div class="ov-live-job-item">' +
              '<div class="ov-live-job-main">' +
              '<span class="live-pulse-dot" aria-hidden="true"></span>' +
              '<div class="ov-live-job-texts">' +
              '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span class="tag ' + typeClass + '">' + escapeHtml(j.typeLabel || j.type) + '</span>' +
              '<strong class="ov-live-job-title">' + escapeHtml(j.title) + '</strong>' +
              '</div>' +
              '<span class="ov-live-job-detail">' + escapeHtml(j.detail || 'Sedang memproses...') + '</span>' +
              '</div>' +
              '</div>' +
              '<button type="button" class="action-btn sm" onclick="TGSDORK.switchNav(\'' + targetNav + '\')">Buka &rarr;</button>' +
              '</div>'
            );
          })
          .join('');
      }
    }

    if (runningCount > 0) {
      const top = runningJobs[0];
      const targetNav =
        top.type === 'susun_naskah' ? 'generate' :
        top.type === 'audit_revisi' ? 'review' :
        top.type === 'uji_kemiripan' ? 'turnitin' : 'pptx';
      const prefix = runningCount > 1 ? `[${runningCount} Proses Aktif] ` : `[${top.typeLabel || 'Proses'}] `;
      updateLiveProgressBanner({
        active: true,
        text: prefix + (top.detail || top.title),
        targetTab: targetNav,
      });
    } else {
      updateLiveProgressBanner({ active: false });
    }
  }

  async function loadActiveJobs() {
    try {
      const res = await fetch('/api/active-jobs', {
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      if (res.ok) {
        const jobs = await res.json();
        updateUnifiedRealtimeStatus(jobs);
      }
    } catch {}
  }

  function renderOverviewDashboard(tasks) {
    const list = Array.isArray(tasks) ? tasks : [];
    const total = list.length;
    const done = list.filter((t) => t.step === 'completed').length;
    const totalSources = list.reduce((acc, t) => acc + (Array.isArray(t.sources) ? t.sources.length : 0), 0);
    const totalSections = list.reduce((acc, t) => acc + (Array.isArray(t.sections) ? t.sections.length : 0), 0);

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };

    setTxt('ovTotalDocs', total);
    setTxt('ovCompletedRate', done + ' selesai');
    setTxt('ovTotalSources', totalSources);
    setTxt('ovTotalSections', totalSections);

    updateUnifiedRealtimeStatus();
    renderOverviewRecentList(list);
  }

  function renderOverviewRecentList(tasks) {
    const box = document.getElementById('ovRecentList');
    if (!box) return;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      box.innerHTML =
        '<div class="empty-state" style="padding:24px 16px;">' +
        '<strong>Belum ada naskah tersimpan.</strong>' +
        '<p style="margin-top:4px;font-size:12.5px;">Klik <strong>Susun Naskah</strong> di atas untuk membuat dokumen pertama Anda.</p>' +
        '</div>';
      return;
    }
    const token = getAuthToken() || '';
    const qs = token ? '?token=' + encodeURIComponent(token) : '';
    const rows = tasks
      .slice(0, 5)
      .map((t) => {
        const isDone = t.step === 'completed';
        const isRunning = isTaskActivelyRunning(t);
        const srcCount = t.sources ? t.sources.length : 0;
        const secCount = t.sections ? t.sections.length : 0;
        const dateStr = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('id-ID') : '-';
        const idAttr = escapeHtml(t.id);
        const dl = (ext) => '/api/download/' + encodeURIComponent(t.id) + '/' + ext + qs;

        const statusHtml = isDone
          ? '<span class="status-pill done">Selesai</span>'
          : isRunning
          ? '<span class="status-pill running">' + escapeHtml(STEP_LABELS[t.step] || 'Memproses') + '</span>'
          : '<span class="status-pill">Tersimpan</span>';

        const actHtml = isDone
          ? '<div class="actions-row nowrap">' +
            '<button type="button" class="action-btn" data-action="read-doc" data-id="' + idAttr + '">Baca</button>' +
            '<a class="action-btn accent" href="' + dl('docx') + '">DOCX</a>' +
            '<a class="action-btn" href="' + dl('pdf') + '">PDF</a>' +
            '</div>'
          : '<div class="actions-row nowrap">' +
            '<button type="button" class="action-btn" onclick="TGSDORK.switchNav(\'workspace\')">Arsip</button>' +
            '</div>';

        return (
          '<tr>' +
          '<td class="doc-title-cell"><strong>' + escapeHtml(t.topic) + '</strong><span>' + secCount + ' bagian &bull; ' + srcCount + ' rujukan</span></td>' +
          '<td><span class="tag">' + escapeHtml(t.taskType || 'makalah') + '</span></td>' +
          '<td>' + escapeHtml(dateStr) + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td class="actions-cell">' + actHtml + '</td>' +
          '</tr>'
        );
      })
      .join('');

    box.innerHTML =
      '<div class="bento-table-wrap">' +
      '<table class="bento-table">' +
      '<thead><tr><th>JUDUL NASKAH</th><th>JENIS</th><th>TANGGAL</th><th>STATUS</th><th style="text-align:right;">AKSI</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>';
  }

  async function loadWorkspaceTasks() {
    try {
      const res = await fetch('/api/tasks', {
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      if (!res.ok) return;
      cachedTasks = await res.json();
      const countBadge = document.getElementById('navWorkspaceCount');
      if (countBadge) {
        countBadge.textContent = String(Array.isArray(cachedTasks) ? cachedTasks.length : 0);
      }
      renderOverviewDashboard(cachedTasks);
      filterDocs();

      updateUnifiedRealtimeStatus();
    } catch (err) {
      console.error('Gagal memuat arsip:', err);
    }
  }

  function updateLiveProgressBanner(info) {
    const banner = document.getElementById('globalProgressBanner');
    const textEl = document.getElementById('globalProgressText');
    const linkBtn = banner ? banner.querySelector('.progress-link-btn') : null;
    if (!banner || !textEl) return;
    if (!info || !info.active) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'flex';
    textEl.textContent = info.text || 'Sedang memproses naskah...';
    if (linkBtn && info.targetTab) {
      linkBtn.onclick = () => switchNav(info.targetTab);
    }
  }

  async function openDocReader(id) {
    const task = cachedTasks.find((t) => t.id === id);
    const modal = document.getElementById('docReaderModal');
    const titleEl = document.getElementById('readerDocTitle');
    const typeEl = document.getElementById('readerDocType');
    const bodyEl = document.getElementById('readerDocBody');
    const docxDl = document.getElementById('readerDocxDl');
    const pdfDl = document.getElementById('readerPdfDl');
    if (!modal || !bodyEl) return;

    const token = getAuthToken() || '';
    const qs = token ? '?token=' + encodeURIComponent(token) : '';

    if (titleEl) titleEl.textContent = task ? task.topic : 'Naskah';
    if (typeEl) typeEl.textContent = task ? (task.taskType || 'makalah').toUpperCase() : 'DOKUMEN';
    if (docxDl) docxDl.href = '/api/download/' + encodeURIComponent(id) + '/docx' + qs;
    if (pdfDl) pdfDl.href = '/api/download/' + encodeURIComponent(id) + '/pdf' + qs;

    bodyEl.innerHTML = '<p style="color:var(--ink-muted);text-align:center;padding:36px 0;">Memuat naskah...</p>';
    modal.style.display = 'flex';

    try {
      const res = await fetch('/api/view/' + encodeURIComponent(id) + '/md' + qs);
      if (!res.ok) throw new Error('Gagal memuat naskah.');
      const md = await res.text();
      currentReadingMarkdown = md;
      bodyEl.innerHTML = renderMarkdownToHtml(md);
    } catch (err) {
      bodyEl.innerHTML = '<p style="color:var(--pink-ink);text-align:center;padding:36px 0;">' + escapeHtml(err.message) + '</p>';
    }
  }

  function closeDocReader() {
    const modal = document.getElementById('docReaderModal');
    if (modal) modal.style.display = 'none';
    currentReadingMarkdown = '';
  }

  function copyReaderText() {
    if (!currentReadingMarkdown) return;
    navigator.clipboard.writeText(currentReadingMarkdown).then(() => {
      notifyToast('Isi naskah disalin ke papan klip.', 'success');
    });
  }


  function setArchiveTypeFilter(type) {
    archiveTypeFilter = type || 'all';
    document.querySelectorAll('.archive-filter-bar .filter-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-type-filter') === archiveTypeFilter);
    });
    filterDocs();
  }

  function setArchiveStatusFilter(status) {
    archiveStatusFilter = status || 'all';
    filterDocs();
  }

  function resetArchiveFilters() {
    archiveTypeFilter = 'all';
    archiveStatusFilter = 'all';
    const searchEl = document.getElementById('searchDoc');
    if (searchEl) searchEl.value = '';
    setArchiveTypeFilter('all');
  }

  function filterDocs() {
    const q = (document.getElementById('searchDoc')?.value || '').toLowerCase().trim();
    const sortMode = document.getElementById('archiveSortSelect')?.value || 'newest';
    const clearBtn = document.getElementById('btnClearArchiveFilters');
    if (clearBtn) {
      clearBtn.style.display = q || archiveTypeFilter !== 'all' || archiveStatusFilter !== 'all' ? 'inline-block' : 'none';
    }

    let filtered = (Array.isArray(cachedTasks) ? cachedTasks : []).slice();

    if (q) {
      filtered = filtered.filter(
        (t) =>
          (t.topic || '').toLowerCase().includes(q) ||
          (t.taskType || '').toLowerCase().includes(q) ||
          (t.id || '').toLowerCase().includes(q)
      );
    }

    if (archiveTypeFilter !== 'all') {
      filtered = filtered.filter((t) => (t.taskType || 'makalah') === archiveTypeFilter);
    }

    if (archiveStatusFilter === 'completed') {
      filtered = filtered.filter((t) => t.step === 'completed');
    } else if (archiveStatusFilter === 'running') {
      filtered = filtered.filter((t) => t.step && t.step !== 'completed' && t.step !== 'failed');
    } else if (archiveStatusFilter === 'sources') {
      filtered = filtered.filter((t) => Array.isArray(t.sources) && t.sources.length >= 5);
    }

    if (sortMode === 'oldest') {
      filtered.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    } else if (sortMode === 'sources') {
      filtered.sort((a, b) => (b.sources?.length || 0) - (a.sources?.length || 0));
    } else if (sortMode === 'title') {
      filtered.sort((a, b) => String(a.topic || '').localeCompare(String(b.topic || ''), 'id'));
    } else {
      filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    const resCount = document.getElementById('archiveResultCount');
    if (resCount) resCount.textContent = filtered.length + ' dokumen';

    renderTaskList(filtered);
  }

  function renderTaskList(tasks) {
    if (workspacePollTimer) {
      clearTimeout(workspacePollTimer);
      workspacePollTimer = null;
    }

    const hasPending = Array.isArray(cachedTasks) && cachedTasks.some(isTaskActivelyRunning);
    if (hasPending) {
      workspacePollTimer = setTimeout(loadWorkspaceTasks, 4000);
    }

    const container = document.getElementById('workspaceList');
    if (!container) return;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<strong>Belum ada dokumen yang cocok dengan tampilan ini.</strong>' +
        '<p style="margin-top:6px;font-size:13px;">Mulai susun makalah, skripsi, atau tinjauan pustaka baru untuk melihatnya di arsip.</p>' +
        '</div>';
      return;
    }

    const token = getAuthToken() || '';
    const qs = token ? '?token=' + encodeURIComponent(token) : '';
    const stepLabels = {
      init: 'Inisialisasi',
      dorking: 'Menyusun kueri',
      searching: 'Mencari jurnal',
      extracting: 'Verifikasi data',
      drafting: 'Menyusun bab',
      audit: 'Audit mutu',
      exporting: 'Mengekspor',
    };

    const rowsHtml = tasks
      .map((t) => {
        const isDone = t.step === 'completed';
        const isRunning = isTaskActivelyRunning(t);
        const dateStr = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('id-ID') : '-';
        const srcCount = t.sources ? t.sources.length : 0;
        const secCount = t.sections ? t.sections.length : 0;
        const isRevOpen = openReviseRows.has(t.id);

        const statusBadge = isDone
          ? '<span class="status-pill done">Selesai</span>'
          : isRunning
          ? '<span class="status-pill running">' + escapeHtml(stepLabels[t.step] || t.step || 'Memproses') + '</span>'
          : '<span class="status-pill">Draf</span>';

        const idAttr = escapeHtml(t.id);
        const dl = (ext) => '/api/download/' + encodeURIComponent(t.id) + '/' + ext + qs;
        const view = (kind) => '/api/view/' + encodeURIComponent(t.id) + '/' + kind + qs;

        const actionsHtml = isDone
          ? '<div class="actions-row nowrap">' +
            '<button type="button" class="action-btn" data-action="read-doc" data-id="' + idAttr + '">Baca</button>' +
            '<a class="action-btn accent" href="' + dl('docx') + '">DOCX</a>' +
            '<a class="action-btn" href="' + dl('pdf') + '">PDF</a>' +
            '<button type="button" class="action-btn" data-action="toggle-revise" data-id="' + idAttr + '" aria-label="Aksi lainnya">&#8943;</button>' +
            '</div>'
          : '<div class="actions-row nowrap">' +
            '<button type="button" class="action-btn danger" data-action="delete" data-id="' + idAttr + '" data-topic="' + escapeHtml(t.topic) + '">Hapus</button>' +
            '</div>';

        const sectionOptions = (t.sections || [])
          .map((s) => {
            const shortLabel = String(s.title || '').replace(/\s*\([^)]*\)/g, '').trim().slice(0, 48);
            return '<option value="' + escapeHtml(s.title) + '">' + escapeHtml(shortLabel || s.title) + '</option>';
          })
          .join('');

        const reviseDrawerHtml = isDone
          ? '<tr id="revRow-' + idAttr + '" style="display:' + (isRevOpen ? 'table-row' : 'none') + ';">' +
            '<td colspan="6" style="border-top:none;padding-top:0;">' +
            '<div class="drawer-panel">' +
            '<div class="actions-row">' +
            '<a class="action-btn" href="' + dl('pptx') + '">PowerPoint</a>' +
            '<a class="action-btn" href="' + dl('bib') + '">BibTeX</a>' +
            '<a class="action-btn" href="' + dl('zip') + '">ZIP</a>' +
            '<a class="action-btn" href="' + view('md') + '" target="_blank">Markdown</a>' +
            '<a class="action-btn" href="' + view('review') + '" target="_blank">Hasil Audit</a>' +
            '<button type="button" class="action-btn success" data-action="autorevise" data-id="' + idAttr + '">Revisi Otomatis</button>' +
            '<button type="button" class="action-btn danger" data-action="delete" data-id="' + idAttr + '" data-topic="' + escapeHtml(t.topic) + '">Hapus</button>' +
            '</div>' +
            (secCount > 0
              ? '<div class="revise-chapter-bar">' +
                '<select id="revSec-' + idAttr + '" aria-label="Pilih bab">' + sectionOptions + '</select>' +
                '<input type="text" id="revInst-' + idAttr + '" placeholder="Catatan perbaikan bab (opsional)" />' +
                '<button type="button" class="action-btn accent" id="btnRevSec-' + idAttr + '" data-action="revise-sec" data-id="' + idAttr + '">Tulis Ulang Bab</button>' +
                '</div>'
              : '') +
            '</div>' +
            '</td>' +
            '</tr>'
          : '';

        return (
          '<tr>' +
          '<td class="doc-title-cell"><strong>' + escapeHtml(t.topic) + '</strong><span>' + secCount + ' bagian tersusun</span></td>' +
          '<td><span class="tag">' + escapeHtml(t.taskType || 'makalah') + '</span></td>' +
          '<td>' + srcCount + ' rujukan</td>' +
          '<td>' + escapeHtml(dateStr) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="actions-cell">' + actionsHtml + '</td>' +
          '</tr>' +
          reviseDrawerHtml
        );
      })
      .join('');

    container.innerHTML =
      '<div class="bento-table-wrap">' +
      '<table class="bento-table">' +
      '<thead>' +
      '<tr>' +
      '<th>JUDUL NASKAH</th>' +
      '<th>JENIS</th>' +
      '<th>RUJUKAN</th>' +
      '<th>TANGGAL</th>' +
      '<th>STATUS</th>' +
      '<th style="text-align:right;">AKSI</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '</div>';
  }

  async function deleteTask(id, topic) {
    if (!confirm('Hapus dokumen "' + topic + '" secara permanen?')) return;
    try {
      const res = await fetch('/api/tasks/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      notifyToast('Dokumen dihapus.', 'success');
      loadWorkspaceTasks();
    } catch (err) {
      notifyToast('Gagal menghapus dokumen: ' + err.message, 'error');
    }
  }

  async function reviseSectionTask(id) {
    const secEl = document.getElementById('revSec-' + id);
    const instEl = document.getElementById('revInst-' + id);
    const btn = document.getElementById('btnRevSec-' + id);
    const sectionTitle = secEl ? secEl.value : '';
    const instruction =
      (instEl ? instEl.value.trim() : '') ||
      'Pertajam analisis ilmiah, pastikan sinkronisasi sitasi 1:1 dengan sumber terverifikasi, dan rapikan bahasa baku PUEBI.';
    if (!sectionTitle) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Menulis ulang...';
    }
    try {
      const res = await fetch('/api/tasks/' + encodeURIComponent(id) + '/revise-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getAuthToken(),
        },
        body: JSON.stringify({ sectionTitle, instruction }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (instEl) instEl.value = '';
      notifyToast('Bagian "' + sectionTitle + '" berhasil diperbarui.', 'success');
      loadWorkspaceTasks();
    } catch (err) {
      notifyToast('Gagal merevisi bab: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Tulis Ulang Bab';
      }
    }
  }

  async function autoReviseTask(id) {
    try {
      const res = await fetch('/api/tasks/' + encodeURIComponent(id) + '/autorevise', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getAuthToken() },
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      notifyToast('Revisi otomatis berjalan di latar belakang (1-3 menit).', 'success');
      setTimeout(loadWorkspaceTasks, 4000);
    } catch (err) {
      notifyToast('Gagal menjalankan revisi: ' + err.message, 'error');
    }
  }

  // Chat Consultant
  function chatRender() {
    const box = document.getElementById('chatLog');
    if (!box) return;
    if (chatHistory.length === 0) {
      box.innerHTML =
        '<div class="chat-empty">Ajukan ide topik, rumusan masalah, atau kerangka bab untuk didiskusikan bersama konsultan akademik.</div>';
      return;
    }
    box.innerHTML = '';
    for (const m of chatHistory) {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.role === 'user' ? 'user' : 'assistant');
      div.textContent = m.content;
      box.appendChild(div);
    }
    box.scrollTop = box.scrollHeight;
  }

  function chatReset() {
    chatHistory = [];
    chatRender();
  }

  function chatUseTopic() {
    const last = chatHistory.filter((m) => m.role === 'assistant').slice(-1)[0];
    const topicEl = document.getElementById('topic');
    if (last && topicEl) {
      const firstLine = last.content
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim())
        .find((l) => l.length > 10);
      if (firstLine) topicEl.value = firstLine.slice(0, 180);
    }
    switchNav('generate');
    if (topicEl) topicEl.focus();
  }

  function sendQuickChat(promptText) {
    const input = document.getElementById('chatInput');
    const form = document.getElementById('chatForm');
    if (!input || !form) return;
    input.value = promptText;
    form.requestSubmit();
  }

  function bindDropzone(zoneId, fileInputId, onFileSelected) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(fileInputId);
    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
      if (e.target !== input) input.click();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) onFileSelected(file);
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
      });
    });
    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    });
  }

  // WebSocket Live Stream
  let appWs = null;
  function initWebSocket() {
    try {
      if (appWs && (appWs.readyState === WebSocket.OPEN || appWs.readyState === WebSocket.CONNECTING)) {
        return;
      }
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAuthToken() || '';
      const qs = token ? '?token=' + encodeURIComponent(token) : '';
      const ws = new WebSocket(proto + '//' + location.host + '/ws' + qs);
      appWs = ws;

      ws.onopen = function () {
        const dot = document.getElementById('wsDot');
        const txt = document.getElementById('wsText');
        if (dot) dot.classList.remove('offline');
        if (txt) txt.textContent = 'Terhubung ke server';
        const t = getAuthToken();
        if (t) {
          try {
            ws.send(JSON.stringify({ type: 'auth', token: t }));
          } catch {}
        }
      };

      ws.onclose = function () {
        const dot = document.getElementById('wsDot');
        const txt = document.getElementById('wsText');
        if (dot) dot.classList.add('offline');
        if (txt) txt.textContent = 'Menyambung ulang...';
        appWs = null;
        setTimeout(initWebSocket, 3000);
      };

      ws.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          const log = document.getElementById('genLog');
          const titleEl = document.getElementById('liveSectionTitle');

          if (data.type === 'connected' || data.type === 'authenticated') {
            if (Array.isArray(data.activeJobs)) {
              updateUnifiedRealtimeStatus(data.activeJobs);
            }
          } else if (data.type === 'job_update') {
            if (Array.isArray(data.activeJobs)) {
              updateUnifiedRealtimeStatus(data.activeJobs);
            }
            if (data.job) {
              const j = data.job;
              if (j.type === 'susun_naskah') {
                if (j.step) setPipelineStepState(j.step);
                if (j.status === 'completed' || j.status === 'failed') {
                  loadWorkspaceTasks();
                }
              } else if (j.type === 'audit_revisi') {
                const btn = document.getElementById('btnDoAutoRevise');
                if (btn && j.status === 'running' && j.detail) {
                  btn.textContent = j.detail;
                }
              }
            }
          } else if (data.type === 'step') {
            setPipelineStepState(data.step);
            if (log) {
              log.style.display = 'block';
              log.textContent += '[' + new Date().toLocaleTimeString('id-ID') + '] ' + data.detail + '\n';
              log.scrollTop = log.scrollHeight;
            }
            loadWorkspaceTasks();
          } else if (data.type === 'draft_stream') {
            const wrap = document.getElementById('liveStreamWrap');
            const textEl = document.getElementById('liveStreamText');
            const counter = document.getElementById('liveStreamCounter');
            if (wrap) wrap.style.display = 'block';
            const ev = data.event;
            if (!ev) return;

            if (ev.type === 'section_start') {
              updateLiveProgressBanner({
                active: true,
                text: 'Menyusun: ' + ev.sectionTitle + '...',
                targetTab: 'generate',
              });
              if (titleEl) titleEl.textContent = '[' + ev.index + '/' + ev.total + '] ' + ev.sectionTitle;
              if (textEl) {
                textEl.textContent += (textEl.textContent ? '\n\n' : '') + '## ' + ev.sectionTitle + '\n\n';
                textEl.scrollTop = textEl.scrollHeight;
              }
              if (log) {
                log.style.display = 'block';
                log.textContent += '[' + new Date().toLocaleTimeString('id-ID') + '] Mulai menulis: ' + ev.sectionTitle + '\n';
                log.scrollTop = log.scrollHeight;
              }
            } else if (ev.type === 'thinking') {
              if (titleEl) {
                titleEl.textContent = '[' + ev.index + '/' + ev.total + '] ' + ev.sectionTitle + ' (Menganalisis rujukan...)';
              }
            } else if (ev.type === 'chunk') {
              if (textEl) {
                textEl.textContent += ev.text;
                textEl.scrollTop = textEl.scrollHeight;
                const lines = textEl.textContent.split('\n').length;
                if (counter) counter.textContent = lines + ' baris';
              }
            } else if (ev.type === 'line') {
              streamLines++;
              if (textEl) {
                textEl.textContent += ev.text + '\n';
                textEl.scrollTop = textEl.scrollHeight;
              }
              if (counter) counter.textContent = streamLines + ' baris';
            } else if (ev.type === 'paragraph') {
              streamParas++;
              if (textEl) textEl.textContent += '\n';
            } else if (ev.type === 'section_end') {
              if (titleEl) titleEl.textContent = '[' + ev.index + '/' + ev.total + '] ' + ev.sectionTitle + ' tersimpan';
              if (log) {
                log.style.display = 'block';
                log.textContent += '[' + new Date().toLocaleTimeString('id-ID') + '] Selesai: ' + ev.sectionTitle + '\n';
                log.scrollTop = log.scrollHeight;
              }
            }
          } else if (data.type === 'completed') {
            setPipelineStepState('completed');
            if (titleEl) titleEl.textContent = 'Penyusunan & audit selesai';
            loadWorkspaceTasks();
            loadActiveJobs();
          } else if (data.type === 'failed') {
            loadWorkspaceTasks();
            loadActiveJobs();
          } else if (data.type === 'pptx_completed') {
            loadWorkspaceTasks();
            loadActiveJobs();
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };
    } catch (err) {
      console.error('WS init error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.TGSDORK = {
      switchNav,
      toggleSidebarRail,
      quickSearchArchive,
      sendAuthCode,
      verifyAuthCode,
      resetAuthStep,
      logout,
      toggleCoverFields,
      updateChapterOptions,
      handleChapterConfigChange,
      executeAudit,
      triggerAuditAutoRevise,
      copyReportText,
      executeTurnitinScan,
      triggerTurnitinParaphrase,
      copyTurnitinReport,
      loadWorkspaceTasks,
      filterDocs,
      setArchiveTypeFilter,
      setArchiveStatusFilter,
      resetArchiveFilters,
      chatReset,
      chatUseTopic,
      sendQuickChat,
      openDocReader,
      closeDocReader,
      copyReaderText,
    };

    // Restore sidebar collapsed state if saved
    if (localStorage.getItem('tgsdork_rail_collapsed') === '1') {
      document.getElementById('appShell')?.classList.add('rail-collapsed');
    }

    bindDropzone('dropArea', 'fileInput', setAuditFile);
    bindDropzone('turnitinDropArea', 'turnitinFileInput', setTurnitinFile);

    // Workspace delegated click actions
    const wsList = document.getElementById('workspaceList');
    if (wsList) {
      wsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'read-doc') openDocReader(id);
        if (action === 'delete') deleteTask(id, btn.getAttribute('data-topic') || id);
        if (action === 'autorevise') autoReviseTask(id);
        if (action === 'revise-sec') reviseSectionTask(id);
        if (action === 'toggle-revise') {
          const row = document.getElementById('revRow-' + id);
          if (row) {
            const willOpen = row.style.display === 'none';
            row.style.display = willOpen ? 'table-row' : 'none';
            if (willOpen) openReviseRows.add(id);
            else openReviseRows.delete(id);
          }
        }
      });
    }

    const ovRecentBox = document.getElementById('ovRecentList');
    if (ovRecentBox) {
      ovRecentBox.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="read-doc"]');
        if (btn) openDocReader(btn.getAttribute('data-id'));
      });
    }

    // Modal reader backdrop click and Escape key handler
    const rModal = document.getElementById('docReaderModal');
    if (rModal) {
      rModal.addEventListener('click', (e) => {
        if (e.target === rModal) closeDocReader();
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDocReader();
    });

    // Generate form submit
    const genForm = document.getElementById('generateForm');
    if (genForm) {
      genForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnGen');
        const log = document.getElementById('genLog');
        const liveWrap = document.getElementById('liveStreamWrap');
        const liveText = document.getElementById('liveStreamText');
        const liveTitle = document.getElementById('liveSectionTitle');
        const liveCounter = document.getElementById('liveStreamCounter');

        if (activeTaskPollTimer) {
          clearInterval(activeTaskPollTimer);
          activeTaskPollTimer = null;
        }

        btn.disabled = true;
        btn.textContent = 'Menjalankan riset & penyusunan...';
        log.style.display = 'block';
        log.textContent = '';
        if (liveWrap) liveWrap.style.display = 'block';
        if (liveText) liveText.textContent = '';
        if (liveTitle) liveTitle.textContent = 'Menyiapkan penelusuran jurnal...';
        if (liveCounter) liveCounter.textContent = '0 baris';
        streamLines = 0;
        streamParas = 0;
        setPipelineStepState('dorking');

        let chapterCount;
        let customChapters;
        const chapterCfg = document.getElementById('chapterConfig').value;
        if (chapterCfg === 'custom') {
          const raw = document.getElementById('customChapters').value.trim();
          if (raw) {
            customChapters = raw.split('\n').map((l) => l.trim()).filter(Boolean);
          }
        } else if (chapterCfg !== 'auto') {
          chapterCount = parseInt(chapterCfg, 10);
        }

        const coverOn = document.getElementById('coverToggle').value === 'on';
        const val = (id) => (document.getElementById(id)?.value || '').trim();

        const customRefFiles = document.getElementById('customRefInput')?.files || [];
        const customRefs = [];
        for (let i = 0; i < Math.min(customRefFiles.length, 5); i++) {
          try {
            const b64 = await readFileAsBase64(customRefFiles[i]);
            if (b64) customRefs.push({ filename: customRefFiles[i].name, data: b64 });
          } catch {}
        }

        const payload = {
          topic: document.getElementById('topic').value.trim(),
          taskType: document.getElementById('taskType').value,
          font: document.getElementById('docFont').value || 'Times New Roman',
          citationStyle: document.getElementById('citationStyle').value || 'apa',
          cover: coverOn
            ? {
                institution: val('coverInstitution'),
                faculty: val('coverFaculty'),
                program: val('coverProgram'),
                author: val('coverAuthor'),
                nim: val('coverNim'),
                supervisor: val('coverSupervisor'),
                city: val('coverCity'),
                year: String(new Date().getFullYear()),
              }
            : undefined,
          chapterCount,
          customChapters,
          customRefs,
        };

        try {
          log.textContent += 'Memulai tugas: "' + payload.topic + '"\n';
          const res = await fetch('/api/tasks/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + getAuthToken(),
            },
            body: JSON.stringify(payload),
          });
          const d = JSON.parse(await res.text());
          if (d.error) throw new Error(d.error);

          log.textContent += 'ID Tugas: ' + d.id + '\n';
          notifyToast('Penyusunan naskah dimulai di latar belakang.', 'success');
          loadWorkspaceTasks();
          loadActiveJobs();

          activeTaskPollTimer = setInterval(async () => {
            try {
              const pollRes = await fetch('/api/tasks', {
                headers: { Authorization: 'Bearer ' + getAuthToken() },
              });
              const tasks = await pollRes.json();
              const task = Array.isArray(tasks) ? tasks.find((t) => t.id === d.id) : null;
              if (!task) return;

              if (task.step === 'completed') {
                clearInterval(activeTaskPollTimer);
                activeTaskPollTimer = null;
                btn.disabled = false;
                btn.textContent = 'Susun Naskah';
                setPipelineStepState('completed');
                document.getElementById('topic').value = '';
                notifyToast('Naskah selesai disusun dan siap diunduh di Arsip Dokumen.', 'success');
                switchNav('workspace');
                loadWorkspaceTasks();
              } else if (task.step === 'failed') {
                clearInterval(activeTaskPollTimer);
                activeTaskPollTimer = null;
                btn.disabled = false;
                btn.textContent = 'Susun Naskah';
                notifyToast('Penyusunan naskah berhenti karena kendala koneksi/API.', 'error');
              } else if (task.step) {
                setPipelineStepState(task.step);
              }
            } catch {}
          }, 3500);
        } catch (err) {
          log.textContent += 'Gagal: ' + err.message + '\n';
          notifyToast('Gagal memulai tugas: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Susun Naskah';
        }
      });
    }

    // PowerPoint form submit
    const pptxForm = document.getElementById('pptxForm');
    if (pptxForm) {
      pptxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnPptx');
        const topic = document.getElementById('pptxTopic').value.trim();
        if (topic.length < 3) {
          notifyToast('Judul presentasi minimal 3 karakter.', 'error');
          return;
        }
        const status = document.getElementById('pptxStatus');
        const result = document.getElementById('pptxResult');
        btn.disabled = true;
        btn.textContent = 'Menyusun salindia PowerPoint...';
        status.style.display = 'block';
        result.style.display = 'none';
        status.textContent = 'Menyusun struktur 10–14 slide PowerPoint beserta catatan pemateri (sekitar 30–90 detik)...';

        try {
          const res = await fetch('/api/pptx/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + getAuthToken(),
            },
            body: JSON.stringify({
              topic,
              theme: document.getElementById('pptxTheme').value,
              animate: document.getElementById('pptxAnimate').checked,
            }),
          });
          const d = JSON.parse(await res.text());
          if (d.error) throw new Error(d.error);

          const timer = setInterval(async () => {
            try {
              const s = await fetch('/api/pptx/status/' + d.jobId, {
                headers: { Authorization: 'Bearer ' + getAuthToken() },
              });
              const j = JSON.parse(await s.text());
              if (j.status === 'completed') {
                clearInterval(timer);
                status.textContent = 'PowerPoint "' + d.topic + '" siap diunduh.';
                document.getElementById('pptxDownload').href =
                  j.downloadUrl + '?token=' + encodeURIComponent(getAuthToken());
                result.style.display = 'flex';
                btn.disabled = false;
                btn.textContent = 'Buat File PowerPoint (.pptx)';
                notifyToast('PowerPoint .pptx siap diunduh.', 'success');
              } else if (j.status === 'error') {
                clearInterval(timer);
                status.textContent = 'Gagal: ' + (j.error || 'Terjadi kendala saat membuat slide.');
                btn.disabled = false;
                btn.textContent = 'Buat File PowerPoint (.pptx)';
                notifyToast('Gagal menyusun PowerPoint.', 'error');
              }
            } catch {}
          }, 2500);
        } catch (err) {
          status.textContent = 'Gagal: ' + err.message;
          btn.disabled = false;
          btn.textContent = 'Buat File PowerPoint (.pptx)';
        }
      });
    }

    // Chat form submit
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chatInput');
        const btn = document.getElementById('btnChat');
        const text = (input.value || '').trim();
        if (!text) return;

        chatHistory.push({ role: 'user', content: text });
        input.value = '';
        btn.disabled = true;
        chatHistory.push({ role: 'assistant', content: 'Menyusun tanggapan...' });
        chatRender();

        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + getAuthToken(),
            },
            body: JSON.stringify({ messages: chatHistory.slice(0, -1) }),
          });
          const d = await res.json();
          if (d.error) throw new Error(d.error);
          chatHistory[chatHistory.length - 1] = { role: 'assistant', content: d.reply || '(Tidak ada respons)' };
        } catch (err) {
          chatHistory[chatHistory.length - 1] = {
            role: 'assistant',
            content: 'Gagal menghubungi server: ' + err.message,
          };
        } finally {
          btn.disabled = false;
          chatRender();
        }
      });
    }

    chatRender();
    renderOverviewDashboard([]);
    checkAuth();

    // Deep-linking from Landing Page (?tab=...&topic=...)
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    const requestedTopic = params.get('topic');
    if (requestedTab) {
      switchNav(requestedTab);
    } else {
      switchNav('overview');
    }

    if (requestedTopic) {
      if (requestedTab === 'pptx') {
        const pptTopicEl = document.getElementById('pptxTopic');
        if (pptTopicEl) {
          pptTopicEl.value = requestedTopic;
          pptTopicEl.focus();
        }
      } else {
        switchNav('generate');
        const topicEl = document.getElementById('topic');
        if (topicEl) {
          topicEl.value = requestedTopic;
          topicEl.focus();
        }
      }
    }

    if (getAuthToken()) {
      loadWorkspaceTasks();
      loadActiveJobs();
    }
    initWebSocket();
  });
})();
