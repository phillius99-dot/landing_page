// 공개 데이터(posts/properties)는 사이트에 배포된 /data/*.json 을 읽고,
// 쓰기·접수 목록은 /api/admin 이 서버에서 비밀번호를 확인한 뒤 처리한다. (브라우저에는 GitHub 토큰을 두지 않는다)

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true' && !!sessionStorage.getItem('adminPw');
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

async function adminCall(action, params) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action: action, password: sessionStorage.getItem('adminPw') || '' }, params || {}))
  });
  const data = await res.json().catch(function () { return {}; });
  if (res.status === 401) {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminPw');
  }
  if (!res.ok) throw new Error(data.error || ('요청 실패: ' + res.status));
  return data;
}

// 관리자 로그인: 서버에서 비밀번호가 맞으면 이 탭(sessionStorage)에만 기억한다
async function adminLogin(password) {
  sessionStorage.setItem('adminPw', password);
  try {
    await adminCall('login');
    sessionStorage.setItem('isAdmin', 'true');
    return true;
  } catch (e) {
    sessionStorage.removeItem('adminPw');
    throw e;
  }
}

function adminLogout() {
  sessionStorage.removeItem('isAdmin');
  sessionStorage.removeItem('adminPw');
}

async function fetchDataJson(path) {
  const res = await fetch('/' + path + '?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('데이터 조회 실패: ' + res.status);
  return res.json();
}

async function getProperties() {
  const properties = await fetchDataJson('data/properties.json');
  return properties.slice().sort(function (a, b) {
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

async function getPosts() {
  const posts = await fetchDataJson('data/posts.json');
  return posts.slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}

async function getPost(id) {
  const posts = await getPosts();
  return posts.find(function (p) { return String(p.id) === String(id); }) || null;
}

async function savePost(post) {
  return (await adminCall('savePost', { post: post })).post;
}

async function updatePost(id, updated) {
  return (await adminCall('updatePost', { id: id, post: updated })).post;
}

async function deletePost(id) {
  await adminCall('deletePost', { id: id });
  return true;
}

async function getSubmissions() {
  const { submissions } = await adminCall('listSubmissions');
  return submissions.slice().sort(function (a, b) {
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

async function deleteSubmission(id) {
  await adminCall('deleteSubmission', { id: id });
  return true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  const parts = text.split('`');
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      result += '<code>' + parts[i] + '</code>';
      continue;
    }
    let seg = parts[i];
    seg = seg.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, t, url) {
      const trimmedUrl = url.trim();
      if (/^(https?:|mailto:)/i.test(trimmedUrl)) {
        return '<a href="' + trimmedUrl + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
      }
      return t;
    });
    seg = seg.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    seg = seg.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    seg = seg.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result += seg;
  }
  return result;
}

function renderMarkdown(src) {
  if (!src) return '';
  const escaped = escapeHtml(src);
  const lines = escaped.split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeBlockBuf = [];
  let listType = null;
  let listBuf = [];
  let paraBuf = [];

  function flushPara() {
    if (paraBuf.length) {
      html += '<p>' + paraBuf.join('<br>') + '</p>';
      paraBuf = [];
    }
  }
  function flushList() {
    if (listType) {
      html += '<' + listType + '>' + listBuf.join('') + '</' + listType + '>';
      listType = null;
      listBuf = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        flushPara(); flushList();
        inCodeBlock = true;
        codeBlockBuf = [];
      } else {
        html += '<pre><code>' + codeBlockBuf.join('\n') + '</code></pre>';
        inCodeBlock = false;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockBuf.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '') {
      flushPara();
      flushList();
      continue;
    }

    let m;
    if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); flushList();
      const level = m[1].length;
      html += '<h' + level + '>' + renderInline(m[2]) + '</h' + level + '>';
      continue;
    }
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushPara(); flushList();
      html += '<hr>';
      continue;
    }
    if ((m = trimmed.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      html += '<blockquote><p>' + renderInline(m[1]) + '</p></blockquote>';
      continue;
    }
    if ((m = trimmed.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuf.push('<li>' + renderInline(m[1]) + '</li>');
      continue;
    }
    if ((m = trimmed.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuf.push('<li>' + renderInline(m[1]) + '</li>');
      continue;
    }

    flushList();
    paraBuf.push(renderInline(trimmed));
  }
  flushPara();
  flushList();
  if (inCodeBlock && codeBlockBuf.length) {
    html += '<pre><code>' + codeBlockBuf.join('\n') + '</code></pre>';
  }
  return html;
}

function markdownToText(src) {
  if (!src) return '';
  return String(src)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
