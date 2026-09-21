// 서버 렌더링 API(api/post.js, api/hub.js)가 공유하는 글 데이터 로더
import fs from "fs";
import path from "path";

const RAW_POSTS_URL = "https://raw.githubusercontent.com/phillius99-dot/landing_page/main/data/posts.json";

// 배포에 포함된 posts.json (빠르고 안정적)
export function loadBundledPosts() {
  const file = path.join(process.cwd(), "data", "posts.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// 방금 올린 글처럼 아직 재배포가 끝나지 않은 경우를 위한 폴백 (GitHub 최신본)
export async function loadLatestPosts() {
  const res = await fetch(RAW_POSTS_URL);
  if (!res.ok) throw new Error("GitHub posts.json 조회 실패: " + res.status);
  return res.json();
}

export function byNewest(a, b) {
  return String(b.date || "").localeCompare(String(a.date || "")) || String(b.id).localeCompare(String(a.id));
}
