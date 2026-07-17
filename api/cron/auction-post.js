import { collectWeeklyAuctionPost } from "../../lib/auction.js";

const OWNER = "phillius99-dot";
const REPO = "landing_page";
const PATH = "data/posts.json";

function b64encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function b64decode(base64) {
  return Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function fetchPostsFile(token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`게시글 목록 조회 실패: ${res.status}`);
  const data = await res.json();
  const posts = JSON.parse(b64decode(data.content) || "[]");
  return { posts, sha: data.sha };
}

async function writePostsFile(token, posts, sha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: b64encode(JSON.stringify(posts, null, 2)),
      sha,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`저장 실패: ${res.status} ${text}`);
  }
  return res.json();
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

    const { posts, sha } = await fetchPostsFile(token);

    const alreadyPosted = posts.some((p) => p.title === draft.title);
    if (alreadyPosted) {
      res.status(200).json({ posted: false, reason: "이미 게시됨", title: draft.title });
      return;
    }

    const { caseNos, ...post } = draft;
    posts.push(post);
    await writePostsFile(token, posts, sha, `feat: add auction post "${post.title}"`);

    res.status(200).json({ posted: true, title: post.title, count: caseNos.length });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
}
