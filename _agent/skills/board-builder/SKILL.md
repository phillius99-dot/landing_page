---
name: board-builder
description: GitHub API & Vercel 기반 정적 게시판 홈페이지를 구축한다.
---

# board-builder

## 아키텍처
- 정적 프론트엔드(HTML/CSS/JS) + Vercel 서버리스 함수(`api/config.js`) + GitHub Contents API 조합의 서버리스 CMS.
- 데이터 저장소: GitHub 저장소 내 `data/posts.json` (배열, 각 항목은 `{id, title, category, date, content}`).
- 인증: `sessionStorage.isAdmin` 플래그 + `admin.html` 비밀번호 로그인. 서버 세션 없음.
- 글쓰기/수정/삭제는 브라우저에서 GitHub Contents API(PUT)로 직접 커밋됨.

## 설정 소스 분리 (필수)
- `github_token`, `admin_password` → `/api/config` (Vercel 환경변수 `GITHUB_TOKEN`, `ADMIN_PASSWORD`에서 주입).
- `github_owner`, `github_repo`, `data_file_path` → 정적 파일 `config/git_config.json`.
- `db.js`의 `loadConfig()`는 두 소스를 항상 병렬로 조회 후 병합해야 함. 하나만 조회하면 `repos/undefined/undefined/...` 형태로 GitHub API URL이 깨짐.
- `config/git_config.json`에는 실제 토큰을 저장하지 않는다 (`"YOUR_GITHUB_TOKEN"` 플레이스홀더 고정) — GitHub Push Protection에 의해 실제 토큰이 포함된 커밋은 차단됨.

## 파일 구조
```
├── _agent/skills/board-builder/SKILL.md
├── api/config.js          # GITHUB_TOKEN, ADMIN_PASSWORD만 반환 (클라이언트 노출용)
├── api/submit-listing.js  # 매물 접수 폼 처리, GITHUB_TOKEN은 서버에서만 사용(비노출)
├── config/git_config.json # owner/repo/data_file_path (+ 토큰 placeholder)
├── data/posts.json        # 게시글 데이터 (배열)
├── data/listings.json     # 매물 접수 데이터 (배열, {id,name,phone,propertyType,dealType,address,price,memo,status,receivedAt})
├── templates/post-template.md
├── vercel.json             # zero-config: cleanUrls + trailingSlash만 지정, builds 금지
├── db.js                   # 설정 로드, GitHub API CRUD(게시글/매물접수 공용 fetchJsonFile/writeJsonFile), 마크다운 렌더러
├── index.html               # 메인 + 최신 게시글 3개 미리보기(#board-preview) + 매물 접수 모달(#listing-modal)
├── news.html                # 게시글 목록 + 검색 + 카테고리 탭
├── news-detail.html         # 게시글 상세 (마크다운 렌더링, 관리자 수정/삭제)
├── news-write.html          # 글쓰기/수정 (관리자 전용, requireAdmin())
└── admin.html                # 관리자 로그인 + 대시보드 (게시글 관리 / 매물 접수 관리 탭)
```

## 매물 접수 플로우
- `index.html`의 "온라인 매물 접수하기" 버튼 → 모달 폼 → `POST /api/submit-listing`.
- `api/submit-listing.js`는 서버(Vercel 함수) 안에서만 `process.env.GITHUB_TOKEN`을 사용해 `data/listings.json`에 GitHub Contents API로 커밋한다. 클라이언트에는 토큰을 전혀 내려주지 않는다 — 공개 접수 폼이라 `api/config.js`처럼 토큰을 브라우저에 노출하면 누구나 저장소에 쓸 수 있게 되므로 반드시 서버 사이드로만 처리할 것.
- 관리자는 `admin.html`의 "매물 접수 관리" 탭에서 `db.js`의 `getListings()`/`deleteListing()`(기존 클라이언트 노출 토큰 사용, 관리자 로그인 후 UI만 노출)으로 조회/삭제한다.

## 금지 사항
- `public/` 폴더를 만들지 않는다 — Vercel이 이를 사이트 루트로 취급해 루트의 HTML 파일들이 전부 404가 됨.
- `vercel.json`에 `builds`/`routes`를 넣지 않는다 — 레거시 builds는 `/api` 라우팅을 누락시켜 `/api/config`가 404가 되고, 그 결과 토큰을 못 받아 저장이 실패함.
- GitHub 토큰 문자열은 항상 `.replace(/\s+/g, '')` 또는 `.trim()`으로 정리 후 `Authorization` 헤더에 사용한다 — 줄바꿈이 섞이면 `fetch` 자체가 실패함.

## 마크다운 렌더러
- `db.js`의 `renderMarkdown(src)` / `markdownToText(src)`는 외부 라이브러리 없이 구현.
- 반드시 입력을 먼저 `escapeHtml`로 이스케이프한 뒤 서식을 적용해 XSS를 방지.
- 코드 스팬은 백틱(`` ` ``) 기준 문자열 분할로 처리 (숫자 오인식 방지).
- 링크는 `http/https/mailto` 스킴만 허용.
