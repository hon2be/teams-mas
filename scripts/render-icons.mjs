// manifest 아이콘 SVG -> PNG. Teams 는 color 192x192, outline 32x32 를 요구한다.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// playwright 는 아이콘을 다시 그릴 때만 쓰는 선택적 도구다.
// 생성된 PNG 는 저장소에 들어 있으므로 평소에는 이 스크립트를 돌릴 일이 없다.
let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('playwright 가 필요합니다: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  { svg: 'color.svg', png: 'color.png', size: 192, background: '#4643D9' },
  { svg: 'outline.svg', png: 'outline.png', size: 32, background: 'transparent' },
]

const browser = await chromium.launch()
for (const target of targets) {
  const svg = readFileSync(join(root, 'manifest', target.svg), 'utf8')
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:${target.background}}svg{display:block}</style>${svg}`,
  )
  const buffer = await page.screenshot({ omitBackground: target.background === 'transparent' })
  writeFileSync(join(root, 'manifest', target.png), buffer)
  await page.close()
  console.log(`${target.png} (${target.size}x${target.size})`)
}
await browser.close()
