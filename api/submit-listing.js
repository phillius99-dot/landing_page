const GITHUB_OWNER = "phillius99-dot";
const GITHUB_REPO = "landing_page";
const DATA_PATH = "data/listings.json";

function escapeForCommitMessage(str) {
  return String(str || "").replace(/[\r\n]+/g, " ").slice(0, 80);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "허용되지 않은 요청입니다." });
    return;
  }

  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    res.status(500).json({ ok: false, error: "서버 설정 오류로 접수를 처리할 수 없습니다." });
    return;
  }

  const body = req.body || {};
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const propertyType = String(body.propertyType || "").trim();
  const dealType = String(body.dealType || "").trim();
  const address = String(body.address || "").trim();
  const price = String(body.price || "").trim();
  const memo = String(body.memo || "").trim();

  if (!name || !phone || !propertyType || !dealType || !address) {
    res.status(400).json({ ok: false, error: "필수 항목을 모두 입력해주세요." });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;
  const headers = {
    Authorization: "token " + token,
    Accept: "application/vnd.github+json"
  };

  try {
    let listings = [];
    let sha;
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      try {
        listings = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8") || "[]");
      } catch (e) {
        listings = [];
      }
    } else if (getRes.status !== 404) {
      throw new Error(`목록 조회 실패: ${getRes.status}`);
    }

    const entry = {
      id: String(Date.now()),
      name,
      phone,
      propertyType,
      dealType,
      address,
      price,
      memo,
      status: "접수",
      receivedAt: new Date().toISOString()
    };
    listings.unshift(entry);

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `feat: 매물 접수 - ${escapeForCommitMessage(name)} (${escapeForCommitMessage(address)})`,
        content: Buffer.from(JSON.stringify(listings, null, 2), "utf-8").toString("base64"),
        sha
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(function () { return ""; });
      throw new Error(`저장 실패: ${putRes.status} ${errText}`);
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "접수 처리 중 오류가 발생했습니다." });
  }
}
