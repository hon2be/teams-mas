import { STORAGE_SITE_NAME, STORAGE_SITE_URL } from '../lib/config.ts'
import { useSession } from '../session/sessionContext.ts'

/**
 * 채팅 탭에서 공용 저장소를 쓸 때 뜨는 안내.
 *
 * 채팅에는 딸린 SharePoint 사이트가 없어 지정한 팀 사이트에 저장하는데,
 * 그 팀에 가입하지 않은 참석자는 시간을 입력할 수 없다.
 * 오류를 만난 뒤에 알게 되면 늦으므로 미리 알린다.
 */
export const ChatStorageNotice = () => {
  const session = useSession()
  const isChat = Boolean(session.scopeId?.startsWith('chat:'))

  if (!isChat || !STORAGE_SITE_NAME) {
    return null
  }

  return (
    <div className="banner banner-info">
      <p>
        <strong>{STORAGE_SITE_NAME}</strong> 팀에 가입해야 입력한 시간이 서로에게 공유됩니다.
      </p>
      <p className="hint">
        이 채팅의 일정은 <strong>{STORAGE_SITE_NAME}</strong> 팀에 저장됩니다. 가입하지 않으면
        내가 입력한 시간이 내 화면에만 남고, 다른 참석자의 시간도 보이지 않습니다.
      </p>
      <p className="hint">
        가입: 왼쪽 <strong>팀</strong> → <strong>팀 참가 또는 만들기</strong> →{' '}
        <strong>{STORAGE_SITE_NAME}</strong> 검색 → 참가.
        공개 팀이면 승인 없이 바로 참가됩니다.
      </p>
      {STORAGE_SITE_URL && (
        <p className="hint">
          저장 위치:{' '}
          <a href={STORAGE_SITE_URL} target="_blank" rel="noreferrer">
            {STORAGE_SITE_URL}
          </a>
        </p>
      )}
      <p className="hint">팀 채널에서 사용하는 경우에는 가입이 필요 없습니다.</p>
    </div>
  )
}
