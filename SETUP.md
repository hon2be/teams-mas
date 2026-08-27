# 설정 순서

앱 소유자(요청자)가 직접 하는 작업입니다.

**Entra 접근 권한이 없다면 1~2번은 관리자가 해야 합니다.**
그 경우 로컬의 `ADMIN-REQUEST.md` 를 전달하세요. 그 문서 하나로 끝나도록 되어 있습니다.
(조직 식별 정보가 들어 있어 저장소에는 포함하지 않습니다.)

---

## 1. Entra 리디렉션 URI 등록 — 안 하면 로그인이 실패합니다

### 왜 필요한가

로그인이 끝나면 Entra가 인증 결과를 앱으로 돌려보냅니다. 이때 **"어느 주소로 보낼지"를
미리 등록해 둔 것과 한 글자라도 다르면 거부**합니다. 아무 데나 결과를 보내면
토큰을 가로챌 수 있어서 그렇습니다.

등록이 안 되어 있으면 이런 오류가 납니다.

```text
AADSTS50011: The redirect URI specified in the request
             does not match the redirect URIs configured
```

### 클릭 순서

```text
1. https://entra.microsoft.com 접속
2. 왼쪽 메뉴 → 애플리케이션 → 앱 등록
3. 목록에서 MAS 클릭
4. 왼쪽 메뉴 → 인증 (Authentication)
5. "플랫폼 추가" → 단일 페이지 애플리케이션 (SPA)
      ※ "웹" 이 아니라 반드시 SPA 를 고를 것
6. 아래 URI 를 하나씩 추가 → 저장
```

### 위 경로에서 401 이 뜬다면 — 직접 링크로 우회

일반 사용자는 **앱 등록 목록을 조회할 권한이 없는 경우**가 많습니다.
`portal.azure.com` 은 구독이 없으면 아예 막히고, 목록 화면은 디렉터리 읽기 권한을 요구합니다.

```text
액세스 권한이 없습니다 / 401 / 권한이 부족하여 작업을 완료할 수 없습니다
리소스 그룹 이름 · 구독 ID · 리소스 ID  ← 이런 항목이 보이면 잘못된 화면입니다
```

**목록을 못 봐도 자기가 만든 앱은 직접 열 수 있습니다.**
아래 주소의 `<CLIENT_ID>` 를 본인 클라이언트 ID로 바꿔 접속하세요.

| 목적 | 주소 |
| --- | --- |
| 인증 (리디렉션 URI) | `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/<CLIENT_ID>` |
| API 권한 | `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/<CLIENT_ID>` |
| 개요 (ID 확인) | `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/<CLIENT_ID>` |
| 새 앱 등록 | `https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade/isMSAApp~/false` |

클라이언트 ID는 `.env.local` 의 `VITE_ENTRA_CLIENT_ID` 값입니다.

> 앱 **소유자** 는 목록 조회 권한이 없어도 자기 앱의 설정을 열고 수정할 수 있습니다.
> 앱을 직접 등록했다면 자동으로 소유자입니다.

### 그래도 401 이 뜬다면

앱 소유자가 아니거나 디렉터리 정책이 더 엄격한 경우입니다. 관리자에게 아래를 요청하세요.

```text
Entra 앱 등록 "MAS" (클라이언트 ID: ______) 의 인증 탭에
SPA 플랫폼으로 아래 리디렉션 URI 3개를 추가해 주세요.

  brk-multihub://hon2be.github.io
  https://hon2be.github.io/teams-mas/blank.html
  http://localhost:5173/blank.html
```

### 등록할 URI — 3개

```text
brk-multihub://hon2be.github.io
https://hon2be.github.io/teams-mas/blank.html
http://localhost:5173/blank.html
```

| URI | 언제 쓰이나 | 생략하면 |
| --- | --- | --- |
| `brk-multihub://hon2be.github.io` | **Teams 안에서 실행할 때** | Teams 탭에서 로그인 불가 |
| `https://hon2be.github.io/teams-mas/blank.html` | 브라우저로 직접 접속할 때 | 배포본 브라우저 테스트 불가 |
| `http://localhost:5173/blank.html` | 로컬 개발 (`npm run dev`) | 로컬 테스트 불가 |

실사용은 Teams 안이므로 **첫 번째가 가장 중요**합니다.

### 자주 틀리는 것

