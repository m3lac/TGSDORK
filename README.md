# TGSDORK — Academic Research & Manuscript Studio

Studio riset literatur ilmiah, penyusunan naskah akademik otomatis (Makalah, Skripsi, Literature Review, Slide Presentasi), audit mutu PUEBI 80+, dan parafrase Turnitin berbasis AI.

## Fitur Utama

- **Riset Jurnal & Verifikasi DOI Anti-Halusinasi:** Prioritas indeks jurnal Indonesia (Garuda Kemdikbud, SINTA, Neliti, repositori `.ac.id`, OpenAlex Indonesia) dengan verifikasi status DOI aktif langsung ke `doi.org`.
- **Gaya Sitasi Fleksibel (APA 7th, IEEE, Harvard):** Dukungan penuh in-text citation numerik `[1]` untuk bidang teknik/sains, Author-Date `(Penulis, Tahun)` untuk sosial/kesehatan, serta Harvard format.
- **Bagan Alir Penelitian Bab III (Mermaid.js):** Otomasi visualisasi diagram alur metodologi penelitian interaktif pada Web UI dan diformat rapi saat diekspor ke Word (.docx).
- **Upload Jurnal PDF Wajib (Custom Reference):** Lampirkan file `.pdf`/`.docx`/`.txt` referensi wajib dari dosen untuk diekstrak dan disitasi langsung di dalam naskah.
- **Tabel Matriks Penelitian Terdahulu Otomatis (Bab II):** Menyusun tabel komparasi peneliti, tahun, judul, metode, dan kesenjangan riset secara otomatis pada Bab II / Tinjauan Pustaka.
- **Revisi Per-Bab & Auto-Audit >= 80/100:** Evaluasi otomatis draf naskah dengan revisi bertahap hingga melampaui skor kelayakan 80/100, ditambah fitur tulis ulang per-bab langsung dari Workspace.
- **Turnitin Originality Scanner & Bypass Paraphraser:** Estimasi skor kemiripan (*Similarity Index*) & deteksi AI beserta rekonstruksi kalimat otomatis.
- **PowerPoint Instan (.pptx):** Buat 10–14 slide presentasi profesional lengkap dengan catatan pemateri (*speaker notes*) dan transisi dari satu baris judul.
- **Multi-Format & 1-Click ZIP Bundle Export:** Ekspor otomatis ke Word (`.docx`), PDF (`.pdf`), PowerPoint (`.pptx`), Slide HTML (`.html`), Markdown (`.md`), BibTeX (`.bib`), dan arsip paket lengkap (`.zip`).

## Arsitektur Direktori

```text
src/
├── ai/          # Client LLM (SSE streaming, key rotation, output sanitizer) & prompt akademik
├── core/        # Konfigurasi (~/.tgsdork/config.json), autentikasi OTP email, checkpoint
├── dorker/      # Query builder, scraper DDG/Bing, OpenAlex Indonesia API, PDF/HTML extractor
├── exporter/    # Builder DOCX, PDF (Playwright), PPTX (PptxGenJS), Marp HTML, BibTeX
├── pipelines/   # Pipeline penyusunan bab, peer-reviewer 80+, dan Turnitin paraphraser
└── server/      # Web Studio UI (Left-Sidebar Bento Glassmorphism + WebSocket live stream)
```

## Instalasi & Penggunaan

```bash
# 1. Install dependencies
npm install

# 2. Build bundle produksi
npm run build

# 3. Jalankan Web Studio (default port 3456)
node dist/index.js serve --port 3456
```

### Penggunaan via CLI

```bash
# Riset & susun makalah ilmiah
npx tsx src/index.ts generate "Dampak Kecerdasan Artifisial pada Pendidikan Tinggi di Indonesia" --type makalah

# Mode interaktif / chat konsultan akademik
npx tsx src/index.ts chat
```

## Konfigurasi (`~/.tgsdork/config.json`)

```json
{
  "provider": "openai-compatible",
  "openai": {
    "baseUrl": "https://your-gateway.example.com/v1",
    "apiKeys": ["sk-..."],
    "models": {
      "fast": "your-fast-model",
      "writer": "your-writer-model"
    }
  },
  "search": {
    "provider": "ddg"
  }
}
```

## Pengujian

```bash
npm test
```
