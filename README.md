# Meeting Availability Scheduler (MAS)

Teams 탭 앱으로 참석 가능 시간을 모으고, 가중치 기반 슬라이딩 윈도우로 최적 회의 시간 Top 3를 추천합니다. PRD v1.1 기준.

서버가 없습니다. 정적 파일 + Microsoft Graph + SharePoint List 로만 동작합니다.

```text
Teams 클라이언트
   └─ 탭 iframe ← 정적 파일 (CDN/Static Web Apps)
        ├─ teams-js       컨텍스트(누가·어느 채팅)  ※ 신뢰 불가, 힌트용
        ├─ MSAL (NAA)     Entra ID 토큰 발급        ← 인증
        └─ Graph 호출
              ├─ /sites/{id}/lists/...   데이터 저장소
              ├─ /me/people, /users      참석자 검색
              └─ /me/onlineMeetings      Teams 회의 생성
```

## 두 가지 모드

환경 변수가 비어 있으면 **로컬 목업 모드**로 뜹니다 (localStorage + 목 디렉터리). 설정하면 자동으로 실 백엔드로 전환됩니다.

| | 목업 모드 | 실 배포 |
| --- | --- | --- |
| 저장소 | localStorage (브라우저별로 격리, 공유 안 됨) | SharePoint List |
| 신원 | 상단 셀렉트로 수동 전환 | Entra 토큰 기반 `/me` |
| 참석자 검색 | `src/data/directory.ts` 목 데이터 | Graph `/me/people` + `/users` |
| 회의 생성 | 목 URL | Graph `/me/onlineMeetings` |

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:5173` — 설정 없이 목업 모드로 전부 동작합니다.

## 실 배포 설정

### 0. 호스팅 정하기

Teams 탭은 HTTPS 가 필수라 정적 파일을 어딘가에 올려야 합니다. M365 구독에는 웹호스팅이 없습니다.
여기서 정한 주소가 Entra 리디렉션 URI 에 들어가므로 **가장 먼저** 정합니다.

- **GitHub Pages** — 무료. `.github/workflows/deploy.yml` 이 이미 들어 있습니다
- **Cloudflare Pages / Netlify / Vercel** — 무료. 리라이트를 지원해 설정이 더 단순합니다
- **Azure Static Web Apps** — 무료 티어지만 Azure 구독(무료 생성 가능)이 별도로 필요합니다

#### GitHub Pages 로 배포할 때

서버 리라이트가 없어서 두 가지를 맞춰야 합니다.

```bash
VITE_BASE_PATH=/teams-mas/   # 프로젝트 페이지는 저장소명이 서브경로가 된다
VITE_ROUTER=hash             # 리라이트가 없으므로 해시 라우팅
VITE_APP_ORIGIN=https://<계정>.github.io/teams-mas
```

`VITE_ROUTER=hash` 면 모든 화면이 `#/config` 처럼 실제 파일(index.html)로 떨어져 항상 HTTP 200
입니다. history 모드로 두면 딥링크가 404 상태로 응답해 Teams 웹뷰에서 문제가 될 수 있습니다.
`npm run package` 가 매니페스트 URL 에도 `#/` 를 자동으로 넣습니다.

배포 값은 저장소 **Settings → Secrets and variables → Actions → Variables** 에 등록합니다
(공개 식별자라 Secrets 가 아니라 Variables 로 충분합니다).

주의할 점:

- **비공개 저장소의 Pages 는 GitHub Pro/Team 이상**이 필요합니다. 무료 플랜이면 저장소가 공개됩니다.
  소스가 공개돼도 **데이터는 GitHub 에 하나도 안 올라갑니다** — 회의·참석자·가능시간은 전부
  SharePoint 에 있고 브라우저가 Graph 로 직접 부릅니다. 다만 사내 정책은 별도로 확인하세요.
- NAA 리디렉션 URI 는 origin 만 쓰므로 `brk-multihub://<계정>.github.io` 가 됩니다. 서브경로를
  구분하지 않아 그 계정의 다른 Pages 사이트와 도메인을 공유합니다. 거슬리면 저장소명을
  `<계정>.github.io` 로 만들어 루트에 배포하거나 커스텀 도메인을 붙이세요.

### 1. Entra ID 앱 등록

Azure Portal → **App registrations** → New registration.

플랫폼은 **Single-page application (SPA)** 로 잡고, 리디렉션 URI 를 **두 개** 등록합니다.

```text
https://<배포도메인>            ← 일반 SPA 로그인
brk-multihub://<배포도메인>     ← NAA. Teams 가 브로커 역할을 하도록 허용
```

