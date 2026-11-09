import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AppConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.tgsdork');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  provider: 'openai-compatible',
  gemini: {
    apiKeys: [],
    models: {
      fast: '',
      writer: '',
    },
  },
  openai: {
    baseUrl: '',
    apiKeys: [],
    models: {
      fast: '',
      writer: '',
    },
  },
  search: {
    provider: 'ddg',
  },
};

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): AppConfig {
  let config: AppConfig = structuredClone(DEFAULT_CONFIG);

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        gemini: {
          ...DEFAULT_CONFIG.gemini,
          ...(parsed.gemini || {}),
          models: { ...DEFAULT_CONFIG.gemini.models, ...(parsed.gemini?.models || {}) },
        },
        openai: {
          ...DEFAULT_CONFIG.openai,
          ...(parsed.openai || {}),
          models: { ...DEFAULT_CONFIG.openai.models, ...(parsed.openai?.models || {}) },
        },
        search: { ...DEFAULT_CONFIG.search, ...(parsed.search || {}) },
      };
    } catch {
      // ponytail: ignore corrupt config and fallback to env/defaults
    }
  }

  // Env overrides
  const envGeminiKey = process.env.GEMINI_API_KEY;
  if (envGeminiKey && !config.gemini.apiKeys.includes(envGeminiKey)) {
    config.gemini.apiKeys.unshift(envGeminiKey);
  }

  const envOpenaiKey = process.env.OPENAI_API_KEY;
  if (envOpenaiKey && !config.openai.apiKeys.includes(envOpenaiKey)) {
    config.openai.apiKeys.unshift(envOpenaiKey);
  }

  const envOpenaiBase = process.env.OPENAI_BASE_URL;
  if (envOpenaiBase) {
    config.openai.baseUrl = envOpenaiBase;
  }

  const envProvider = process.env.TGSDORK_AI_PROVIDER;
  if (envProvider === 'gemini' || envProvider === 'openai-compatible') {
    config.provider = envProvider;
  }

  return config;
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged: AppConfig = {
    ...current,
    ...cfg,
    gemini: {
      ...current.gemini,
      ...(cfg.gemini || {}),
      models: { ...current.gemini.models, ...(cfg.gemini?.models || {}) },
    },
    openai: {
      ...current.openai,
      ...(cfg.openai || {}),
      models: { ...current.openai.models, ...(cfg.openai?.models || {}) },
    },
    search: { ...current.search, ...(cfg.search || {}) },
  };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  return merged;
}
