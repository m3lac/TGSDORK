export interface DorkPreset {
  id: string;
  name: string;
  description: string;
  templates: string[];
}

export const DORK_PRESETS: Record<string, DorkPreset> = {
  'academic-all': {
    id: 'academic-all',
    name: 'Jurnal Ilmiah Indonesia (Garuda, SINTA, Neliti, Kampus .ac.id)',
    description: 'Prioritas jurnal nasional terakreditasi SINTA, Garuda Kemdikbud, Neliti, dan e-Journal Universitas Indonesia (.ac.id)',
    templates: [
      '{keywords} site:garuda.kemdikbud.go.id OR site:neliti.com',
      '{keywords} site:ac.id filetype:pdf (jurnal OR penelitian OR abstrak)',
      '{keywords} (site:jurnal.ugm.ac.id OR site:scholarhub.ui.ac.id OR site:journal.unair.ac.id OR site:ejournal.undip.ac.id)',
      '{keywords} site:ac.id "Jurnal" "ISSN" filetype:pdf',
    ],
  },
  'id-academic': {
    id: 'id-academic',
    name: 'Jurnal Ilmiah Indonesia (Garuda, SINTA, Neliti, Kampus .ac.id)',
    description: 'Prioritas jurnal nasional terakreditasi SINTA, Garuda Kemdikbud, Neliti, dan e-Journal Universitas Indonesia (.ac.id)',
    templates: [
      '{keywords} site:garuda.kemdikbud.go.id OR site:neliti.com',
      '{keywords} site:ac.id filetype:pdf (jurnal OR penelitian OR abstrak)',
      '{keywords} (site:jurnal.ugm.ac.id OR site:scholarhub.ui.ac.id OR site:journal.unair.ac.id OR site:ejournal.undip.ac.id)',
      '{keywords} site:ac.id "Jurnal" "ISSN" filetype:pdf',
    ],
  },
  'global-scholar': {
    id: 'global-scholar',
    name: 'Jurnal Ilmiah Valid (Global & Internasional)',
    description: 'Scrape jurnal global dari arXiv, DOAJ, Semantic Scholar, ScienceDirect, ResearchGate',
    templates: [
      '{keywords} site:arxiv.org/pdf OR site:semanticscholar.org',
      '{keywords} site:doaj.org OR site:sciencedirect.com filetype:pdf',
      '{keywords} site:researchgate.net/publication filetype:pdf',
    ],
  },
  'gov-data': {
    id: 'gov-data',
    name: 'Data & Regulasi Resmi RI',
    description: 'Data dan regulasi pemerintah',
    templates: [
      '{keywords} site:go.id filetype:pdf',
      '{keywords} site:bps.go.id',
    ],
  },
};
