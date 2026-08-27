import { isAuthConfigured } from '../lib/config.ts'
import { getUserById, searchDirectoryUsers } from '../data/directory.ts'
import type { User } from '../types/models.ts'
import { graph } from './graphClient.ts'

type GraphPerson = {
  id: string
  displayName?: string
  userPrincipalName?: string
  mail?: string
  jobTitle?: string
  scoredEmailAddresses?: { address: string }[]
  personType?: { class?: string }
}

const toUser = (person: GraphPerson): User => ({
  id: person.id,
  displayName: person.displayName ?? '(이름 없음)',
  email: person.mail ?? person.userPrincipalName ?? person.scoredEmailAddresses?.[0]?.address ?? '',
  jobTitle: person.jobTitle ?? '',
})

/**
 * FR-002 참석자 검색 (Microsoft Entra ID).
 * /me/people 로 관련도 높은 사람을 먼저 찾고, 부족하면 /users 로 조직 전체를 훑는다.
 */
export const searchPeople = async (query: string): Promise<User[]> => {
  if (!isAuthConfigured()) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return searchDirectoryUsers(query)
  }

  const term = query.trim()
  const encoded = encodeURIComponent(term)

  const people = await graph<{ value: GraphPerson[] }>(
    term
      ? `/me/people?$search=${encoded}&$top=15&$select=id,displayName,userPrincipalName,jobTitle,scoredEmailAddresses,personType`
      : '/me/people?$top=15&$select=id,displayName,userPrincipalName,jobTitle,scoredEmailAddresses,personType',
    { scopes: ['People.Read'] },
  )

  const users = people.value
    .filter((person) => person.personType?.class !== 'Group')
    .map(toUser)
    .filter((user) => user.email)

  if (users.length >= 5 || !term) {
    return users
  }

  // /me/people 는 최근 협업 이력 위주라 신규 입사자 등이 빠진다. 조직 디렉터리로 보강한다.
  const directory = await graph<{ value: GraphPerson[] }>(
    `/users?$search="displayName:${encoded}" OR "mail:${encoded}"&$top=15&$select=id,displayName,userPrincipalName,mail,jobTitle`,
    { scopes: ['User.Read'], headers: { ConsistencyLevel: 'eventual' } },
  ).catch(() => ({ value: [] as GraphPerson[] }))

  const seen = new Set(users.map((user) => user.id))
  return [...users, ...directory.value.map(toUser).filter((user) => !seen.has(user.id))]
}

/**
 * 로그인한 사용자의 진짜 신원.
 * teams-js context.user 는 클라이언트 값이라 신뢰할 수 없어서, 토큰으로 확인한 /me 를 쓴다.
 */
export const getMe = async (options: { interactive?: boolean } = {}): Promise<User> => {
  const me = await graph<GraphPerson>('/me?$select=id,displayName,userPrincipalName,mail,jobTitle', {
    scopes: ['User.Read'],
    interactive: options.interactive,
  })
  return toUser(me)
}

const userCache = new Map<string, User>()

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size))
  }
  return out
}

const placeholder = (id: string): User => ({ id, displayName: id, email: '', jobTitle: '' })

/**
 * 참석자 id 를 표시용 사용자 정보로 바꾼다.
 * Graph 는 $batch 로 한 번에 20개씩 묶어 부르고, 결과는 세션 내 캐시한다.
 */
export const resolveUsers = async (ids: string[]): Promise<Map<string, User>> => {
  const unique = [...new Set(ids)]

  if (!isAuthConfigured()) {
    return new Map(unique.map((id) => [id, getUserById(id) ?? placeholder(id)]))
  }

  const missing = unique.filter((id) => !userCache.has(id))
  for (const batch of chunk(missing, 20)) {
    const response = await graph<{
      responses: { id: string; status: number; body?: GraphPerson }[]
    }>('/$batch', {
      method: 'POST',
      scopes: ['User.Read'],
      body: {
        requests: batch.map((id, index) => ({
          id: String(index),
          method: 'GET',
          url: `/users/${id}?$select=id,displayName,userPrincipalName,mail,jobTitle`,
        })),
      },
    }).catch(() => ({ responses: [] }))

    for (const item of response.responses) {
      const id = batch[Number(item.id)]
      userCache.set(id, item.status === 200 && item.body ? toUser(item.body) : placeholder(id))
    }
  }

  return new Map(unique.map((id) => [id, userCache.get(id) ?? placeholder(id)]))
}
