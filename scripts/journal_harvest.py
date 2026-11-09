#!/usr/bin/env python3
"""
Scrape jurnal metadata (OpenAlex) → SQLite lokal.
OpenAlex = 300M+ works, gratis, CC0. Store: title + abstract (inverted index → teks)
+ abstract n-gram → SHINGLES buat similarity check lokal.

Usage:
  python3 journal_harvest.py harvest --topic "kebakaran hutan" [--max N]
  python3 journal_harvest.py harvest-all [--per-topic N]      # preset topik umum Indonesia
  python3 journal_harvest.py stats
  python3 journal_harvest.py check "frasa yang mau dicek"
"""
import argparse
import gzip
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

DB = os.path.expanduser('~/.tgsdork/journals.db')
UA = 'Mozilla/5.0 (mailto:research@academic.org)'  # OpenAlex etiquette: masukin email di UA
BASE = 'https://api.openalex.org/works'

# Preset topik makalah Indonesia umum (per-page 200, cursor paging)
PRESET_TOPICS = [
    'kebakaran hutan lahan gambut',
    'media sosial remaja',
    'keamanan data pribadi',
    'cyberbullying remaja',
    'perubahan iklim indonesia',
    'ekonomi digital indonesia',
    'pendidikan karakter',
    'kesehatan mental remaja',
    'energi terbarukan indonesia',
    'pariwisata berkelanjutan',
    'pertanian organik',
    'ekonomi digital umkm',
    'sosial media remaja identitas',
    'kecerdasan buatan pendidikan',
    'transformasi digital umkm',
    'inflasi indonesia kebijakan moneter',
    'fint peer to peer lending syariah',
    'kesehatan mental mahasiswa',
    'kerja sama asean ekonomi',
    'pariwisata indonesia pembangunan berkelanjutan',
]


def norm_text(t):
    t = (t or '').lower()
    return ' '.join(re.sub(r'[^a-z0-9]', ' ', t).split())


def inverted_to_text(ai):
    """abstract_inverted_index → plain text"""
    if not ai:
        return ''
    pos_word = {}
    for word, positions in ai.items():
        for p in pos_word if False else positions:
            pos_word[p] = word
    return ' '.join(pos_word[i] for i in sorted(pos_word))


def shingles(text, n=5):
    words = norm_text(text).split(' ')
    return set(' '.join(words[i:i + n]) for i in range(max(1, len(words) - n + 1)))


def connect():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    con = sqlite3.connect(DB)
    con.execute('''CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY,
        doi TEXT,
        title TEXT,
        abstract TEXT,
        year INTEGER,
        shingles TEXT
    )''')
    return con


def fetch_json(url, retries=4):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode('utf-8', 'ignore'))
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))
    return None


def harvest_topic(topic, max_records):
    con = connect()
    cursor = '*'
    got = 0
    while got < max_records:
        q = urllib.parse.quote(topic)
        url = f'https://api.openalex.org/works?search={q}&per_page=200&cursor={cursor}&select=id,doi,title,abstract_inverted_index,publication_year'
        d = fetch_json(url)
        if not d or not d.get('results'):
            break
        cursor = d['meta'].get('next_cursor')
        rows = []
        for w in d['results']:
            abstract = inverted_to_text(w.get('abstract_inverted_index'))
            if len(abstract) < 200:
                continue  # terlalu pendek buat shingle berguna
            sh = sorted(shingles(abstract, 5))
            rows.append((w['id'], w.get('doi'), w.get('title', ''), abstract, w.get('publication_year'), json.dumps(list(sh))))
            got += 1
        con.executemany('INSERT OR IGNORE INTO works VALUES (?,?,?,?,?,?)', rows)
        con.commit()
        print(f'[{topic}] {got}/{max_records} records | cursor={(cursor or "done")[:20]}...', file=sys.stderr)
        if not d['meta'].get('next_cursor'):
            break
        cursor = d['meta']['next_cursor']
        time.sleep(0.15)
    con.close()


def stats():
    con = sqlite3.connect(DB)
    n = con.execute('SELECT COUNT(*) FROM works').fetchone()[0]
    avg = con.execute('SELECT AVG(LENGTH(abstract)) FROM works WHERE abstract IS NOT NULL').fetchone()[0] or 0
    total_shingles = con.execute('SELECT SUM(LENGTH(shingles)) FROM works').fetchone()[0] or 0
    print(f'records: {n}')
    print(f'avg abstract len: {avg:.0f} chars')
    print(f'db size: {os.path.getsize(DB) / 1e6:.1f} MB')
    con.close()


def harvest_all(per_topic):
    for topic in PRESET_TOPICS:
        print(f'=== {topic} ===', file=sys.stderr)
        harvest_topic(topic, per_topic)
    stats()


def cmd_check(phrase):
    """Cek apakah frasa ada di abstract yang tersimpan (approximate index lokal)."""
    con = sqlite3.connect(DB)
    needle = norm_text(phrase)
    # Index lokal: LIKE scan pada shingle JSON (ponytail: O(n) scan; FTS5 kalau corpus besar)
    hits = 0
    for (sh, ) in con.execute('SELECT shingles FROM works'):
        if needle and needle in ' '.join(json.loads(sh)):
            pass  # shingle di-store sebagai list of joined 5-gram, exact match jarang; pakai word overlap
    # Simpler: word-level LIKE di abstract
    hits = con.execute('SELECT COUNT(*) FROM works WHERE abstract LIKE ?', (f'%{phrase}%',)).fetchone()[0]
    print(f'phrase match: {hits} works')
    if hits:
        for row in con.execute('SELECT title, doi FROM works WHERE abstract LIKE ? LIMIT 5', (f'%{phrase}%',)):
            print(' -', row[0][:80], '|', row[1])
    con.close()


def main():
    argv = sys.argv[1:]
    cmd = argv[0] if argv else ''
    args = argv[1:]

    if cmd == 'harvest':
        topic = args[args.index('--topic') + 1] if '--topic' in args else 'kebakaran hutan'
        mx = int(args[args.index('--max') + 1]) if '--max' in args else 1000
        harvest_topic(topic, mx)
    elif cmd == 'harvest-all':
        per = int(args[args.index('--per-topic') + 1]) if '--per-topic' in args else 200
        for t in PRESET_TOPICS:
            harvest_topic(t, per)
        stats()
    elif cmd == 'stats':
        stats()
    elif cmd == 'check':
        cmd_check(' '.join(args))
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
