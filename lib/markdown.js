// 서버(api/post.js)에서 게시글을 HTML로 렌더링하기 위한 마크다운 변환기.
// db.js(브라우저용)의 renderMarkdown/markdownToText와 동일한 규칙을 유지해야 합니다.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  const parts = text.split("`");
  let result = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      result += "<code>" + parts[i] + "</code>";
      continue;
    }
    let seg = parts[i];
    seg = seg.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, url) => {
      const trimmedUrl = url.trim();
      if (/^(https?:|mailto:)/i.test(trimmedUrl)) {
        return '<a href="' + trimmedUrl + '" target="_blank" rel="noopener noreferrer">' + t + "</a>";
      }
      return t;
    });
    seg = seg.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    seg = seg.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    seg = seg.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    result += seg;
  }
  return result;
}

export function renderMarkdown(src) {
  if (!src) return "";
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeBlockBuf = [];
  let listType = null;
  let listBuf = [];
  let paraBuf = [];

  function flushPara() {
    if (paraBuf.length) {
      html += "<p>" + paraBuf.join("<br>") + "</p>";
      paraBuf = [];
    }
  }
  function flushList() {
    if (listType) {
      html += "<" + listType + ">" + listBuf.join("") + "</" + listType + ">";
      listType = null;
      listBuf = [];
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        flushPara();
        flushList();
        inCodeBlock = true;
        codeBlockBuf = [];
      } else {
        html += "<pre><code>" + codeBlockBuf.join("\n") + "</code></pre>";
        inCodeBlock = false;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockBuf.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === "") {
      flushPara();
      flushList();
      continue;
    }

    let m;
    if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      flushList();
      const level = m[1].length;
      html += "<h" + level + ">" + renderInline(m[2]) + "</h" + level + ">";
      continue;
    }
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      flushPara();
      flushList();
      html += "<hr>";
      continue;
    }
    if ((m = trimmed.match(/^>\s?(.*)$/))) {
      flushPara();
      flushList();
      html += "<blockquote><p>" + renderInline(m[1]) + "</p></blockquote>";
      continue;
    }
    if ((m = trimmed.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listBuf.push("<li>" + renderInline(m[1]) + "</li>");
      continue;
    }
    if ((m = trimmed.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listBuf.push("<li>" + renderInline(m[1]) + "</li>");
      continue;
    }

    flushList();
    paraBuf.push(renderInline(trimmed));
  }
  flushPara();
  flushList();
  if (inCodeBlock && codeBlockBuf.length) {
    html += "<pre><code>" + codeBlockBuf.join("\n") + "</code></pre>";
  }
  return html;
}

export function markdownToText(src) {
  if (!src) return "";
  return String(src)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^-{3,}$/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
