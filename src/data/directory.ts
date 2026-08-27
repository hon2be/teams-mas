import type { User } from '../types/models.ts'

export const CURRENT_USER_ID = 'user001'

/**
 * 목업 모드용 가상 디렉터리.
 * 실 배포에서는 Microsoft Graph(/me/people, /users)가 이 자리를 대신한다.
 */
export const DIRECTORY_USERS: User[] = [
  {
    id: 'user001',
    displayName: '김하늘',
    email: 'haneul.kim@example.com',
    jobTitle: 'Organizer',
  },
  {
    id: 'user002',
    displayName: '이도윤',
    email: 'doyun.lee@example.com',
    jobTitle: 'Architect',
  },
  {
    id: 'user003',
    displayName: '박서연',
    email: 'seoyeon.park@example.com',
    jobTitle: 'Frontend',
  },
  {
    id: 'user004',
    displayName: '최지우',
    email: 'jiwoo.choi@example.com',
    jobTitle: 'Backend',
  },
  {
    id: 'user005',
    displayName: '정민준',
    email: 'minjun.jung@example.com',
    jobTitle: 'QA',
  },
  {
    id: 'user006',
    displayName: '강수아',
    email: 'sua.kang@example.com',
    jobTitle: 'PM',
  },
  {
    id: 'user007',
    displayName: '윤태호',
    email: 'taeho.yoon@example.com',
    jobTitle: 'DevOps',
  },
  {
    id: 'user008',
    displayName: '한예린',
    email: 'yerin.han@example.com',
    jobTitle: 'Designer',
  },
]

export const searchDirectoryUsers = (query: string): User[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return DIRECTORY_USERS
  }

  return DIRECTORY_USERS.filter((user) => {
    const haystack = `${user.displayName} ${user.email} ${user.jobTitle}`.toLowerCase()
    return haystack.includes(normalized)
  })
}

export const getUserById = (userId: string): User | undefined =>
  DIRECTORY_USERS.find((user) => user.id === userId)
