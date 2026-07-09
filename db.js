let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function base64ToUtf8(base64) {
  const binary = atob(String(base64).replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(function(b) { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function ghInfo() {
  const config = await loadConfig();
  return {
    token: String(config.github_token || '').replace(/\s+/g, ''),
    owner: config.github_owner,
    repo: config.github_repo,
    path: config.data_file_path
  };
}

async function fetchPostsFile() {
  const { token, owner, repo, path } = await ghInfo();
  if (!token || !owner || !repo) {
    throw new Error('GitHub 설정이 올바르지 않습니다. (토큰/저장소 정보를 확인해주세요)');
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (!res.ok) {
    throw new Error(`게시글 조회 실패: ${res.status}`);
  }
  const data = await res.json();
  const text = base64ToUtf8(data.content);
  let posts = [];
  try { posts = JSON.parse(text || '[]'); } catch (e) { posts = []; }
  return { posts, sha: data.sha };
}

async function writePostsFile(posts, sha, message) {
  const { token, owner, repo, path } = await ghInfo();
  if (!token || !owner || !repo) {
    throw new Error('GitHub 설정이 올바르지 않습니다. (토큰/저장소 정보를 확인해주세요)');
  }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message || 'chore: update posts.json',
      content: utf8ToBase64(JSON.stringify(posts, null, 2)),
      sha
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(function () { return ''; });
    throw new Error(`저장 실패: ${res.status} ${errText}`);
  }
  return res.json();
}

async function getPosts() {
  const { posts } = await fetchPostsFile();
  return posts.slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}

async function getPost(id) {
  const posts = await getPosts();
  return posts.find(function (p) { return String(p.id) === String(id); }) || null;
}

async function savePost(post) {
  const { posts, sha } = await fetchPostsFile();
  const newPost = {
    id: String(Date.now()),
    title: post.title || '',
    category: post.category || '',
    date: post.date || new Date().toISOString().slice(0, 10),
    content: post.content || ''
  };
  posts.push(newPost);
  await writePostsFile(posts, sha, `feat: add post "${newPost.title}"`);
  return newPost;
}

async function updatePost(id, updated) {
  const { posts, sha } = await fetchPostsFile();
  const idx = posts.findIndex(function (p) { return String(p.id) === String(id); });
  if (idx === -1) throw new Error('게시글을 찾을 수 없습니다.');
  posts[idx] = Object.assign({}, posts[idx], updated, { id: posts[idx].id });
  await writePostsFile(posts, sha, `chore: update post "${posts[idx].title}"`);
  return posts[idx];
}

async function deletePost(id) {
  const { posts, sha } = await fetchPostsFile();
  const filtered = posts.filter(function (p) { return String(p.id) !== String(id); });
  await writePostsFile(filtered, sha, `chore: delete post ${id}`);
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
