import { chromium, type Browser } from 'playwright';
import * as cheerio from 'cheerio';
import { logger } from '../core/logger.js';

let sharedBrowser: Browser | null = null;

// ponytail: lazy single browser instance reuse to save 4GB RAM footprint
async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export async function fetchWithPlaywright(
  url: string,
  options: { timeoutMs?: number; blockMedia?: boolean } = {}
): Promise<string> {
  const { timeoutMs = 15000, blockMedia = true } = options;
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Low-spec optimization: block images, media, and stylesheets if requested
  if (blockMedia) {
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,mp4,avi,webm,woff,woff2,ttf}', (route) =>
      route.abort()
    );
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // wait a moment for initial hydration
    await page.waitForTimeout(1000);
    const html = await page.content();
    return html;
  } finally {
    await context.close().catch(() => {});
  }
}

export function parseHtmlLight(html: string): {
  title: string;
  text: string;
  links: string[];
} {
  const $ = cheerio.load(html);

  const title = $('title').text().trim() || $('h1').first().text().trim();

  // Strip noise elements
  $('script, style, nav, footer, header, aside, iframe, noscript, svg, .ad, .ads, .menu').remove();

  let body = $('article').text();
  if (!body || body.trim().length < 200) {
    body = $('main').text();
  }
  if (!body || body.trim().length < 200) {
    body = $('body').text();
  }

  const clean = body
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http')) {
      links.push(href);
    }
  });

  return {
    title,
    text: clean,
    links: Array.from(new Set(links)),
  };
}