`brk-multihub` 는 origin 만 씁니다. 경로를 붙이면 안 됩니다.

- ✔️ `brk-multihub://mas.contoso.com`
- ❌ `brk-multihub://mas.contoso.com/go`

**API permissions** (전부 Delegated):

| 권한 | 용도 | 관리자 동의 |
| --- | --- | --- |
| `User.Read` | PRD §14. 로그인 사용자 확인 | 불필요 |
| `People.Read` | PRD §14. FR-002 참석자 검색 | 불필요 |
| `Calendars.Read` | PRD §14 | 불필요 |
| `Sites.ReadWrite.All` | §11 SharePoint List 읽기/쓰기 | **필요** |
| `OnlineMeetings.ReadWrite` | FR-008 Teams 회의 생성 | **필요** |

앞의 3개는 사용자 본인이 첫 로그인 때 동의하면 됩니다. 뒤의 2개는 전역 관리자가
**Grant admin consent** 를 눌러야 합니다.

> 클릭 순서까지 담은 설정 가이드는 [`SETUP.md`](SETUP.md) 에 있습니다.
> 관리자에게 전달할 요청 문서는 [`ADMIN-REQUEST.md`](ADMIN-REQUEST.md) 입니다.

### 권한이 부족할 때 — 3단계로 나눠 쓰기

관리자 권한을 못 받아도 아래 단계까지는 바로 됩니다.

| 단계 | 필요한 것 | 되는 것 | 안 되는 것 |
| --- | --- | --- | --- |
| **1. 목업** | 없음 | 탭 설치, 회의 생성/입력/추천/수정/종료, 채팅 카드 게시 | 참석자 간 데이터 공유 |
| **2. 사용자 동의만** | Entra 앱 등록 (관리자 동의 X) | + 실제 조직 사용자 검색, 신원 확인 | 공유 저장소, 회의 자동 생성 |
| **3. 전체** | + 관리자 동의 2개 | 전부 | — |

1단계에서도 **Workflows 웹훅 카드 게시는 그대로 동작합니다.** Power Automate 플로우는
사용자 수준이라 관리자 승인이 필요 없습니다.

2단계로 가려면 `.env.local` 에 `VITE_ENTRA_CLIENT_ID` / `VITE_ENTRA_TENANT_ID` 만 채우고
SharePoint 두 값은 비워 둡니다. 그러면 저장소는 localStorage 로 남고 나머지만 실 API 를 씁니다.

Entra 앱 등록 자체는 기본 설정에서 **일반 사용자도 가능합니다**
(Entra → 사용자 설정 → *사용자가 애플리케이션을 등록할 수 있음*). 이게 꺼져 있으면 관리자에게 요청해야 합니다.

> NAA 라서 예전 Teams SSO 처럼 *Expose an API* · 커스텀 scope 정의 · Teams 클라이언트 ID 사전 승인을 할 필요가 없습니다.

### 2. SharePoint 사이트

리스트를 담을 사이트 하나만 만들면 됩니다. 주소의 `/sites/<이름>` 부분이 `VITE_SHAREPOINT_SITE_PATH` 입니다.
호스트명은 앱이 Graph 로 자동 조회하므로 적을 필요가 없습니다. **리스트 4개는 앱이 첫 실행 때 자동 생성합니다**
(`MAS_Meetings`, `MAS_Participants`, `MAS_Availabilities`, `MAS_Settings` — 스키마는 `src/services/sharepointSchema.ts`).

### 3. 환경 변수

`.env.example` 을 `.env.local` 로 복사해 채웁니다.

```bash
VITE_ENTRA_CLIENT_ID=<앱 등록의 Application (client) ID>
VITE_ENTRA_TENANT_ID=<디렉터리(테넌트) ID>
VITE_TEAMS_APP_ID=<Teams 앱용 GUID. 아무 GUID나 새로 생성>
VITE_SHAREPOINT_HOSTNAME=            # 비워두면 Graph 로 자동 조회
VITE_SHAREPOINT_SITE_PATH=/sites/MAS
VITE_APP_ORIGIN=https://mas.contoso.com
```

`VITE_SHAREPOINT_HOSTNAME` 은 보통 비워둡니다. 앱이 Graph `/sites/root` 로
테넌트의 SharePoint 호스트명을 알아냅니다. 멀티 지오 테넌트처럼 루트와 다른 호스트를
써야 할 때만 직접 지정하세요.

