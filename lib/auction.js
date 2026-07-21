import * as cheerio from "cheerio";

const BASE = "https://www.my-auction.co.kr";
const GYEONGGI = "3";
const HANAM = "162";

// 아파트,주택,다세대,다가구,근린주택,오피스텔,도시형생활주택,근린시설,상가,공장,아파트형공장,
// 숙박시설,주유소,병원,아파트상가,창고,목욕시설,콘도(호텔),운동시설,휴게시설,노유자시설,자동차관련시설,펜션,교육시설,장례관련시설
const USAGE_CODES = [
  "101", "102", "103", "104", "105", "106", "107",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210",
  "211", "212", "213", "214", "215", "216", "217", "218", "219",
];

function extractCookies(res) {
  const getSetCookie = res.headers.getSetCookie;
  const raw = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
  if (raw.length) {
    return raw.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(",").map((c) => c.split(";")[0].trim()).join("; ") : "";
}

export async function login(id, pw) {
  // 로그인 폼은 제출 전 jQuery로 아이디/비밀번호를 base64 인코딩해
  // 숨겨진 id/pwd 필드에 넣고 login_id/login_pw는 비워서 보낸다(js/common.js
  // #btn_login 클릭 핸들러 참고). 서버가 이 형식을 기대하므로 동일하게 맞춘다.
  const res = await fetch(`${BASE}/member/login_handle.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${BASE}/member/login.php`,
    },
    body: new URLSearchParams({
      rtn_page: "",
      id: Buffer.from(id, "utf-8").toString("base64"),
      pwd: Buffer.from(pw, "utf-8").toString("base64"),
      login_id: "",
      login_pw: "",
    }),
    redirect: "manual",
  });
  const cookie = extractCookies(res);
  if (!cookie) {
    throw new Error("로그인 실패: 세션 쿠키를 받지 못했습니다 (아이디/비밀번호 확인 필요)");
  }

  // 로그인 실패 시에도 서버가 200 OK + 새 세션쿠키를 내려주고, 본문에
  // <script>alert('...');history.back()</script> 형태의 에러만 담아 응답한다.
  // 쿠키 유무만으로는 성공 여부를 알 수 없어 본문 패턴을 함께 확인한다.
  if (res.status < 300) {
    const body = await res.text();
    if (/alert\(/i.test(body) || /history\.back/i.test(body)) {
      throw new Error(`로그인 실패: 마이옥션 응답 - ${body.slice(0, 200)}`);
    }
  }

  return cookie;
}

function kstDate(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}

export async function fetchResults(cookie, { dateFrom, dateTo }) {
  // 검색 폼(search.php)을 거치지 않고 결과 URL을 바로 요청하면 서버가 메인으로
  // 리다이렉트한다(리퍼러/세션 체크로 추정). 실제 이용자 흐름과 동일하게
  // search.php를 먼저 방문한 뒤, 그 페이지를 리퍼러로 결과를 요청한다.
  await fetch(`${BASE}/auction/search.php`, { headers: { Cookie: cookie } });

  // search.php 폼이 실제로 제출하는 히든 필드를 전부 그대로 보낸다. 일부만
  // 보내면(예: usage_code_all 누락) 서버가 지역/종류 필터를 무시하고 전국
  // 결과를 돌려주는 것을 확인했다 (예: 하남시만 요청했는데 수원시 결과가 섞임).
  const params = new URLSearchParams();
  params.set("usage_code_all", USAGE_CODES.join(","));
  params.set("stitle", "");
  params.set("spe_age", "");
  params.set("gm_age", "");
  params.set("npls", "N");
  params.set("spels", "Y");
  params.set("schs", "N");
  params.set("pchs", "N");
  params.set("address2_01", "");
  params.set("address2_02", "");
  params.set("address2_03", "");
  params.set("acharge_01", "");
  params.set("ps_alert", "");
  params.set("stc", "1");
  params.set("address1_01", GYEONGGI);
  params.set("address1_02", HANAM);
  params.set("address1_03", "");
  params.set("ipdate1", dateFrom);
  params.set("ipdate2", dateTo);
  params.set("eprice1", "0");
  params.set("eprice2", "0");
  params.set("sno", "");
  params.set("tno", "");
  params.set("regal", "");
  params.set("mprice1", "0");
  params.set("mprice2", "0");
  params.set("barea1", "");
  params.set("barea2", "");
  params.set("np1", "");
  params.set("np2", "");
  params.set("apoint1", "0");
  params.set("apoint2", "0");
  params.set("larea1", "");
  params.set("larea2", "");
  params.set("buildingtxt", "");
  params.set("aresult", "매각");
  params.set("aorder", "1");
  params.append("usage_code", "");
  for (const code of USAGE_CODES) params.append("usage_code", code);

  const res = await fetch(`${BASE}/auction/search_list.php?${params.toString()}`, {
    headers: {
      Cookie: cookie,
      Referer: `${BASE}/auction/search.php`,
    },
  });
  if (!res.ok) throw new Error(`검색 결과 조회 실패: ${res.status}`);
  const html = await res.text();
  if (!html.includes("tbl_auction_right") && !html.includes("검색결과가 없습니다")) {
    throw new Error("검색 결과 페이지를 받지 못했습니다 (리다이렉트 또는 세션 만료 가능성)");
  }
  return html;
}

