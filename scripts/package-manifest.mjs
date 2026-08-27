// manifest 템플릿에 환경 변수를 채워 Teams 업로드용 zip 을 만든다.
// 사용: node scripts/package-manifest.mjs   (.env.local 을 읽는다)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const loadEnvFile = (path) => {
  if (!existsSync(path)) {
    return {}
  }
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
      }),
  )
}

const env = { ...loadEnvFile(join(root, '.env.local')), ...process.env }

const appOrigin = (env.VITE_APP_ORIGIN ?? '').replace(/\/+$/, '')
const teamsAppId = env.VITE_TEAMS_APP_ID ?? ''
const entraClientId = env.VITE_ENTRA_CLIENT_ID ?? ''

// Entra 없이도 탭 앱은 설치된다(목업 모드). client ID 는 선택 사항으로 둔다.
const missing = Object.entries({
  VITE_APP_ORIGIN: appOrigin,
  VITE_TEAMS_APP_ID: teamsAppId,
})
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missing.length > 0) {
  console.error(`빠진 환경 변수: ${missing.join(', ')}`)
  console.error('.env.local 에 채우거나 환경 변수로 넘기세요. .env.example 참고.')
  process.exit(1)
}

const appHost = new URL(appOrigin).host
// hash 라우팅이면 매니페스트 URL 도 #/ 를 거쳐야 Teams 가 올바른 화면을 연다.
const routePrefix = (env.VITE_ROUTER ?? '').trim() === 'hash' ? '#/' : ''

const template = readFileSync(join(root, 'manifest', 'manifest.template.json'), 'utf8')
const filled = template
  .replaceAll('{{APP_ORIGIN}}', appOrigin)
  .replaceAll('{{APP_HOST}}', appHost)
  .replaceAll('{{TEAMS_APP_ID}}', teamsAppId)
  .replaceAll('{{ENTRA_CLIENT_ID}}', entraClientId)
  .replaceAll('{{ROUTE_PREFIX}}', routePrefix)

const manifest = JSON.parse(filled) // 형식 검증

// webApplicationInfo 는 Entra 앱이 있을 때만 의미가 있다.
// 빈 값으로 남겨두면 Teams 가 매니페스트를 거부하므로 통째로 뺀다.
if (!entraClientId) {
  delete manifest.webApplicationInfo
  console.warn('VITE_ENTRA_CLIENT_ID 가 없어 webApplicationInfo 를 뺐습니다 (목업 모드 패키지).')
}

const outDir = join(root, 'dist-manifest')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

for (const icon of ['color.png', 'outline.png']) {
  const source = join(root, 'manifest', icon)
  if (!existsSync(source)) {
    console.error(`아이콘이 없습니다: manifest/${icon}`)
    console.error('npm run icons 로 생성하세요.')
    process.exit(1)
  }
  copyFileSync(source, join(outDir, icon))
}

const zipPath = join(outDir, 'mas-teams-app.zip')
execFileSync('zip', ['-j', '-q', zipPath, join(outDir, 'manifest.json'), join(outDir, 'color.png'), join(outDir, 'outline.png')])

console.log(`완료: ${zipPath}`)
console.log('Teams → 앱 → 앱 관리 → 앱 업로드 → 사용자 지정 앱 업로드 로 올리세요.')
