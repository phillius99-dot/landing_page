// 서버 렌더링 페이지(글 상세, 모음 페이지)가 공유하는 HTML 틀
import { escapeHtml } from "./markdown.js";
import { SITE_URL } from "./sitemap.js";

export const SITE_NAME = "왕가부동산공인중개사사무소";
export const OFFICE_PHONE = "010-3366-7187";

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
