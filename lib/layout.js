// 서버 렌더링 페이지(글 상세, 모음 페이지)가 공유하는 HTML 틀
import { escapeHtml } from "./markdown.js";
import { SITE_URL } from "./sitemap.js";

export const SITE_NAME = "왕가부동산공인중개사사무소";
export const OFFICE_PHONE = "010-3366-7187";
export const OFFICE_ADDRESS = "경기도 하남시 미사강변중앙로 180, 1층 1057호 (망월동 1099-1, 힐스테이트 미사역 그랑파사쥬 11-1BL)";
export const NAVER_BLOG_URL = "https://blog.naver.com/phillius9";

// 검색엔진·AI 검색이 '왕가부동산 = 신득주 대표(신소장)'를 한 주체로 묶을 수 있도록
// 모든 페이지가 같은 @id 로 사무소와 대표를 가리킵니다 (index.html 의 JSON-LD 와 같은 @id).
export const AGENT_ID = `${SITE_URL}/#agent`;
export const PERSON_ID = `${SITE_URL}/#shin`;

export const AGENT_LD = {
  "@type": "RealEstateAgent",
  "@id": AGENT_ID,
  name: SITE_NAME,
  alternateName: ["왕가부동산", "왕가부동산 신소장"],
  url: `${SITE_URL}/`,
  telephone: OFFICE_PHONE,
  image: `${SITE_URL}/agent.jpg`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "미사강변중앙로 180, 1층 1057호 (망월동 1099-1, 힐스테이트 미사역 그랑파사쥬)",
    addressLocality: "하남시",
    addressRegion: "경기도",
    addressCountry: "KR",
  },
  areaServed: ["하남 미사강변도시", "경기도 하남시"],
  sameAs: [NAVER_BLOG_URL],
  founder: { "@id": PERSON_ID },
};

export const PERSON_LD = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: "신득주",
  alternateName: "신소장",
  jobTitle: "대표 공인중개사",
  worksFor: { "@id": AGENT_ID },
  knowsAbout: ["하남 미사강변도시 아파트", "미사 오피스텔 월세", "미사 상가 임대·매매", "하남 법원경매"],
  sameAs: [NAVER_BLOG_URL],
};

// 글 본문의 '**Q. 질문?**' 다음 줄 'A. 답' 형식을 FAQPage 로 뽑습니다 (블로그 주제글·매물글의 자주 묻는 질문 섹션).
export function extractFaq(markdown) {
  const out = [];
  const re = /\*\*Q\.\s*([^*\n]+?)\*\*\s*\n+\s*A\.\s*([\s\S]+?)(?=\n\s*\n|\n\s*\*\*Q\.|$)/g;
  let m;
  while ((m = re.exec(String(markdown || "")))) {
    const q = m[1].trim();
    const a = m[2].replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    if (q && a) out.push({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } });
  }
  return out;
}

// 글 하단 작성자 표시 (사람이 보기에도, 크롤러가 읽기에도 '누가 썼는지'가 분명하도록)
export function authorBox() {
  return `<aside class="mt-xl pt-lg border-t border-divider/40 text-sm text-muted" aria-label="작성자">
<p><strong class="text-ink">작성 · 신득주 대표(신소장)</strong> — ${SITE_NAME}</p>
<p>하남 미사강변도시 현장에서 아파트·오피스텔·상가 매매·임대와 법원경매를 상담합니다.</p>
<p>${escapeHtml(OFFICE_ADDRESS)} · <a href="tel:${OFFICE_PHONE}" class="text-primary font-bold">☎ ${OFFICE_PHONE}</a> · <a href="${NAVER_BLOG_URL}" class="underline">네이버 블로그</a></p>
</aside>`;
}

// 글 하단 매물접수 배너 (온라인 접수 페이지 /sell 로 바로 이동)
export function sellBanner() {
  return `<a href="/sell" class="mt-xl block bg-ink text-white rounded-2xl p-lg sm:p-xl no-underline hover:opacity-95 transition-opacity" style="text-decoration:none">
<p class="text-primary-container font-bold text-sm mb-xs">상가 · 오피스텔 · 아파트 매물을 내놓으시나요?</p>
<p class="text-2xl font-black leading-snug mb-md">하남 미사 매물접수 <span class="text-primary-container">온라인 1분 접수</span></p>
<span class="inline-flex items-center gap-xs bg-primary-container text-ink px-lg py-sm rounded-xl font-black">매물접수 하러 가기 →</span>
</a>`;
}

// JSON-LD를 <script>에 넣을 때 </script> 로 끊기지 않도록 '<'를 이스케이프
export function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

const STYLE = `<style>
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
        #post-content h3 { font-size: 1.15em; }
        #post-content p { margin: 0.8em 0; line-height: 1.7; }
        #post-content ul, #post-content ol { margin: 0.8em 0; padding-left: 1.4em; }
        #post-content ul { list-style: disc; }
        #post-content ol { list-style: decimal; }
        #post-content li { line-height: 1.7; }
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
    </script>`;

/**
 * @param {object} o
 * @param {string} o.title      <title> 및 og:title
 * @param {string} o.desc       meta description
 * @param {string} o.url        canonical URL
 * @param {string} [o.ogType]   article | website
 * @param {string} [o.published] article:published_time
 * @param {object} [o.ld]       JSON-LD 객체
 * @param {string} o.main       <main> 안쪽 HTML
 * @param {string} [o.script]   </body> 직전에 넣을 <script>...</script>
 */
export function renderShell({ title, desc, url, ogType = "website", published, ld, main, script = "" }) {
  const image = `${SITE_URL}/agent.jpg`;
  return `<!DOCTYPE html>
<html class="light" lang="ko">
<head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta property="og:type" content="${ogType}"/>
<meta property="og:site_name" content="${SITE_NAME}"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:image" content="${image}"/>
<meta property="og:locale" content="ko_KR"/>
${published ? `<meta property="article:published_time" content="${escapeHtml(published)}"/>\n` : ""}<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
${ld ? `<script type="application/ld+json">${jsonLd(ld)}</script>\n` : ""}<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
${STYLE}
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
${main}
</main>
${script}
</body>
</html>
`;
}

export const HUBS = {
  tips: { path: "/tips", category: "부동산 상식", label: "부동산 상식 모음" },
  auction: { path: "/auction", category: "경매 정보", label: "하남시 법원경매 낙찰 모음" },
};

export function hubForCategory(category) {
  return Object.values(HUBS).find((h) => h.category === category) || null;
}
