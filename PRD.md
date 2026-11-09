# Product Requirements Document (PRD): TGSDORK

## 1. Identitas Proyek
- **Nama Proyek:** TGSDORK (Tugas & Academic Google Dorking AI Assistant)
- **Tipe Aplikasi:** CLI (Command Line Interface), TUI (Terminal UI), & Lightweight Local Web UI
- **Target Pengguna:** Mahasiswa, peneliti, dan pelajar yang membutuhkan otomasi riset dan penyusunan dokumen akademik (Skripsi, Makalah, Presentasi, Literature Review) dengan referensi nyata dan terverifikasi.
- **Prinsip Utama:** Zero-Hallucination Citation (sitasi wajib berasal dari hasil ekstraksi dokumen nyata via Google Dorking) & Low-Resource Footprint (hemat RAM dan CPU).

---

## 2. Tujuan & Solusi Utama
1. **Otomasi Google Dorking Akademik:** Mengubah topik tugas menjadi deretan kueri Google Dork presisi tinggi (`site:ac.id`, `filetype:pdf`, `site:garuda.kemdikbud.go.id`, dll.) menggunakan AI.
2. **Ekstraksi Konteks Nyata (RAG-Lite):** Mengunduh dan mengekstrak teks dari jurnal PDF serta artikel ilmiah secara *streaming* tanpa membebani memori sistem.
3. **Fleksibilitas AI Provider (BYOK & Custom Router):** Mendukung Google AI Studio (Gemini API) secara *native* maupun *endpoint* OpenAI-compatible (OpenRouter, Groq, atau Local AI Proxy/Router).
4. **Multi-Format Export:** Menghasilkan dokumen siap kumpul dalam format Markdown (`.md`), Word (`.docx`), dan Slide Presentasi (`.pptx` / `.html` via Marp).

---

## 3. Spesifikasi Fitur Fungsional

### 3.1. Modul AI Engine & Konfigurasi (`src/ai/`)
- **Multi-Provider Support:**
  - `gemini`: Integrasi dengan Google AI Studio API (`https://generativelanguage.googleapis.com`).
  - `openai-compatible`: Integrasi menggunakan `baseURL` kustom (mendukung AI Router lokal maupun cloud) dan `apiKey` kustom.
- **API Key Rotation:** Mendukung array API Key (`apiKeys: ["key1", "key2"]`). Jika terjadi `429 Too Many Requests`, sistem otomatis beralih ke key berikutnya.
- **Model Routing:** Pengguna dapat membedakan model untuk *fast task* (membuat kueri Dork & merangkum PDF) dan *reasoning task* (menulis bab skripsi/makalah).

### 3.2. Modul