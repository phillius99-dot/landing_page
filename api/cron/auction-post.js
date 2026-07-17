import { collectWeeklyAuctionPost } from "../../lib/auction.js";

const OWNER = "phillius99-dot";
const REPO = "landing_page";
const POSTS_PATH = "data/posts.json";
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
  if (!res.ok) throw new Error(`${path} 조회 실패: ${res.status}`);
  const data = await res.json();
  return { text: b64decode(data.content), sha: data.sha };
}

async function writeFile(token, path, content, sha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content: b64encode(content), sha }),
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
    const draft = await collectWeeklyAuctionPost();
    if (!draft) {
      res.status(200).json({ posted: false, reason: "이번 주 하남시 낙찰 건 없음" });
      return;
    }

    const token = (process.env.GITHUB_TOKEN || "").trim();
    if (!token) throw new Error("GITHUB_TOKEN 환경변수가 설정되지 않았습니다.");

    const { text: postsText, sha: postsSha } = await fetchFile(token, POSTS_PATH);
    const posts = JSON.parse(postsText || "[]");

    const alreadyPosted = posts.some((p) => p.title === draft.title);
    if (alreadyPosted) {
      res.status(200).json({ posted: false, reason: "이미 게시됨", title: draft.title });
      return;
    }

    const { caseNos, ...post } = draft;
    posts.push(post);
    await writeFile(token, POSTS_PATH, JSON.stringify(posts, null, 2), postsSha, `feat: add auction post "${post.title}"`);

    try {
      const { sha: sitemapSha } = await fetchFile(token, SITEMAP_PATH);
      await writeFile(token, SITEMAP_PATH, buildSitemap(posts), sitemapSha, "chore: update sitemap.xml");
    } catch (sitemapErr) {
      // sitemap 갱신 실패는 게시 자체를 막을 이유가 없으므로 응답에만 남긴다.
      res.status(200).json({
        posted: true,
        title: post.title,
        count: caseNos.length,
        sitemapWarning: String(sitemapErr && sitemapErr.message ? sitemapErr.message : sitemapErr),
      });
      return;
    }

    res.status(200).json({ posted: true, title: post.title, count: caseNos.length });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
