import { TIPS } from "../../lib/tips.js";

const OWNER = "phillius99-dot";
const REPO = "landing_page";
const POSTS_PATH = "data/posts.json";
const PROGRESS_PATH = "data/tip_progress.json";
const SITEMAP_PATH = "sitemap.xml";
const SITE_URL = "https://landing-page-six-virid-72.vercel.app";

function b64encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function b64decode(base64) {
  return Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function fetchFile(token, path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`${path} 조회 실패: ${res.status}`);
  const data = await res.json();
  return { text: b64decode(data.content), sha: data.sha };
}

async function writeFile(token, path, content, sha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const body = { message, content: b64encode(content) };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} 저장 실패: ${res.status} ${text}`);
  }
  return res.json();
}

function buildSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today, freq: "weekly", priority: "1.0" },
    { loc: `${SITE_URL}/news`, lastmod: today, freq: "daily", priority: "0.8" },
    ...posts.map((p) => ({
      loc: `${SITE_URL}/news-detail?id=${p.id}`,
      lastmod: p.date || today,
      freq: "monthly",
      priority: "0.6",
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// 상식 문장 맨 앞부분을 제목으로 사용 (첫 문장, 최대 30자)
function makeTitle(tip) {
  const firstSentence = tip.split(/[:.]/)[0].trim();
  const short = firstSentence.length > 30 ? firstSentence.slice(0, 30) + "..." : firstSentence;
  return `오늘의 부동산 상식 - ${short}`;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "인증 실패" });
      return;
    }
  }

  try {
    const token = (process.env.GITHUB_TOKEN || "").trim();
    if (!token) throw new Error("GITHUB_TOKEN 환경변수가 설정되지 않았습니다.");

    // 1) 진행 순번 읽기 (없으면 0부터 시작)
    const { text: progressText, sha: progressSha } = await fetchFile(token, PROGRESS_PATH);
    const progress = progressText ? JSON.parse(progressText) : { index: 0 };
    const idx = progress.index % TIPS.length;
    const tip = TIPS[idx];

    // 2) 오늘 날짜의 posts.json에 새 글 추가
    const { text: postsText, sha: postsSha } = await fetchFile(token, POSTS_PATH);
    const posts = postsText ? JSON.parse(postsText) : [];

    const today = new Date().toISOString().slice(0, 10);
    const post = {
      id: String(Date.now()),
      title: makeTitle(tip),
      category: "부동산 상식",
      date: today,
      content: tip,
    };
    posts.push(post);
    await writeFile(token, POSTS_PATH, JSON.stringify(posts, null, 2), postsSha, `feat: add daily tip post "${post.title}"`);

    // 3) 진행 순번 갱신
    const newProgress = { index: idx + 1 };
    await writeFile(
      token,
      PROGRESS_PATH,
      JSON.stringify(newProgress, null, 2),
      progressSha,
      "chore: update tip progress"
    );

    // 4) sitemap 갱신 (실패해도 게시 자체는 성공 처리)
    try {
      const { sha: sitemapSha } = await fetchFile(token, SITEMAP_PATH);
      await writeFile(token, SITEMAP_PATH, buildSitemap(posts), sitemapSha, "chore: update sitemap.xml");
    } catch (sitemapErr) {
      res.status(200).json({
        posted: true,
        title: post.title,
        tipIndex: idx,
        sitemapWarning: String(sitemapErr && sitemapErr.message ? sitemapErr.message : sitemapErr),
      });
      return;
    }

    res.status(200).json({ posted: true, title: post.title, tipIndex: idx });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
