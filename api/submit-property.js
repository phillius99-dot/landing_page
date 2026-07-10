const OWNER = "phillius99-dot";
const REPO = "landing_page";
const PATH = "data/property_submissions.json";

function b64encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function b64decode(base64) {
  return Buffer.from(base64.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function githubRequest(url, options) {
  const res = await fetch(url, options);
  return res;
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
    res.status(405).json({ error: "허용되지 않은 요청입니다." });
    return;
  }

  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    res.status(500).json({ error: "서버 설정 오류로 접수를 처리할 수 없습니다." });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const tradeType = String(body.trade_type || "").trim();
  const address = String(body.address || "").trim();
  const price = String(body.price || "").trim();
  const memo = String(body.memo || "").trim();

  if (!name || !phone) {
    res.status(400).json({ error: "이름과 연락처는 필수입니다." });
    return;
  }
  if (name.length > 50 || phone.length > 30 || address.length > 200 || price.length > 50 || memo.length > 1000) {
    res.status(400).json({ error: "입력값이 너무 깁니다." });
    return;
  }

  const contentsUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const headers = {
    Authorization: "token " + token,
    Accept: "application/vnd.github+json",
  };

  try {
    let submissions = [];
    let sha = undefined;

    const getRes = await githubRequest(contentsUrl, { headers });
    if (getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha;
      try {
        submissions = JSON.parse(b64decode(data.content) || "[]");
      } catch (e) {
        submissions = [];
      }
    } else if (getRes.status !== 404) {
      const errText = await getRes.text().catch(() => "");
      throw new Error(`조회 실패: ${getRes.status} ${errText}`);
    }

    const entry = {
      id: String(Date.now()),
      name,
      phone,
      trade_type: tradeType,
      address,
      price,
      memo,
      status: "대기",
      created_at: new Date().toISOString(),
    };
    submissions.push(entry);

    const putRes = await githubRequest(contentsUrl, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `feat: new property submission from ${name}`,
        content: b64encode(JSON.stringify(submissions, null, 2)),
        sha,
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      throw new Error(`저장 실패: ${putRes.status} ${errText}`);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "접수 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
  }
}
