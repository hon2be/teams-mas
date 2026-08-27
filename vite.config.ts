import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// GitHub Pages 프로젝트 페이지처럼 서브경로에 배포할 때 VITE_BASE_PATH 를 준다.
// 예: /teams-mas/  (루트 배포면 비워 두면 된다)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const base = env.VITE_BASE_PATH?.trim() || '/'
  return {
    base: base.endsWith('/') ? base : `${base}/`,
    plugins: [react()],
  }
})
