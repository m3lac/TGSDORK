# TGSDORK — Academic Research & Manuscript Studio

**TGSDORK** adalah studio riset literatur dan penyusunan naskah akademik terpadu (**Web Studio & CLI**) yang menggabungkan penelusuran jurnal ilmiah otomatis (*Academic Google Dorking*), penguncian sitasi nyata (`<verified_sources>`), audit kelayakan naskah, parafrase kemiripan, hingga ekspor siap kumpul ke format Microsoft Word (`.docx`), PDF (`.pdf`), dan PowerPoint (`.pptx`).

---

## Keunggulan Utama

| Modul | Deskripsi Kemampuan |
| :--- | :--- |
| **Academic Google Dorking** | Meracik kueri penelusuran terarah ke repositori perguruan tinggi (`.ac.id`, `.edu`), Garuda Kemdikbud, SINTA, DOAJ, Crossref, dan OpenAlex beserta validasi DOI aktif (`doi.org`). |
| **Source-Locked Citations** | Mengekstrak teks penuh artikel ilmiah (PDF & HTML) dan mengunci metadata penulis serta tahun terbit di dalam blok `<verified_sources>` untuk mencegah referensi fiktif. |
| **Penyusunan Naskah Terstruktur** | Menyusun **Makalah Ilmiah**, **Skripsi / Tesis (Bab I–V)**, **Literature Review Matrix**, dan **Kerangka Presentasi** lengkap dengan tabel penelitian terdahulu serta bagan alir metodologi. |
| **Audit Mutu & Revisi Otomatis** | Mengevaluasi struktur bab, sinkronisasi sitasi 1:1, kedalaman analisis, dan tata bahasa baku PUEBI, dilengkapi fitur perbaikan otomatis maupun revisi per bab. |
| **Uji Kemiripan & Parafrase** | Mengukur estimasi indeks kemiripan kalimat dan menulis ulang bagian yang terdeteksi secara akademis tanpa mengubah makna ilmiah maupun sitasi. |
| **Generator PowerPoint (`.pptx`)** | Menghasilkan 10–14 salindia presentasi profesional lengkap dengan catatan pembicara (*speaker notes*) di setiap slide langsung dari judul atau naskah. |
| **Multi-Format Export** | Unduh instan dalam format `.docx`, `.pdf`, `.pptx`, `.html` (Marp slide), `.md`, `.bib` (BibTeX), dan bundel arsip `.zip`. |

---

## Standar Format Dokumen (`.docx` & `.pdf`)

Seluruh naskah yang diekspor mengikuti pedoman penulisan karya ilmiah perguruan tinggi:

- **Ukuran Kertas:** A4 (`210 × 297 mm`)
- **Margin Standar Skripsi:** Atas `4 cm`, Kiri `4 cm`, Bawah `3 cm`, Kanan `3 cm`
- **Tipografi Pilihan:** `Times New Roman` (default), `Arial`, `Calibri`, `Georgia`, `Garamond`
- **Spasi & Perataan:** Spasi `1,5` (*line spacing*), perataan teks rata kanan-kiri (*justified*), dan indentasi baris pertama paragraf otomatis
- **Gaya Sitasi:** **APA 7th Edition**, **IEEE** (`[1], [2]`), dan **Harvard**

---

## Struktur Direktori

```text
tgsdork/
├── public/                 # Asset statis Web Studio & Landing Page (CSS, JS)
├── scripts/                # Utilitas pemanen metadata jurnal lokal
├── src/
│   ├── index.ts            # Entry point CLI (Commander & Clack Prompts)
│   ├── chat.ts             # Mode diskusi interaktif via terminal
│   ├── core/               # Manajemen sesi, autentikasi OTP email, checkpoint, logger
│   ├── dorker/             # Builder kueri Dork, scraper jurnal, verifikator DOI & parser PDF
│   ├── pipelines/          # Alur penyusunan makalah, skripsi, lit-review, audit & kemiripan
│   ├── exporter/           # Generator dokumen DOCX, PDF, PPTX, BibTeX, Markdown & ZIP
│   └── server/             # Server HTTP/WebSocket, Landing Page & Bento Web Studio
└── workspace/              # Penyimpanan checkpoint dan berkas hasil ekspor
```

---

## Instalasi & Penggunaan

### 1. Persiapan Lingkungan

Pastikan **Node.js v20+** sudah terpasang, lalu instal dependensi proyek:

```bash
npm install
```

### 2. Menjalankan Web Studio

Untuk menjalankan **Landing Page** (`/`) dan **Web Studio** (`/studio`) dalam mode pengembangan (*live-reload*):

```bash
npm run dev:ui
```

Untuk membangun bundel produksi dan menjalankan server pada port `3456`:

```bash
npm run build
node dist/index.js serve --port 3456
```

### 3. Penggunaan melalui Terminal (CLI)

```bash
# Menyusun makalah ilmiah dari topik penelitian
npx tsx src/index.ts generate "Implementasi Vision Transformer untuk Klasifikasi Citra Medis" --type makalah

# Menyusun draf skripsi lengkap dengan gaya sitasi APA
npx tsx src/index.ts generate "Adopsi Pembayaran Digital QRIS pada UMKM Kuliner" --type skripsi --citation apa

# Mengaudit kelayakan berkas naskah (.docx / .pdf / .md)
npx tsx src/index.ts review ~/Documents/makalah_riset.docx

# Mode konsultasi topik & metodologi interaktif
npx tsx src/index.ts chat
```

---

## Validasi & Pengujian

```bash
# Pemeriksaan tipe TypeScript
npm run typecheck

# Menjalankan rangkaian pengujian
npm test
```
