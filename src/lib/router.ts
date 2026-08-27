/**
 * 라우팅 모드.
 *
 * history: 서버가 모든 경로를 index.html 로 리라이트해 줄 때 (Cloudflare/Netlify/Vercel/SWA).
 * hash:    리라이트가 없는 정적 호스팅 (GitHub Pages). 모든 URL 이 실제 파일인 index.html 로
 *          떨어져 항상 200 이라 Teams 웹뷰에서 안전하다.
 */
export const ROUTER_MODE: 'history' | 'hash' =
  (import.meta.env.VITE_ROUTER ?? '').trim() === 'hash' ? 'hash' : 'history'

const BASE = import.meta.env.BASE_URL

/** 서브경로·해시 모드를 모두 반영한 앱 내부 절대 URL. */
export const appUrl = (path = ''): string => {
  const clean = path.replace(/^\/+/, '')
  const tail = ROUTER_MODE === 'hash' ? `#/${clean}` : clean
  return new URL(`${BASE}${tail}`.replace(/([^:])\/{2,}/g, '$1/'), window.location.origin).toString()
}
