// /tips, /auction → 카테고리별 모음 페이지 (vercel.json의 rewrite 참고).
// 개별 글은 짧아도, 모음 페이지는 글 전체를 한 곳에 담은 긴 페이지라 검색에 잡히기 좋습니다.
import { bodyText, escapeHtml } from "../lib/markdown.js";
import { SITE_URL, postUrl } from "../lib/sitemap.js";
import { HUBS, OFFICE_PHONE, SITE_NAME, renderShell, truncate } from "../lib/layout.js";
import { byNewest, loadBundledPosts } from "../lib/posts-data.js";

const COPY = {
  tips: {
    title: "부동산 상식 모음 - 세금·임대차·경매·상가 실무 정리 | 왕가부동산",
    h1: "오늘의 부동산 상식 모음",
    intro:
      "왕가부동산공인중개사사무소가 매일 하나씩 정리하는 부동산 실무 상식입니다. 양도소득세·취득세·종합부동산세 같은 세금, 전월세·상가 임대차 보호, 등기부등본 권리분석, 법원경매, 용도지역·인허가까지 하남 미사강변도시에서 아파트·상가를 사고팔거나 임대할 때 자주 마주치는 주제를 모았습니다. 최신 글이 위에 표시됩니다.",
    desc: (n) =>
      `하남 미사강변도시 공인중개사가 정리한 부동산 실무 상식 ${n}개. 양도세·취득세·임대차·등기·경매·용도지역까지 한 페이지에서 확인하세요.`,
    // 상식 글은 짧아서 본문 전체(참고 안내 제외)를 그대로 보여줍니다.
    summary: (p) => bodyText(String(p.content || "").split("\n## 참고하세요")[0]),
    other: "auction",
  },
  auction: {
    title: "하남시 법원경매 낙찰 현황 모음 - 매주 낙찰가율·지역별 결과 | 왕가부동산",
    h1: "하남시 법원경매 낙찰 현황 모음",
    intro:
      "왕가부동산공인중개사사무소가 매주 정리하는 하남시 법원경매 낙찰 결과입니다. 주간 낙찰 건수와 용도별·지역별(망월동·신장동·학암동 등) 분포, 감정가 대비 낙찰가율, 물건별 낙찰가와 권리관계를 확인할 수 있습니다. 최신 주차가 위에 표시됩니다.",
    desc: (n) =>
      `하남시 법원경매 낙찰 결과를 매주 정리합니다. 최근 ${n}주간의 낙찰 건수, 낙찰가율, 망월동·신장동 등 지역별 낙찰 물건을 한눈에 확인하세요.`,
    // 경매 글은 맨 앞 요약 문단만 보여주고 나머지는 상세 글에서 봅니다.
    summary: (p) => bodyText(String(p.content || "").split("\n\n")[0]),
    other: "tips",
  },
};

function renderHub(key, posts) {
  const copy = COPY[key];
  const hub = HUBS[key];
  const other = HUBS[copy.other];
  const url = SITE_URL + hub.path;
  const list = posts.filter((p) => p.category === hub.category).sort(byNewest);

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.h1,
    description: copy.desc(list.length),
    url,
    inLanguage: "ko-KR",
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: list.length,
      itemListElement: list.slice(0, 100).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: postUrl(p.id),
        name: p.title,
      })),
    },
  };

  const items = list
    .map(
      (p) => `<article class="py-lg border-b border-divider/30 last:border-b-0">
<h2 class="text-lg font-bold text-ink"><a href="/news/${escapeHtml(p.id)}" class="hover:text-primary hover:underline">${escapeHtml(p.title)}</a></h2>
<p class="text-muted text-xs mt-xs"><time datetime="${escapeHtml(p.date || "")}">${escapeHtml(p.date || "")}</time></p>
<p class="mt-sm leading-relaxed text-on-surface">${escapeHtml(copy.summary(p))}</p>
</article>`
    )
    .join("\n");

  const main = `<article class="bg-canvas rounded-xl shadow-sm border border-divider/20 p-lg md:p-xl">
<span class="text-primary font-bold text-xs uppercase tracking-wider">${escapeHtml(hub.category)}</span>
<h1 class="font-display-hero text-2xl md:text-display-hero text-ink mt-sm mb-md">${escapeHtml(copy.h1)}</h1>
<p class="leading-relaxed text-on-surface mb-lg">${escapeHtml(copy.intro)}</p>
<p class="text-muted text-sm mb-md">총 ${list.length}개</p>
<div>
${items}
</div>
</article>
<section class="mt-xl bg-canvas rounded-xl shadow-sm border border-divider/20 p-lg">
<p class="leading-relaxed">하남 미사강변도시 아파트·상가 매매·임대차 상담은 <strong>${SITE_NAME}</strong>(<a href="tel:${OFFICE_PHONE}" class="text-primary underline">${OFFICE_PHONE}</a>)로 문의해 주세요.</p>
<p class="mt-md"><a href="${other.path}" class="text-primary font-bold underline">${escapeHtml(other.label)} 보기 →</a> · <a href="/news" class="text-primary font-bold underline">부동산 소식 전체 →</a></p>
</section>`;

  return renderShell({
    title: copy.title,
    desc: truncate(copy.desc(list.length), 160),
    url,
    ld,
    main,
  });
}

export default function handler(req, res) {
  const key = String((req.query && req.query.c) || "");
  if (!COPY[key]) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).send("Not found");
    return;
  }
  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(renderHub(key, loadBundledPosts()));
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).send(`페이지를 불러오지 못했습니다: ${String(err && err.message ? err.message : err)}`);
  }
}
