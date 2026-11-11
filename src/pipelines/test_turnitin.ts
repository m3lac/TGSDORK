import assert from 'node:assert';
import {
  splitAcademicSentences,
  compareSentenceSimilarity,
  indexPaperToCorpus,
  findMatchesInStudentCorpus,
  computeContentHash,
  removePaperFromCorpus,
} from '../core/corpus.js';
import { scanTurnitinWithGemini } from './turnitin.js';
import { resolveIndonesianInstitution } from '../core/campuses.js';

console.log('Running Turnitin Similarity Engine self-checks...');

// 0. Indonesian campus resolution test
assert.strictEqual(
  resolveIndonesianInstitution('https://eprints.undip.ac.id/12345/skripsi.pdf'),
  'Universitas Diponegoro (UNDIP)'
);
assert.strictEqual(
  resolveIndonesianInstitution('https://scholarhub.ui.ac.id/journal/vol1/iss2/'),
  'Universitas Indonesia (UI)'
);
assert.strictEqual(
  resolveIndonesianInstitution('https://etheses.iainkediri.ac.id/23090/'),
  'IAIN Kediri'
);
assert.ok(
  resolveIndonesianInstitution('https://repository.polinema.ac.id/doc.pdf')?.includes('Politeknik Negeri Malang')
);

// 1. Sentence splitting test
const sampleText =
  'Kecerdasan buatan dalam pendidikan tinggi mengalami pertumbuhan pesat (Pratama et al., 2024). Namun, tantangan etika dan privasi data mahasiswa tetap memerlukan regulasi ketat. Apakah sistem ini telah siap diterapkan secara nasional? Tentu perlu evaluasi bertahap.';
const sentences = splitAcademicSentences(sampleText);
assert.ok(sentences.length >= 3, 'Sentences should be split into at least 3 parts');

// 2. Sentence similarity & containment test
const s1 = 'Teknologi kecerdasan buatan memberikan efisiensi tinggi bagi para tenaga pengajar di sekolah.';
const s2 = 'Sistem kecerdasan buatan memberikan efisiensi tinggi bagi para tenaga pengajar di lingkungan akademik.';
const simResult = compareSentenceSimilarity(s1, s2, true);
assert.ok(simResult.isMatch, 'Shallow paraphrase must be detected as match');
assert.ok(simResult.consecutiveWords >= 5, 'Consecutive word match must be >= 5');

// 3. Student paper corpus indexing & cross-matching
const docA = {
  id: 'test-paper-a',
  title: 'Penerapan Sistem Deteksi Kecurangan Akademik',
  topic: 'Penerapan Sistem Deteksi Kecurangan Akademik',
  content:
    '# PENERAPAN SISTEM DETEKSI KECURANGAN\n\nKecurangan akademik dalam bentuk plagiarisme teks digital merupakan ancaman serius terhadap integritas perguruan tinggi. Universitas memerlukan sistem deteksi shingle yang mampu membandingkan korpus mahasiswa secara instan dan akurat tanpa membebani server.',
};

indexPaperToCorpus(docA);

const docBText =
  '# KARYA TULIS MAHASISWA B\n\nPenelitian ini berfokus pada evaluasi integritas tugas akhir. Kecurangan akademik dalam bentuk plagiarisme teks digital merupakan ancaman serius terhadap integritas perguruan tinggi. Kami mengusulkan metode berbasis shingling untuk solusi ini.';

const sentencesB = splitAcademicSentences(docBText);
const hashB = computeContentHash(docBText);

const matches = findMatchesInStudentCorpus(sentencesB, 'Karya Tulis Mahasiswa B', hashB);
assert.ok(matches.length > 0, 'Must detect match against student paper A');
assert.strictEqual(matches[0].docId, 'test-paper-a');
assert.ok(matches[0].matchedWords >= 8, 'Matched words must be >= 8');

// 4. End-to-end Turnitin scan result structure (TGSDORK Student Repository must be hidden)
const scan = await scanTurnitinWithGemini('Karya_Tulis_Mahasiswa_B.docx', docBText);
assert.ok(typeof scan.similarityScore === 'number' && scan.similarityScore >= 0, 'Similarity score must be non-negative');
assert.ok(Array.isArray(scan.sources), 'Sources list must be an array');
assert.ok(
  !scan.sources.some((s) => s.institution === 'TGSDORK Student Repository'),
  'TGSDORK Student Repository must not appear in scan sources'
);
assert.ok(scan.annotatedHtml?.includes('turnitin-paper-sheet'), 'Annotated HTML must render paper sheet');
assert.ok(scan.report.includes('Similarity Index'), 'Report must include Similarity Index');


// Clean up test fixture records from corpus
try {
  removePaperFromCorpus('test-paper-a');
  removePaperFromCorpus(`scan-${hashB.slice(0, 14)}`);
} catch {}
console.log('Turnitin Similarity Engine self-checks PASSED!');