| ❌ 틀림 | ✅ 맞음 | 이유 |
| --- | --- | --- |
| `brk-multihub://hon2be.github.io/teams-mas` | `brk-multihub://hon2be.github.io` | 경로를 붙이면 안 됨. 도메인(origin)만 |
| `https://hon2be.github.io/teams-mas` | `https://hon2be.github.io/teams-mas/blank.html` | 앱이 보내는 값과 정확히 일치해야 함 |
| 플랫폼 "웹(Web)" 으로 추가 | 플랫폼 "SPA" 로 추가 | SPA 가 아니면 토큰 발급 방식이 달라 실패 |

> `brk-multihub` 는 "이 앱은 Microsoft 365 호스트(Teams, Outlook 등)가 대신 인증해도 된다"는
> 표시입니다. 이게 있어야 Teams 안에서 재로그인 없이 바로 인증됩니다.
> 도메인 단위로 동작하기 때문에 경로를 붙이면 인식하지 못합니다.

---

## 2. API 권한 추가

같은 앱의 **API 권한** 탭에서 **권한 추가 → Microsoft Graph → 위임된 권한** 으로 5개를 넣습니다.

```text
User.Read
People.Read
Calendars.Read
Sites.ReadWrite.All        ← 관리자 동의 필요
OnlineMeetings.ReadWrite   ← 관리자 동의 필요
```

뒤의 2개는 "관리자 동의 필요" 상태로 남습니다. **그대로 두세요.**
그 목록이 관리자에게 보여줄 근거가 됩니다.

앞의 3개는 본인이 첫 로그인할 때 동의 창에서 승인하면 끝입니다.

---

## 3. 환경 변수

`.env.local` 에 채웁니다. 이 파일은 git에 올라가지 않습니다.

```bash
VITE_ENTRA_CLIENT_ID=<앱 등록 개요의 "애플리케이션(클라이언트) ID">
VITE_TEAMS_APP_ID=<이미 생성되어 있음>
VITE_APP_ORIGIN=https://hon2be.github.io/teams-mas
VITE_BASE_PATH=/teams-mas/
VITE_ROUTER=hash
```

비워두는 것 (런타임에 자동 조회):

```bash
VITE_ENTRA_TENANT_ID=        # Teams 컨텍스트에서 가져옴
VITE_SHAREPOINT_HOSTNAME=    # Graph /sites/root 에서 가져옴
VITE_SHAREPOINT_SITE_PATH=   # 팀 채널 탭이면 팀 사이트 자동 선택
```

---

## 4. 배포

`main` 에 push 하면 GitHub Actions가 자동 배포합니다.

```text
https://hon2be.github.io/teams-mas/
```

수동 실행: 저장소 → Actions → Deploy to GitHub Pages → Run workflow

---

## 5. Teams 앱 패키지 만들기 · 올리기

```bash
npm run package
```

`dist-manifest/mas-teams-app.zip` 이 만들어집니다.

```text
Teams → 앱 → 앱 관리 → 앱 업로드 → 사용자 지정 앱 업로드
→ mas-teams-app.zip 선택
```

그다음 대상 채널에서:

```text
채널 상단 + → MAS 검색 → 추가 → 설정 화면에서 탭 이름 확인 → 저장
```

> SharePoint 앱 아래에서 찾지 마세요. MAS는 별도 앱으로 목록에 나옵니다.

---

## 6. 동작 확인 순서

| 확인 | 되면 | 안 되면 |
| --- | --- | --- |
| 탭이 열리고 "회의 조율" 이 보임 | 배포 정상 | `VITE_APP_ORIGIN`, `VITE_BASE_PATH` 확인 |
| 상단 로그인 버튼 → 성공 | 리디렉션 URI 정상 | 1번 항목 다시 확인 |
| 참석자 검색에 실제 이름이 나옴 | Graph 연결 정상 | API 권한 확인 |
| 다른 사람이 입력한 시간이 보임 | **관리자 동의 완료** | `ADMIN-REQUEST.md` 전달 |

마지막 항목만 관리자 승인이 필요합니다. 나머지는 직접 해결 가능합니다.

---

## 부록 · 채팅 탭에서도 쓰려면

팀 채널이 아닌 **그룹 채팅**에 붙이는 경우, 채팅에는 딸린 SharePoint 사이트가 없습니다.
`.env.local` 에 저장할 사이트를 지정해야 합니다.

```bash
VITE_SHAREPOINT_SITE_PATH=/sites/<사이트이름>
```

전체 URL이 아니라 **`/sites/...` 경로만** 넣습니다.
회의는 채팅별로 격리되므로 여러 채팅이 한 사이트를 공유해도 섞이지 않습니다.
