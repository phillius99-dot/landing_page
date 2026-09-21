#!/usr/bin/env node
// 새 게시글을 올린 후 이 스크립트를 실행하면 sitemap.xml이 data/posts.json 기준으로 다시 생성됩니다.
// 사용법: node scripts/generate-sitemap.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSitemap } from '../lib/sitemap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'posts.json'), 'utf8'));

const xml = buildSitemap(posts);
fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), xml);
console.log(`sitemap.xml 생성 완료 (${(xml.match(/<loc>/g) || []).length}개 URL)`);
