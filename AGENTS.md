# AGENTS.md — Instruksi Pengembangan Proyek TGSDORK

Dokumen ini adalah panduan operasional utama untuk **AI Coding Agent**. Baca seluruh aturan di bawah ini sebelum membuat, memodifikasi, atau mengeksekusi kode di dalam repositori ini.

---

## 1. Konteks Proyek & Efisiensi Runtime
- **Nama Proyek:** `tgsdork` (CLI & Web Studio untuk otomasi riset dan naskah akademik berbasis Google Dorking & AI).
- **Efisiensi Scraping & PDF:**
  - Untuk modul scraping/ekstraksi jurnal (`src/dorker/`), gunakan HTTP client ringan (`fetch`/`undici`), HTML parser `cheerio`, dan PDF parser `unpdf` secara berurutan (maksimal *concurrency* = 2, batas **10 MB** per file).
  - Penggunaan Playwright / headless browser **diperbolehkan** untuk ekspor PDF (`src/exporter/pdf-builder.ts`) serta pengujian/preview visual Web UI.
  - **Pengembangan Web UI TIDAK DIBATASI**: bebas merombak tampilan, animasi, layout, tema, komponen, memecah file ke modul terpisah (`src/server/`, `public/`), maupun menambahkan library/asset UI yang dibutuhkan.
---

## 2. Tech Stack & Dependensi Standar
Gunakan **Node.js (v20+) dengan TypeScript (ESM)** agar ringan, cepat, dan memiliki *type-safety* yang kuat:
- **Runtime & Build:** `tsx` (untuk eksekusi dev cepat), `tsup` (untuk build ke single binary/bundle ringan).
- **CLI & TUI Framework:** `commander` (argumen CLI) + `@clack/prompts` + `picocolors` (antarmuka interaktif terminal yang ringan dan elegan).
- **AI Client:** Gunakan `undici` / native `fetch` atau `openai` SDK yang diarahkan ke:
  1. Native Google Gemini REST API (`generativelanguage.googleapis.com`).
  2. Custom OpenAI-Compatible Endpoint (`baseURL` kustom untuk mendukung AI Router / Gateway).
- **Search & Extraction:**
  - `cheerio` (HTML parsing & DuckDuckGo Lite scraping).
  - `unpdf` (Ekstraksi teks PDF yang ringan dan kompatibel dengan ESM).
- **Document Exporter:**
  - `docx` (Pembuatan file Microsoft Word `.docx` secara terprogram dari struktur Markdown/JSON).
  - `@marp-team/marp-cli` atau generator slide berbasis Markdown untuk ekspor presentasi.

---

## 3. Struktur Direktori Dasar (Modular & Fleksibel)
Struktur di bawah adalah kerangka dasar; Anda bebas menambah sub-modul, komponen UI di `src/server/`, atau asset statis di `public/`.
```text
tgsdork/
├── package.json
├── tsconfig.json
├── PRD.md
├── AGENTS.md
├── src/
│   ├── index.ts                # Entry point CLI (Commander setup)
│   ├── types/
│   │   └── index.ts            # Semua interface TypeScript (Config, SourceItem, TaskState)
│   ├── core/
│   │   ├── config.ts           # Baca/tulis ~/.tgsdork/config.json & rotasi API key
│   │   ├── checkpoint.ts       # Simpan & muat state pengerjaan di workspace/
│   │   └── logger.ts           # Utilitas log terminal yang bersih
│   ├── ai/
│   │   ├── client.ts           # Unified AI Client (Support Gemini Native & OpenAI Custom BaseURL)
│   │   └── prompts.ts          # System prompts (Dork Generator, Extractor, Academic Writer, Slide Maker)
│   ├── dorker/
│   │   ├── presets.ts          # Daftar preset Dork (id-academic, global-scholar, gov-data)
│   │   ├── builder.ts          # AI pembuat kueri Google Dork dari topik user
│   │   ├── searcher.ts         # Eksekutor pencarian (DuckDuckGo Lite Scraper + Serper/Tavily API)
│   │   └── extractor.ts        # Downloader & parser HTML/PDF (batas 10MB, anti-crash)
│   ├── pipelines/
│   │   ├── makalah.ts          # Pipeline penyusunan makalah akademik
│   │   ├── skripsi.ts          # Pipeline penyusunan Bab 1-3 skripsi & matriks literatur
│   │   ├── presentasi.ts       # Pipeline penyusunan slide Marp/PPTX + speaker notes
│   │   └── lit-review.ts       # Pipeline pembuatan tabel komparasi jurnal
│   ├── exporter/
│   │   ├── markdown.ts         # Pengekspor file .md bersih
│   │   ├── docx-builder.ts     # Konverter struktur dokumen ke .docx
│   │   └── slide-builder.ts    # Konverter struktur slide ke format Marp .md / .html
│   └── server/
│       └── app.ts              # Web Studio server & UI (bebas dipecah ke modul/komponen & public/)
├── public/                     # Asset statis UI opsional (/public/*: CSS, JS, font, ikon, gambar)
└── workspace/                  # Folder output dan checkpoint setiap task
```

