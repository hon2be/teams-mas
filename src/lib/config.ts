/**
 * 배포 환경 설정. 전부 비어 있으면 앱은 로컬 목업 모드로 동작한다.
 * .env.local 또는 호스팅 환경 변수로 주입한다.
 */
const read = (value: string | undefined): string => (value ?? '').trim()

export const ENTRA_CLIENT_ID = read(import.meta.env.VITE_ENTRA_CLIENT_ID)
/** 비워두면 Teams 컨텍스트의 테넌트를, 그것도 없으면 organizations 를 쓴다. */
export const ENTRA_TENANT_ID = read(import.meta.env.VITE_ENTRA_TENANT_ID)
export const TEAMS_APP_ID = read(import.meta.env.VITE_TEAMS_APP_ID) || '00000000-0000-0000-0000-00000000aa01'

/**
 * 예: contoso.sharepoint.com
 * 비워두면 Graph /sites/root 로 자동 조회한다.
 */
export const SHAREPOINT_HOSTNAME = read(import.meta.env.VITE_SHAREPOINT_HOSTNAME)
/** 예: /sites/MAS — 어느 사이트를 쓸지는 지정해야 한다. */
export const SHAREPOINT_SITE_PATH = read(import.meta.env.VITE_SHAREPOINT_SITE_PATH)

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * 로그인 시 요청하는 최소 권한. 전부 사용자 본인이 동의할 수 있어 관리자가 필요 없다.
 *
 * 관리자 동의가 필요한 권한을 여기 섞으면 로그인 요청 전체가 거부된다.
 * (AADSTS65001) 그래서 나머지는 실제로 쓸 때 따로 요청한다 — 증분 동의.
 */
export const BASE_SCOPES = ['User.Read', 'People.Read', 'Calendars.Read']

/** SharePoint 저장소용. 관리자 동의 필요. */
export const SITES_SCOPES = ['Sites.ReadWrite.All']

/** Teams 회의 생성용. 관리자 동의 필요. */
export const ONLINE_MEETINGS_SCOPES = ['OnlineMeetings.ReadWrite']

/** 문서·매니페스트용 전체 목록. */
export const GRAPH_SCOPES = [...BASE_SCOPES, ...SITES_SCOPES, ...ONLINE_MEETINGS_SCOPES]

export const isAuthConfigured = (): boolean => ENTRA_CLIENT_ID.length > 0
