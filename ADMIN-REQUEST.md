# MAS — Entra 앱 권한 요청

Teams 채널 탭 앱입니다. **신규 서버·DB·Azure 구독·추가 라이선스가 없습니다.**

> **데이터는 전부 사내 SharePoint 에 저장됩니다.**
> 외부(GitHub Pages)에 올라간 것은 **HTML/JS 파일뿐이며, 회의 데이터는 단 한 건도 저장되지 않습니다.**
> 브라우저가 사내 SharePoint 를 직접 호출하는 구조라, 중간에 데이터가 머무는 지점이 없습니다.

## 요청 사항

1. **앱 등록** — 이름 `MAS`, 지원 계정 유형 *이 조직 디렉터리의 계정만*
2. **인증 → 플랫폼 추가 → 단일 페이지 애플리케이션(SPA)** 에 리디렉션 URI 3개
   ```
   brk-multihub://hon2be.github.io
   https://hon2be.github.io/teams-mas/blank.html
   http://localhost:5173/blank.html
   ```
3. **API 권한 → Microsoft Graph → 위임된(Delegated)** 5개 추가
   `User.Read` · `People.Read` · `Calendars.Read` · `Sites.ReadWrite.All` · `OnlineMeetings.ReadWrite`
4. **관리자 동의 허용** 클릭

## 참고

- 전부 **위임된** 권한입니다. 로그인 사용자가 이미 접근 가능한 범위를 넘지 않으며, **응용 프로그램(Application) 권한은 없습니다.**
- **클라이언트 시크릿·인증서는 발급하지 마세요.** SPA 라 사용이 불가능합니다.
- 요청자가 이미 등록한 앱이 있습니다. 새로 만들지 마시고 그 앱에 2~4번만 적용해 주세요.
  - 클라이언트 ID: _______________________  ← 요청자가 전달 (공개 저장소라 여기 적지 않음)
- 동의는 언제든 회수 가능합니다 (엔터프라이즈 애플리케이션 → MAS → 삭제).
- 소스 코드: <https://github.com/hon2be/teams-mas>