function simplifyAddress(addr) {
  // '경기도 하남시 미사강변중앙로 226, 14층1431호 (망월동,우성르보아파크)'
  // -> '망월동 우성르보아파크 14층1431호' 처럼 기존 수기 게시글 스타일에 맞춘다.
  let text = (addr || "").trim().replace(/^경기도\s*하남시\s*/, "");
  const m = text.match(/\(([가-힣0-9]+동)\s*,\s*([\s\S]*)\)\s*$/);
  if (!m) return text;
  const dong = m[1];
  const building = m[2];
  const prefix = text.slice(0, m.index).trim().replace(/,$/, "").trim();
  const unitMatch = prefix.match(/,\s*([^,]+)$/);
  const unit = unitMatch ? unitMatch[1].trim() : prefix;
  return [dong, building, unit].filter(Boolean).join(" ");
}

function parseWon(str) {
  return (str || "").replace(/[^\d]/g, "");
}

function formatWon(str) {
  const n = parseWon(str);
  return n ? `${n.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원` : "";
}

export function parseListingHtml(html) {
  const $ = cheerio.load(html);
  const items = [];

  $("td.tbl_auction_right").each((_, priceCell) => {
    const $row = $(priceCell).closest("tr");
    const tds = $row.find("td");
    if (tds.length < 7) return;

    const typeCaseText = $(tds[2]).text().replace(/\s+/g, " ").trim();
    const addrText = $(tds[3]).text().replace(/\s+/g, " ").trim();
    const priceText = $(priceCell).text().replace(/\s+/g, " ").trim();
    const statusText = $(tds[5]).text().replace(/\s+/g, " ").trim();
    const saleDateText = $(tds[6]).text().replace(/\s+/g, " ").trim();

    const caseMatch = typeCaseText.match(/(\d{4}-\d{3,7})/);
    const caseNo = caseMatch ? caseMatch[1] : "";
    const usage = caseMatch ? typeCaseText.slice(0, caseMatch.index).trim() : typeCaseText;
    const court = caseMatch ? typeCaseText.slice(caseMatch.index + caseMatch[0].length).trim() : "";

    const buildingMatch = addrText.match(/건물\s*([\d.]+)\s*평(?:\s*\[(\d+)평형\])?/);
    const landMatch = addrText.match(/토지\s*([\d.]+)\s*평/);
    const rawAddress = buildingMatch ? addrText.slice(0, buildingMatch.index).trim() : addrText;
    const address = simplifyAddress(rawAddress);

    let rightsAndTags = "";
    if (landMatch) {
      rightsAndTags = addrText.slice(landMatch.index + landMatch[0].length).trim();
    }
    const tagMatch = rightsAndTags.match(/\[([^\]]+)\]/);
    const zoneTags = tagMatch ? tagMatch[1] : "";
    const specialRights = tagMatch ? rightsAndTags.slice(0, tagMatch.index).trim() : rightsAndTags;

    const prices = priceText.split(" ").filter(Boolean);
    const appraisal = formatWon(prices[0]);
    const minPrice = formatWon(prices[1]);
    const soldPrice = formatWon(prices[2]);

    const bidderMatch = statusText.match(/입찰\s*[:：]?\s*(\d+)\s*명/);
    const rateMatch = statusText.match(/\((\d+)%\)/);

    if (!caseNo || !address || !soldPrice) return;

    const detailHref = $row.find('a[href^="/view/"]').first().attr("href") || "";
    const idxMatch = detailHref.match(/\/view\/(\d+)/);

    items.push({
      caseNo,
      idx: idxMatch ? idxMatch[1] : "",
      court,
      usage: usage || "기타",
      address,
      buildingArea: buildingMatch ? buildingMatch[1] : "",
      buildingType: buildingMatch && buildingMatch[2] ? `${buildingMatch[2]}평형` : "",
      landArea: landMatch ? landMatch[1] : "",
      specialRights,
      zoneTags,
      appraisal,
      minPrice,
      soldPrice,
      bidders: bidderMatch ? bidderMatch[1] : "",
      rate: rateMatch ? rateMatch[1] : "",
      saleDate: saleDateText,
    });
  });

  return items;
}

