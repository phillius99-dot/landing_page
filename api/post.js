// /news/:id → 게시글을 서버에서 HTML로 완성해 내려줍니다 (vercel.json의 rewrite 참고).
// 검색엔진·AI 크롤러가 JS 실행 없이도 제목/본문/메타태그를 읽을 수 있게 하는 것이 목적입니다.
import fs from "fs";
import path from "path";
import { escapeHtml, markdownToText, renderMarkdown } from "../lib/markdown.js";
import { SITE_URL, postUrl } from "../lib/sitemap.js";

const SITE_NAME = "왕가부동산공인중개사사무소";
const DEFAULT_DESC = "왕가부동산공인중개사사무소가 전하는 하남 미사강변도시 부동산 뉴스입니다.";

const RAW_POSTS_URL = "https://raw.githubusercontent.com/phillius99-dot/landing_page/main/data/posts.json";

// 배포에 포함된 posts.json (빠르고 안정적)
function loadBundledPosts() {
  const file = path.join(process.cwd(), "data", "posts.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// 방금 올린 글처럼 아직 재배포가 끝나지 않은 경우를 위한 폴백 (GitHub 최신본)
async function loadLatestPosts() {
  const res = await fetch(RAW_POSTS_URL);
  if (!res.ok) throw new Error("GitHub posts.json 조회 실패: " + res.status);
  return res.json();
}

// JSON-LD를 <script>에 넣을 때 </script> 로 끊기지 않도록 '<'를 이스케이프
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function renderPage(post, others) {
  const title = `${post.title || "게시글"} | 왕가부동산`;
  const desc = truncate(markdownToText(post.content || ""), 150) || DEFAULT_DESC;
  const url = postUrl(post.id);
  const image = `${SITE_URL}/agent.jpg`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title || "",
    description: desc,
    datePublished: post.date || undefined,
    dateModified: post.date || undefined,
    articleSection: post.category || undefined,
    mainEntityOfPage: url,
    url,
    image,
    inLanguage: "ko-KR",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };

  const relatedHtml = others.length
    ? `<section class="mt-xl" aria-label="다른 글">
<h2 class="font-bold text-ink text-lg mb-md">다른 글 보기</h2>
<ul class="bg-canvas rounded-xl shadow-sm border border-divider/20 divide-y divide-divider/20">
${others
  .map(
    (o) =>
      `<li><a href="/news/${escapeHtml(o.id)}" class="block px-lg py-md hover:bg-surface"><span class="text-primary font-bold text-xs">${escapeHtml(o.category || "")}</span> <span class="text-muted text-xs ml-sm">${escapeHtml(o.date || "")}</span><span class="block text-ink">${escapeHtml(o.title || "")}</span></a></li>`
  )
  .join("\n")}
</ul>
</section>`
    : "";

  return `<!DOCTYPE html>
<html class="light" lang="ko">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="${SITE_NAME}"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:locale" content="ko_KR"/>
${post.date ? `<meta property="article:published_time" content="${escapeHtml(post.date)}"/>\n` : ""}<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
<script type="application/ld+json">${jsonLd(ld)}</script>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            font-family: 'Noto Sans KR', sans-serif;
            background-color: #fff8f1;
            font-size: 15px;
        }
        a, button { min-height: 44px; }
        #post-content h1, #post-content h2, #post-content h3 { font-weight: 700; color: #151515; margin: 1.2em 0 0.5em; }
        #post-content h1 { font-size: 1.6em; }
        #post-content h2 { font-size: 1.4em; }
        #post-content h3 { font-size: 1.2em; }
        #post-content p { margin: 0.8em 0; line-height: 1.7; }
        #post-content ul, #post-content ol { margin: 0.8em 0; padding-left: 1.4em; }
        #post-content ul { list-style: disc; }
        #post-content ol { list-style: decimal; }
        #post-content blockquote { border-left: 4px solid #ffcc00; padding-left: 1em; margin: 1em 0; color: #666; }
        #post-content code { background: #f1e7d5; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
        #post-content pre { background: #1f1b10; color: #fff8f1; padding: 1em; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
        #post-content pre code { background: transparent; padding: 0; color: inherit; }
        #post-content hr { border: none; border-top: 1px solid #d2c5ab; margin: 1.5em 0; }
        #post-content a { color: #745b00; text-decoration: underline; }
</style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "primary-tint": "#FAEAAD", "surface": "#F9F9F9", "on-secondary": "#ffffff",
                        "tertiary": "#006874", "primary-container": "#ffcc00", "background": "#fff8f1",
                        "error": "#ba1a1a", "surface-container": "#f7eddb", "canvas": "#FFFFFF",
                        "muted": "#666666", "ink": "#151515", "on-surface": "#1f1b10",
                        "divider": "#AAAAAA", "primary": "#745b00", "on-primary": "#ffffff",
                        "surface-container-highest": "#ebe1d0"
                    },
                    "spacing": { "md": "16px", "xl": "32px", "section": "64px", "lg": "24px", "base": "20px", "sm": "8px", "xs": "4px", "xxl": "48px" },
                    "fontFamily": { "body-main": ["Noto Sans KR"], "headline-section": ["Plus Jakarta Sans"], "display-hero": ["Plus Jakarta Sans"] }
                },
            },
        }
    </script>
</head>
<body class="bg-background text-on-surface">
<header class="w-full sticky top-0 z-50 bg-surface border-b border-divider shadow-sm">
<div class="max-w-3xl mx-auto px-lg flex justify-between items-center h-16">
<a href="/" class="text-headline-section font-headline-section font-bold text-primary">왕가부동산</a>
<a href="/news" class="text-on-surface-variant hover:text-primary transition-colors font-body-main flex items-center gap-xs">
<span class="material-symbols-outlined">arrow_back</span> 목록으로
</a>
</div>
</header>
<main class="max-w-3xl mx-auto px-lg py-section pb-24 md:pb-section">
<article id="post-article" class="bg-canvas rounded-xl shadow-sm border border-divider/20 p-lg md:p-xl">
<span class="text-primary font-bold text-xs uppercase tracking-wider">${escapeHtml(post.category || "")}</span>
<h1 class="font-display-hero text-2xl md:text-display-hero text-ink mt-sm mb-sm">${escapeHtml(post.title || "")}</h1>
<p class="text-muted text-sm mb-lg"><time datetime="${escapeHtml(post.date || "")}">${escapeHtml(post.date || "")}</time></p>
<div id="post-content">${renderMarkdown(post.content || "")}</div>
<div id="admin-actions" class="hidden mt-xl pt-lg border-t border-divider flex gap-md">
<a id="edit-btn" class="px-lg py-md rounded-lg bg-primary-container text-on-surface font-bold flex items-center justify-center" href="/news-write.html?id=${encodeURIComponent(post.id)}">수정</a>
<button id="delete-btn" class="px-lg py-md rounded-lg bg-error text-white font-bold">삭제</button>
</div>
</article>
${relatedHtml}
</main>
<script>
// 관리자 로그인 상태일 때만 db.js를 불러와 수정/삭제 버튼을 활성화합니다.
(function () {
  var isAdmin = false;
  try { isAdmin = sessionStorage.getItem('isAdmin') === 'true'; } catch (e) {}
  if (!isAdmin) return;
  document.getElementById('admin-actions').classList.remove('hidden');
  var s = document.createElement('script');
  s.src = '/db.js';
  s.onload = function () {
    document.getElementById('delete-btn').addEventListener('click', async function () {
      if (!confirm('정말 삭제하시겠습니까?')) return;
      try {
        await deletePost(${JSON.stringify(String(post.id))});
        window.location.href = '/news';
      } catch (e) {
        alert('삭제 실패: ' + e.message);
      }
    });
  };
  document.head.appendChild(s);
})();
</script>
</body>
</html>
`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>게시글을 찾을 수 없습니다 | 왕가부동산</title>
<meta name="robots" content="noindex"/>
</head><body style="font-family:'Noto Sans KR',sans-serif;text-align:center;padding:64px 16px">
<h1>게시글을 찾을 수 없습니다.</h1>
<p><a href="/news">부동산 소식 목록으로</a> · <a href="/">홈으로</a></p>
</body></html>
`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const id = String((req.query && req.query.id) || "");
    const validId = /^\d+$/.test(id);
    const findPost = (list) => (validId ? list.find((p) => String(p.id) === id) : null);

    let posts = loadBundledPosts();
    let post = findPost(posts);
    let fresh = false;
    if (!post && validId) {
      try {
        posts = await loadLatestPosts();
        post = findPost(posts);
        fresh = !!post;
      } catch (e) {
        // 폴백 실패 시 아래에서 404 처리
      }
    }

    if (!post) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).send(renderNotFound());
      return;
    }

    const others = posts
      .filter((p) => String(p.id) !== id)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.id).localeCompare(String(a.id)))
      .slice(0, 5);

    // 새 배포가 나가면 CDN 캐시는 자동으로 갱신됩니다. (GitHub 최신본으로 만든 페이지는 짧게만 캐시)
    res.setHeader("Cache-Control", fresh ? "public, s-maxage=60" : "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(renderPage(post, others));
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).send(`게시글을 불러오지 못했습니다: ${String(err && err.message ? err.message : err)}`);
  }
}
