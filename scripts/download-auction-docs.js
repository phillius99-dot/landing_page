#!/usr/bin/env node
// 이번 주 하남시 낙찰 물건들의 등기부등본/매각물건명세서 PDF를 내려받아
// 바탕화면\경매문서 폴더에 저장합니다. 내 컴퓨터에서 직접 실행되는 스크립트라
// api/cron/auction-post.js(Vercel 클라우드 크론)와는 별개로 동작합니다.
//
// 사용법: node scripts/download-auction-docs.js
// 필요 환경변수: MYAUCTION_ID, MYAUCTION_PW (scripts/.env.local 파일에 설정)

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { login, fetchResults, parseListingHtml } from "../lib/auction.js";

const BASE = "https://www.my-auction.co.kr";
const OUTPUT_DIR = path.join(os.homedir(), "Desktop", "경매문서");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 물건 상세페이지 사이드바의 문서 링크(pop_detail 호출)에 쓰이는 type 값들.
// 물건마다 달라지는 게 아니라 문서 종류별로 고정된 값이다.
const DOC_TYPES = {
  mulgun: { type: "mul", label: "매각물건명세서" },
  deungibu: { type: "aceeaea1", label: "등기부등본" },
};

function kstDate(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function safeName(s) {
  return s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

async function downloadDoc(cookie, idx, type, refererUrl) {
  const wrapperUrl = `${BASE}/auction/auction_detail_view.php?type=${type}&idx=${idx}`;
  const wrapperRes = await fetch(wrapperUrl, { headers: { Cookie: cookie, Referer: refererUrl } });
  if (!wrapperRes.ok) throw new Error(`문서 페이지 조회 실패: ${wrapperRes.status}`);
  const wrapperHtml = await wrapperRes.text();

  const $ = cheerio.load(wrapperHtml);
  const iframeSrc = $("iframe").attr("src");
  if (!iframeSrc) throw new Error("문서가 없는 물건입니다 (오래된 물건이거나 미제공)");

  // 문서 서버(irea.nuriauction.com 등)는 Referer가 방금 연 래퍼 페이지와 일치해야
  // 내용을 내려준다. 주소창에 바로 입력하면 빈 페이지만 나오는 이유가 이것.
  const docRes = await fetch(iframeSrc, { headers: { Referer: wrapperUrl } });
  if (!docRes.ok) throw new Error(`문서 다운로드 실패: ${docRes.status}`);
  const buf = Buffer.from(await docRes.arrayBuffer());
  if (buf.slice(0, 4).toString("latin1") !== "%PDF") {
    throw new Error("응답이 PDF 형식이 아닙니다");
  }
  return buf;
}

async function main() {
  loadLocalEnv();
  const id = process.env.MYAUCTION_ID;
  const pw = process.env.MYAUCTION_PW;
  if (!id || !pw) {
    console.error("MYAUCTION_ID / MYAUCTION_PW 환경변수가 필요합니다. scripts/.env.local 파일을 만들어 설정하세요.");
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("마이옥션 로그인 중...");
  const cookie = await login(id, pw);

  const dateTo = kstDate(0);
  const dateFrom = kstDate(-6);
  console.log(`하남시 매각 결과 조회 중 (${dateFrom} ~ ${dateTo})...`);
  const html = await fetchResults(cookie, { dateFrom, dateTo });
  const items = parseListingHtml(html);

  if (!items.length) {
    console.log("이번 주 하남시 낙찰 건이 없습니다.");
    return;
  }

  for (const item of items) {
    if (!item.idx) {
      console.log(`[건너뜀] ${item.address}: 상세페이지 링크를 찾지 못함`);
      continue;
    }

    const refererUrl = `${BASE}/view/${item.idx}`;
    const baseName = safeName(item.address);

    for (const { type, label } of Object.values(DOC_TYPES)) {
      try {
        const buf = await downloadDoc(cookie, item.idx, type, refererUrl);
        fs.writeFileSync(path.join(OUTPUT_DIR, `${baseName} ${label}.pdf`), buf);
        console.log(`저장됨: ${baseName} ${label}.pdf`);
      } catch (e) {
        console.error(`[실패] ${baseName} ${label}: ${e.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
