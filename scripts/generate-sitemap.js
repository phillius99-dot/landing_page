#!/usr/bin/env node
// 새 게시글을 올린 후 이 스크립트를 실행하면 sitemap.xml이 data/posts.json 기준으로 다시 생성됩니다.
// 사용법: node scripts/generate-sitemap.js

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://landing-page.vercel.app'; // 실제 도메인이 정해지면 이 값을 변경하세요

const rootDir = path.join(__dirname, '..');
const posts = require(path.join(rootDir, 'data', 'posts.json'));
const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: `${SITE_URL}/`, lastmod: today, freq: 'weekly', priority: '1.0' },
  { loc: `${SITE_URL}/news`, lastmod: today, freq: 'daily', priority: '0.8' },
  ...posts.map((p) => ({
    loc: `${SITE_URL}/news-detail?id=${p.id}`,
    lastmod: p.date || today,
    freq: 'monthly',
    priority: '0.6',
  })),
];

const body = urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc.replace(/&/g, '&amp;')}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), xml);
console.log(`sitemap.xml 생성 완료 (${urls.length}개 URL)`);
