import assert from 'node:assert';
import { DORK_PRESETS } from './presets.js';
import { buildDorkQueries } from './builder.js';
import { extractContentFromSource } from './extractor.js';
import type { SourceItem } from '../types/index.js';

console.log('Running Phase 2 self-checks...');

// 1. Presets check
assert.ok(DORK_PRESETS['id-academic'], 'id-academic preset must exist');
assert.ok(DORK_PRESETS['global-scholar'], 'global-scholar preset must exist');
assert.ok(DORK_PRESETS['gov-data'], 'gov-data preset must exist');
assert.ok(DORK_PRESETS['id-academic'].templates.length >= 3);

// 2. Builder check
const queries = await buildDorkQueries({ topic: 'Deep Learning Keuangan', count: 3 });
assert.strictEqual(queries.length, 3);
assert.ok(
  queries[0].toLowerCase().includes('keuangan') || queries[0].toLowerCase().includes('deep learning'),
  'Query must contain topic keywords'
);

// 3. Extractor metadata check
const mockItem: SourceItem = {
  id: 'src-1',
  title: 'Penerapan Machine Learning Pada Sistem Deteksi Fraud',
  url: 'https://ejournal.undip.ac.id/index.php/jtsiskom/article/view/1234/1234.pdf',
  snippet: 'Studi kasus implementasi algoritma machine learning tahun 2023...',
  citation: '',
  fullRef: '',
  fileType: 'pdf',
};

const extracted = await extractContentFromSource(mockItem);
assert.ok(extracted.citation.length > 0, 'Citation must be generated');
assert.ok(extracted.fullRef.length > 0, 'FullRef must be generated');
assert.ok(extracted.citation.includes('2023'), 'Citation should detect year 2023');
assert.ok(extracted.content && extracted.content.length > 0, 'Content must exist');

console.log('Phase 2 self-checks PASSED!');
