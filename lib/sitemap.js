// sitemap.xml 생성 로직 (크론 2종 + scripts/generate-sitemap.js 공용)
export const SITE_URL = "https://landing-page-six-virid-72.vercel.app";

export function postUrl(id) {
  return `${SITE_URL}/news/${id}`;
}

export function buildSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today, freq: "weekly", priority: "1.0" },
    { loc: `${SITE_URL}/news`, lastmod: today, freq: "daily", priority: "0.8" },
    { loc: `${SITE_URL}/properties`, lastmod: today, freq: "weekly", priority: "0.8" },
    { loc: `${SITE_URL}/tips`, lastmod: today, freq: "daily", priority: "0.8" },
    { loc: `${SITE_URL}/auction`, lastmod: today, freq: "weekly", priority: "0.8" },
    ...posts.map((p) => ({
      loc: postUrl(p.id),
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
