// /news/:id → 게시글을 서버에서 HTML로 완성해 내려줍니다 (vercel.json의 rewrite 참고).
// 검색엔진·AI 크롤러가 JS 실행 없이도 제목/본문/메타태그를 읽을 수 있게 하는 것이 목적입니다.
import { bodyText, escapeHtml, renderMarkdown } from "../lib/markdown.js";
import { SITE_URL, postUrl } from "../lib/sitemap.js";
import { SITE_NAME, hubForCategory, renderShell, truncate } from "../lib/layout.js";
import { byNewest, loadBundledPosts, loadLatestPosts } from "../lib/posts-data.js";

const DEFAULT_DESC = "왕가부동산공인중개사사무소가 전하는 하남 미사강변도시 부동산 뉴스입니다.";
// 같은 카테고리 글을 먼저, 부족하면 다른 카테고리 최신 글로 채웁니다.
function pickRelated(post, posts) {
  const others = posts.filter((p) => String(p.id) !== String(post.id)).sort(byNewest);
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, 6);
}

function renderPage(post, related) {
  const title = `${post.title || "게시글"} | 왕가부동산`;
  // 하단 안내문(## 참고하세요)은 설명문에서 제외
  const desc = truncate(bodyText(String(post.content || "").split("\n## 참고하세요")[0]), 150) || DEFAULT_DESC;
  const url = postUrl(post.id);
  const hub = hubForCategory(post.category);

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
    image: `${SITE_URL}/agent.jpg`,
    inLanguage: "ko-KR",
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };

  const hubLink = hub
    ? `<p class="mt-lg"><a href="${hub.path}" class="text-primary font-bold underline">${escapeHtml(hub.label)} 전체 보기 →</a></p>`
    : "";

  const relatedHtml = related.length
    ? `<section class="mt-xl" aria-label="다른 글">
<h2 class="font-bold text-ink text-lg mb-md">다른 글 보기</h2>
<ul class="bg-canvas rounded-xl shadow-sm border border-divider/20 divide-y divide-divider/20">
${related
  .map(
    (o) =>
      `<li><a href="/news/${escapeHtml(o.id)}" class="block px-lg py-md hover:bg-surface"><span class="text-primary font-bold text-xs">${escapeHtml(o.category || "")}</span> <span class="text-muted text-xs ml-sm">${escapeHtml(o.date || "")}</span><span class="block text-ink">${escapeHtml(o.title || "")}</span></a></li>`
  )
  .join("\n")}
</ul>
</section>`
    : "";

  const main = `<article id="post-article" class="bg-canvas rounded-xl shadow-sm border border-divider/20 p-lg md:p-xl">
<span class="text-primary font-bold text-xs uppercase tracking-wider">${escapeHtml(post.category || "")}</span>
<h1 class="font-display-hero text-2xl md:text-display-hero text-ink mt-sm mb-sm">${escapeHtml(post.title || "")}</h1>
<p class="text-muted text-sm mb-lg"><time datetime="${escapeHtml(post.date || "")}">${escapeHtml(post.date || "")}</time></p>
<div id="post-content">${renderMarkdown(post.content || "")}</div>
${hubLink}
<div id="admin-actions" class="hidden mt-xl pt-lg border-t border-divider flex gap-md">
<a id="edit-btn" class="px-lg py-md rounded-lg bg-primary-container text-on-surface font-bold flex items-center justify-center" href="/news-write.html?id=${encodeURIComponent(post.id)}">수정</a>
<button id="delete-btn" class="px-lg py-md rounded-lg bg-error text-white font-bold">삭제</button>
</div>
</article>
${relatedHtml}`;

  // 관리자 로그인 상태일 때만 db.js를 불러와 수정/삭제 버튼을 활성화합니다.
  const script = `<script>
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
</script>`;

  return renderShell({ title, desc, url, ogType: "article", published: post.date, ld, main, script });
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

    // 새 배포가 나가면 CDN 캐시는 자동으로 갱신됩니다. (GitHub 최신본으로 만든 페이지는 짧게만 캐시)
    res.setHeader("Cache-Control", fresh ? "public, s-maxage=60" : "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(renderPage(post, pickRelated(post, posts)));
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).send(`게시글을 불러오지 못했습니다: ${String(err && err.message ? err.message : err)}`);
  }
}