export function buildMarkdown(items) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.usage)) groups.set(it.usage, []);
    groups.get(it.usage).push(it);
  }

  const sections = [];
  for (const [usage, list] of groups) {
    const entries = list.map((it) => {
      const lines = [];
      lines.push(`- **${it.address}**`);
      const areaParts = [];
      if (it.buildingArea) areaParts.push(`건물 ${it.buildingArea}평${it.buildingType ? `(${it.buildingType})` : ""}`);
      if (it.landArea) areaParts.push(`토지 ${it.landArea}평`);
      let areaLine = areaParts.join(" / ");
      if (it.specialRights) areaLine += ` · ${it.specialRights} 있음`;
      if (areaLine) lines.push(`  - ${areaLine}`);
      const rateText = it.rate ? `낙찰가율 ${it.rate}%` : "";
      const bidderText = it.bidders ? `입찰 ${it.bidders}명` : "";
      const meta = [rateText, bidderText].filter(Boolean).join(", ");
      lines.push(`  - 감정가 ${it.appraisal} → 최저가 ${it.minPrice} → **낙찰가 ${it.soldPrice}**${meta ? ` (${meta})` : ""}`);
      if (it.zoneTags) lines.push(`  - [${it.zoneTags}]`);
      return lines.join("\n");
    });
    sections.push(`## ${usage}\n\n${entries.join("\n\n")}`);
  }

  sections.push(
    "---\n\n이번 주 하남시 법원경매 낙찰 결과였습니다. 관심 있는 물건이나 입찰 상담이 필요하시면 왕가부동산으로 편하게 문의해 주세요."
  );

  return sections.join("\n\n");
}

export async function collectWeeklyAuctionPost() {
  const id = process.env.MYAUCTION_ID;
  const pw = process.env.MYAUCTION_PW;
  if (!id || !pw) {
    throw new Error("MYAUCTION_ID / MYAUCTION_PW 환경변수가 설정되지 않았습니다.");
  }

  const dateTo = kstDate(0);
  const dateFrom = kstDate(-6);

  const cookie = await login(id, pw);
  const html = await fetchResults(cookie, { dateFrom, dateTo });
  const items = parseListingHtml(html);

  if (!items.length) {
    return null;
  }

  const title = `하남시 최신 법원경매 낙찰 현황 (${dateTo.replace(/-/g, ".")} 기준)`;
  const content = buildMarkdown(items);

  return {
    id: String(Date.now()),
    title,
    category: "경매 정보",
    date: dateTo,
    content,
    caseNos: items.map((it) => it.caseNo),
  };
}
