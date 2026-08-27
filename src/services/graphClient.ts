import { GRAPH_BASE } from '../lib/config.ts'
import { getGraphToken } from './auth.ts'

export class GraphError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'GraphError'
    this.status = status
    this.code = code
  }
}

type GraphRequest = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** SharePoint 비인덱스 컬럼 필터를 허용하는 헤더 등 */
  headers?: Record<string, string>
  scopes?: string[]
  /** 기본 false. 토큰이 없으면 팝업 대신 SignInRequiredError 를 던진다. */
  interactive?: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Graph 호출. 429/503 은 Retry-After 를 존중해 최대 3회 재시도한다. */
export const graph = async <T>(path: string, request: GraphRequest = {}): Promise<T> => {
  const { method = 'GET', body, headers = {}, scopes, interactive } = request
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`

  for (let attempt = 0; ; attempt += 1) {
    const token = await getGraphToken(scopes, undefined, { interactive })
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (response.status === 204) {
      return undefined as T
    }
    if (response.ok) {
      return (await response.json()) as T
    }
    if ((response.status === 429 || response.status === 503) && attempt < 3) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? '1')
      await sleep(Math.min(retryAfter, 10) * 1000)
      continue
    }

    const text = await response.text()
    let code = 'unknown'
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } }
      code = parsed.error?.code ?? code
      message = parsed.error?.message ?? message
    } catch {
      /* Graph 가 JSON 이 아닌 본문을 준 경우 그대로 쓴다 */
    }
    throw new GraphError(response.status, code, message)
  }
}

/** @odata.nextLink 를 따라가며 전체를 모은다. */
export const graphAll = async <T>(path: string, request: GraphRequest = {}): Promise<T[]> => {
  const items: T[] = []
  let next: string | undefined = path
  while (next) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await graph(next, request)
    items.push(...page.value)
    next = page['@odata.nextLink']
  }
  return items
}
