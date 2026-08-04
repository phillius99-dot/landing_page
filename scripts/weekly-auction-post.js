#!/usr/bin/env node
// 매주 하남시 법원경매 낙찰 현황을 posts.json에 추가하고 GitHub에 커밋/푸시합니다.
// Vercel 크론(api/cron/auction-post.js)과 동일한 로직이지만, my-auction.co.kr이
// 클라우드/데이터센터 IP를 차단해 Vercel에서는 접속 자체가 안 되기 때문에
// 이 컴퓨터(주거용 IP)에서 Windows 작업 스케줄러로 직접 실행합니다.
//
// 사용법: node scripts/weekly-auction-post.js
// 필요 환경변수: MYAUCTION_ID, MYAUCTION_PW (scripts/.env.local 파일에 설정)

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { collectWeeklyAuctionPost } from "../lib/auction.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const POSTS_PATH = path.join(rootDir, "data", "posts.json");

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

function git(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" });
}

async function main() {
  loadLocalEnv();
  if (!process.env.MYAUCTION_ID || !process.env.MYAUCTION_PW) {
    console.error("MYAUCTION_ID / MYAUCTION_PW 환경변수가 필요합니다. scripts/.env.local 파일을 만들어 설정하세요.");
    process.exit(1);
  }

  console.log("마이옥션 로그인 및 이번 주 낙찰 결과 조회 중...");
  const draft = await collectWeeklyAuctionPost();
  if (!draft) {
    console.log("이번 주 하남시 낙찰 건이 없습니다. 포스트를 생성하지 않습니다.");
    return;
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf8"));
  if (posts.some((p) => p.title === draft.title)) {
    console.log(`이미 게시된 포스트입니다: ${draft.title}`);
    return;
  }

  const { caseNos, ...post } = draft;
  posts.push(post);
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2));
  console.log(`포스트 추가됨: ${post.title} (${caseNos.length}건)`);

  execFileSync("node", [path.join(__dirname, "generate-sitemap.js")], { cwd: rootDir, stdio: "inherit" });

  git(["add", "data/posts.json", "sitemap.xml"]);
  git(["commit", "-m", `feat: add auction post "${post.title}"`]);
  git(["push"]);
  console.log("GitHub에 커밋 및 푸시 완료.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
