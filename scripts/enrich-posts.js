#!/usr/bin/env node
// 이미 올라간 "부동산 상식"·"경매 정보" 글을 새 형식(검색용 제목 + 요약/구조)으로 다시 씁니다.
// 여러 번 실행해도 안전합니다(이미 바뀐 글은 건너뜀).
// 사용법: node scripts/enrich-posts.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TIPS, buildTipContent, tipTitle } from '../lib/tips.js';
import { auctionTitleSuffix, summarizeAuction } from '../lib/auction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsPath = path.join(__dirname, '..', 'data', 'posts.json');
const raw = fs.readFileSync(postsPath, 'utf8');
const posts = JSON.parse(raw);

const OLD_CTA = '이번 주 하남시 법원경매 낙찰 결과였습니다. 관심 있는 물건이나 입찰 상담이 필요하시면 왕가부동산으로 편하게 문의해 주세요.';
const NEW_CTA = '이번 주 하남시 법원경매 낙찰 결과였습니다. 관심 있는 물건이나 입찰 상담이 필요하시면 왕가부동산(010-3366-7187)으로 편하게 문의해 주세요.';

// 기존(구) 경매 글 마크다운을 items로 읽고, 새 형식으로 변환
function enrichAuction(post) {
  if (post.content.includes('낙찰되었습니다')) return false;

  const items = [];
  const out = [];
  let usage = '';
  let cur = null;
  for (const line of post.content.split('\n')) {
    let m;
    if ((m = line.match(/^## (.+)$/))) {
      usage = m[1].trim();
      out.push(line);
    } else if ((m = line.match(/^- \*\*(.+)\*\*$/))) {
      cur = { usage, address: m[1], rate: '' };
      items.push(cur);
      out.push(`### ${m[1]} (${usage})`);
    } else if (/^  - /.test(line)) {
      const dedented = line.slice(2);
      const r = dedented.match(/낙찰가율 (\d+)%/);
      if (r && cur) cur.rate = r[1];
      out.push(dedented);
    } else {
      out.push(line);
    }
  }
  if (!items.length) return false;

  const body = out.join('\n').replace(OLD_CTA, NEW_CTA);
  post.content = `${summarizeAuction(items, post.date)}\n\n${body}`;
  if (!/기준\)\s+-\s/.test(post.title)) post.title = `${post.title} - ${auctionTitleSuffix(items)}`;
  return true;
}

function enrichTip(post) {
  if (post.content.includes('## 참고하세요')) return false;
  const tip = TIPS.find((t) => t.trim() === post.content.trim());
  if (!tip) return false;
  post.title = tipTitle(tip);
  post.content = buildTipContent(tip);
  return true;
}

// 저장 형식이 크론과 같은지 확인 (같아야 변경분만 diff에 잡힘)
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const normalized = JSON.stringify(posts, null, 2).replace(/\n/g, eol);
if (normalized !== raw.replace(/\n$|\r\n$/, '')) {
  console.warn('경고: posts.json 서식이 예상과 달라 전체 diff가 크게 보일 수 있습니다.');
}

let tips = 0;
let auctions = 0;
let skipped = 0;
for (const post of posts) {
  if (post.category === '부동산 상식') {
    if (enrichTip(post)) tips++;
    else skipped++;
  } else if (post.category === '경매 정보') {
    if (enrichAuction(post)) auctions++;
    else skipped++;
  }
}

const trailing = /\r?\n$/.test(raw) ? eol : '';
fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2).replace(/\n/g, eol) + trailing);
console.log(`상식 ${tips}건, 경매 ${auctions}건 보강 (건너뜀 ${skipped}건)`);
