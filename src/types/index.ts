export type AIProvider = 'gemini' | 'openai-compatible';

export interface AppConfig {
  provider: AIProvider;
  gemini: {
    apiKeys: string[];
    models: {
      fast: string;
      writer: string;
      dork?: string;
    };
  };
  openai: {
    baseUrl: string;
    apiKeys: string[];
    models: {
      fast: string;
      writer: string;
      dork?: string;
    };
  };
  search: {
    provider: 'ddg' | 'serper' | 'tavily';
    serperApiKey?: string;
    tavilyApiKey?: string;
  };
}

export interface SourceItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  content?: string;
  citation: string;
  fullRef: string;
  fileType: 'pdf' | 'html';
  authors?: string[];
  year?: string;
  doi?: string;
  doiVerified?: boolean;
}

export type TaskType = 'makalah' | 'skripsi' | 'presentasi' | 'lit-review';

export type CitationStyle = 'apa' | 'ieee' | 'harvard';

export interface CoverMeta {
  institution?: string;
  faculty?: string;
  program?: string;
  author?: string;
  nim?: string;
  supervisor?: string;
  year?: string;
  city?: string;
}

export interface SectionContent {
  title: string;
  content: string;
  citationsUsed?: string[];
}

export interface TaskState {
  id: string;
  topic: string;
  taskType: TaskType;
  owner?: string;
  font?: string;
  citationStyle?: CitationStyle;
  cover?: CoverMeta;
  step: 'init' | 'dorking' | 'searching' | 'extracting' | 'drafting' | 'exporting' | 'completed';
  dorkQueries: string[];
  sources: SourceItem[];
  outline: string[];
  sections: SectionContent[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  role?: 'fast' | 'writer';
  jsonMode?: boolean;
  model?: string;
  onChunk?: (chunk: string) => void;
  onReasoning?: (chunk: string) => void;
}

export type ActiveJobType = 'susun_naskah' | 'audit_revisi' | 'uji_kemiripan' | 'pptx';

export interface UnifiedActiveJob {
  id: string;
  type: ActiveJobType;
  typeLabel: string;
  title: string;
  step: string;
  detail: string;
  owner: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  updatedAt: number;
  error?: string;
  resultUrl?: string;
}

export type TurnitinSourceType = 'internet' | 'publication' | 'student_paper';

export interface TurnitinMatchSource {
  id: number;
  color: string;
  title: string;
  institution?: string;
  domain?: string;
  year?: string;
  doi?: string;
  url?: string;
  type: TurnitinSourceType;
  typeLabel: string;
  similarityPercent: number;
  matchCount: number;
  snippet?: string;
  matchedSentences?: string[];
}

export interface TurnitinSentenceMatch {
  sentenceIndex: number;
  sentence: string;
  sourceId: number;
  similarityScore: number;
  matchedSnippet?: string;
}

export interface TurnitinScanOptions {
  excludeBibliography?: boolean;
  excludeQuotes?: boolean;
}

export interface TurnitinScanResult {
  similarityScore: number;
  aiScore: number;
  report: string;
  flaggedSentences: string[];
  sources?: TurnitinMatchSource[];
  annotatedHtml?: string;
  metricsBreakdown?: {
    internetSources: number;
    studentPapers: number;
    publications: number;
  };
}
