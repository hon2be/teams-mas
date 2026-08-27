// GitHub Pages 는 서버 리라이트가 없어서 /config 같은 딥링크가 404 가 된다.
// 404.html 을 index.html 사본으로 두면 GitHub Pages 가 그걸 돌려주고 SPA 라우터가 이어받는다.
// .nojekyll 은 _로 시작하는 자산이 Jekyll 에 걸러지지 않게 한다.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const index = join(dist, 'index.html')

if (!existsSync(index)) {
  console.error('dist/index.html 이 없습니다. 먼저 npm run build 를 돌리세요.')
  process.exit(1)
}

copyFileSync(index, join(dist, '404.html'))
writeFileSync(join(dist, '.nojekyll'), '')
console.log('dist/404.html, dist/.nojekyll 생성')