---

## 4. Aturan Arsitektur & Penulisan Kode

### A. Unified AI Client (`src/ai/client.ts`)
- Buat satu fungsi utama: `generateText({ prompt, systemPrompt, role: 'fast' | 'writer', jsonMode?: boolean })`.
- Client harus mendukung:
  1. **Mode `openai-compatible`:** Menggunakan `fetch(`${baseUrl}/chat/completions`)` dengan header `Authorization: Bearer ${apiKey}`. Ini wajib agar aplikasi kompatibel dengan AI proxy/router lokal maupun cloud.
  2. **Mode `gemini`:** Menggunakan endpoint resmi Google AI Studio `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`.
- Terapkan **Automatic Retry & Key Rotation**: Jika respons HTTP adalah `429` atau `503`, ganti ke API key berikutnya di dalam array konfigurasi, tunggu 3 detik (exponential backoff), dan ulangi otomatis hingga 3 kali.

### B. Scraper & Dork Searcher (`src/dorker/searcher.ts`)
- Implementasikan **DuckDuckGo Lite Scraper** (`https://lite.duckduckgo.com/lite/`) menggunakan method `POST` atau `GET` dengan `User-Agent` browser standar dan jeda antar-request (`1500ms` - `3000ms`) agar tidak terkena blokir IP.
- Sediakan opsi langsung ke **Serper.dev API** (`https://google.serper.dev/search`) atau **Tavily API** jika pengguna memasukkan API key pencarian di konfigurasi.

### C. Anti-Hallucination Prompting (`src/ai/prompts.ts`)
- Saat menyusun isi Makalah/Skripsi/Presentasi, suntikkan daftar referensi dalam format XML/JSON:
  ```xml
  <verified_sources>
    <source id="ref_1" citation="(Pratama & Santoso, 2024)" full_ref="Pratama, R., & Santoso, B. (2024)...">
      Ringkasan isi jurnal dan data temuan...
    </source>
  </verified_sources>
  ```
- Instruksikan AI: *"HANYA gunakan data dan sitasi yang ada di dalam blok `<verified_sources>`. DILARANG KERAS menambahkan nama penulis, tahun, atau daftar pustaka di luar daftar tersebut."*

---

## 5. Rencana Eksekusi Bertahap (Implementation Phases)

Kerjakan proyek ini secara berurutan per fase. Jangan melompat ke fase berikutnya sebelum fase saat ini teruji dan bebas *error*.

- **Phase 1: Core & AI Client Setup**
  1. Inisialisasi `package.json`, `tsconfig.json`, dan struktur folder.
  2. Buat `src/types/index.ts`, `src/core/config.ts`, dan `src/core/checkpoint.ts`.
  3. Buat `src/ai/client.ts` (dukung Gemini API & Custom OpenAI BaseURL + Key Rotation).
- **Phase 2: Dorking & Content Extraction Engine**
  1. Buat `src/dorker/presets.ts` dan `src/dorker/builder.ts` (AI mengubah topik menjadi kueri Dork).
  2. Buat `src/dorker/searcher.ts` (DuckDuckGo Lite HTML parser + Serper API support).
  3. Buat `src/dorker/extractor.ts` (Ekstraksi teks web via `cheerio` & ekstraksi PDF via `unpdf` + pembuatan sitasi otomatis).
- **Phase 3: Academic Pipelines**
  1. Buat `src/ai/prompts.ts` untuk keempat mode tugas.
  2. Buat `src/pipelines/makalah.ts`, `skripsi.ts`, `presentasi.ts`, dan `lit-review.ts` dengan integrasi sistem checkpoint di setiap sub-bab.
- **Phase 4: Exporter & CLI Integration**
  1. Buat `src/exporter/markdown.ts`, `docx-builder.ts` (menggunakan library `docx`), dan `slide-builder.ts`.
  2. Hubungkan seluruh fitur ke `src/index.ts` menggunakan `commander` dan `@clack/prompts`.
- **Phase 5: Web Studio UI (Bebas Kustomisasi Penuh)**
  1. Kembangkan Web Studio di `src/server/` dan `public/` tanpa batasan *Single-File UI* — bebas memakai komponen modular, CSS/animasi modern, multi-view, maupun library UI tambahan.

---

## 6. Perintah Eksekusi & Validasi untuk Agent
Setiap kali selesai menulis modul, jalankan perintah berikut untuk memastikan tidak ada *syntax/type error*:
- **Install dependencies:** `npm install`
- **Typecheck:** `npx tsc --noEmit`
- **Run CLI in Dev Mode:** `npx tsx src/index.ts --help`
- **Run Web UI Live-Reload (Tanpa Lock OTP Lokal):** `npm run dev:ui`
- **Build Production:** `npm run build`