`VITE_ENTRA_TENANT_ID` 는 **Azure Portal 앱 등록 개요에 적힌 Directory (tenant) ID** 를 그대로 붙여넣는 고정값입니다. 런타임에 알아서 받아오지 않습니다. 사내 단일 테넌트면 그 GUID를, 여러 조직에 배포하려면 `organizations` 를 씁니다.

`VITE_TEAMS_APP_ID` 와 `VITE_ENTRA_CLIENT_ID` 는 **서로 다른 값**입니다. 전자는 Teams 앱 패키지 식별자, 후자는 Entra 앱 등록 ID 입니다.

### 4. 패키징 & 업로드

```bash
npm run package     # 빌드 + dist-manifest/mas-teams-app.zip
```

`VITE_ENTRA_CLIENT_ID` 가 비어 있으면 `webApplicationInfo` 를 빼고 패키징합니다.
**Entra 앱 없이도 탭 설치는 됩니다** (위 1단계). 필요한 값은 `VITE_APP_ORIGIN` 과
`VITE_TEAMS_APP_ID` 둘뿐입니다.

Teams → **앱** → **앱 관리** → **앱 업로드** → **사용자 지정 앱 업로드** 로 zip 을 올립니다.

이 메뉴가 안 보이면 테넌트에서 사이드로딩이 꺼진 것입니다. Teams 관리 센터 → 앱 설정 정책 → **사용자 지정 앱 업로드** 를 켜야 합니다 (관리자 권한 필요).

아이콘을 바꾸려면 `manifest/*.svg` 를 고치고:

```bash
npm i -D playwright && npx playwright install chromium
npm run icons
```

## Teams 연동 형태

### 개인 탭

`staticTabs`. 모든 회의를 보여줍니다.

### 채팅 / 채널 탭

`configurableTabs` (scope `groupChat`, `team`).

```text
채팅 → + → MAS → 설정 화면(/config) → 탭 이름 + 웹훅 URL → 저장
```

`app.getContext()` 의 `chat.id` / `channel.id` 로 **scopeId** 를 잡아, 그 채팅에서 만든 회의만 목록에 나옵니다. **채팅 하나에 회의는 몇 개든** 병행해서 돌릴 수 있습니다.

### 채팅 카드 게시

Teams 채팅의 **워크플로(Power Automate) → "웹후크 요청을 받으면 채팅에 카드 게시"** 템플릿으로 웹훅 URL을 만들고 `/config` 에 넣으면, 회의 화면의 **카드 게시** 버튼이 채팅에 Adaptive Card를 올립니다. 카드에는 응답 현황·추천 Top 3·탭 딥링크가 들어갑니다.

> **카드 안에서 시간을 직접 입력받는 건 불가능합니다.** `Action.Execute` 로 카드를 갱신하려면 Azure Bot 등록과 상시 엔드포인트가 필요해서 서버리스 구조를 벗어납니다. 그래서 카드는 "현황 + 열기 버튼"이고, 실제 입력은 탭에서 받습니다.
>
> 웹훅은 **URL 자체가 비밀번호**입니다. 인증이 없으므로 URL이 유출되면 누구나 그 채팅에 카드를 올릴 수 있습니다.

## 제약

- 회의 생성 범위: 오늘 기준 -1개월 ~ +1개월
- 슬롯: 10분, 기본/최소 30분, 최대 480분
- 근무 시간 그리드: 09:00–18:00

## 추천 알고리즘

가중치(Organizer 1000, Required 100, Optional 10) 합과 다음 우선순위로 정렬합니다.

1. Organizer 참석
2. Required 참석률
3. Optional 참석 수
4. 연속 가능 길이
5. 이른 시작 시간

겹치는 윈도우는 건너뛰고 Top 3를 반환합니다.

## 생명주기

앱 로드 시 Daily Cleanup을 적용합니다.

- `MeetingDate < Today` → COMPLETED (Organizer가 **회의 종료**로 즉시 전환도 가능)
- +60일 → ARCHIVED
- +90일 → DELETED (Meeting / Participant / Availability 삭제)

권장 운영 시각은 02:00입니다. 브라우저가 안 열려도 돌아가게 하려면 같은 규칙을 Power Automate 스케줄 플로우로 옮기면 됩니다.

## 알려진 한계

- **시차(Timezone) 미지원.** 모든 시간을 클라이언트 로컬 시간대로 다룹니다. PRD Roadmap v2.0 항목입니다.
- 날짜는 회의당 하루(후보 날짜 1개)만 다룹니다.
- Daily Cleanup 이 클라이언트에서 돌아서, 아무도 앱을 열지 않으면 상태 전환이 지연됩니다.
