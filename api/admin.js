// 관리자 전용 API. 비밀번호 확인과 GitHub 쓰기를 모두 서버에서 처리한다.
// (예전에는 /api/config 가 GitHub 토큰과 관리자 비밀번호를 브라우저로 그대로 내려보냈음)
// 필요 환경변수: GITHUB_TOKEN, ADMIN_PASSWORD
import crypto from "crypto";

const OWNER = "phillius99-dot";
const FILES = {
  posts: { repo: "landing_page", path: "data/posts.json" },
  submissions: { repo: "wangga_private_data", path: "data/property_submissions.json" }, // 접수자 개인정보 → 비공개 저장소
};

function b64encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function b64decode(base64) {
  return Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf-8");
}

function passwordOk(input) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || typeof input !== "string") return false;
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function readFile(name) {
  const { repo, path } = FILES[name];
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`, {
    headers: { Authorization: "token " + process.env.GITHUB_TOKEN.trim(), Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return { items: [], sha: undefined };
  if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
  const data = await res.json();
  let items = [];
  try { items = JSON.parse(b64decode(data.content) || "[]"); } catch (e) { items = []; }
  return { items, sha: data.sha };
}

async function writeFile(name, items, sha, message) {
  const { repo, path } = FILES[name];
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: "token " + process.env.GITHUB_TOKEN.trim(),
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content: b64encode(JSON.stringify(items, null, 2)), sha }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`저장 실패: ${res.status} ${errText}`);
  }
}

const ACTIONS = {
  async login() {
    return { ok: true };
  },
  async listSubmissions() {
    const { items } = await readFile("submissions");
    return { submissions: items };
  },
  async deleteSubmission({ id }) {
    const { items, sha } = await readFile("submissions");
    const filtered = items.filter((s) => String(s.id) !== String(id));
    await writeFile("submissions", filtered, sha, `chore: remove submission ${id}`);
    return { ok: true };
  },
  async savePost({ post }) {
    const { items, sha } = await readFile("posts");
    const newPost = {
      id: String(Date.now()),
      title: String(post.title || ""),
      category: String(post.category || ""),
      date: String(post.date || new Date().toISOString().slice(0, 10)),
      content: String(post.content || ""),
    };
    items.push(newPost);
    await writeFile("posts", items, sha, `feat: add post "${newPost.title}"`);
    return { post: newPost };
  },
  async updatePost({ id, post }) {
    const { items, sha } = await readFile("posts");
    const idx = items.findIndex((p) => String(p.id) === String(id));
    if (idx === -1) throw new Error("게시글을 찾을 수 없습니다.");
    const allowed = {};
    for (const k of ["title", "category", "date", "content"]) {
      if (post[k] !== undefined) allowed[k] = String(post[k]);
    }
    items[idx] = Object.assign({}, items[idx], allowed, { id: items[idx].id });
    await writeFile("posts", items, sha, `chore: update post "${items[idx].title}"`);
    return { post: items[idx] };
  },
  async deletePost({ id }) {
    const { items, sha } = await readFile("posts");
    const filtered = items.filter((p) => String(p.id) !== String(id));
    await writeFile("posts", filtered, sha, `chore: delete post ${id}`);
    return { ok: true };
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "허용되지 않은 요청입니다." });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (!process.env.ADMIN_PASSWORD) {
    res.status(503).json({ error: "관리자 비밀번호가 서버에 설정되지 않았습니다. (Vercel 환경변수 ADMIN_PASSWORD)" });
    return;
  }
  if (!passwordOk(body.password)) {
    await new Promise((r) => setTimeout(r, 800)); // 비밀번호 대입 시도를 느리게
    res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
    return;
  }
  const action = ACTIONS[body.action];
  if (!action) {
    res.status(400).json({ error: "알 수 없는 요청입니다." });
    return;
  }
  if (!(process.env.GITHUB_TOKEN || "").trim()) {
    res.status(500).json({ error: "서버 설정 오류(GITHUB_TOKEN)" });
    return;
  }
  try {
    res.status(200).json(await action(body));
  } catch (e) {
    res.status(500).json({ error: e.message || "처리 중 오류가 발생했습니다." });
  }
}
