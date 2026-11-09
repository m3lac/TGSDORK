import assert from 'node:assert';
import { parseHtmlLight, fetchWithPlaywright, closeBrowser } from './browser.js';

console.log('Running Browser & Light HTML Parser self-checks...');

// 1. Light HTML parser test
const mockHtml = `
<!DOCTYPE html>
<html>
<head><title>Jurnal AI Indonesia</title></head>
<body>
  <nav><a href="/home">Home</a></nav>
  <main>
    <h1>Penerapan Deep Learning 2024</h1>
    <p>Penelitian ini membahas pemanfaatan algoritma deep learning dalam sistem cerdas masa depan.</p>
    <a href="https://example.com/paper.pdf">Download PDF</a>
  </main>
  <script>console.log("bad script");</script>
  <footer>Footer text</footer>
</body>
</html>
`;

const parsed = parseHtmlLight(mockHtml);
assert.strictEqual(parsed.title, 'Jurnal AI Indonesia');
assert.ok(parsed.text.includes('Penelitian ini membahas pemanfaatan'));
assert.ok(!parsed.text.includes('bad script'));
assert.ok(!parsed.text.includes('Footer text'));
assert.ok(parsed.links.includes('https://example.com/paper.pdf'));

// 2. Playwright headless browser check
try {
  const html = await fetchWithPlaywright('https://example.com', { timeoutMs: 10000 });
  assert.ok(html.includes('Example Domain'), 'Playwright must fetch example.com');
  console.log('Playwright live fetch verified successfully!');
} finally {
  await closeBrowser();
}

console.log('Browser & Light HTML Parser self-checks PASSED!');
