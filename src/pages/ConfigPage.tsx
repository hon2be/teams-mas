import { useEffect, useState } from 'react'
import { pages } from '@microsoft/teams-js'
import { useSession } from '../session/sessionContext.ts'
import { errorMessage, useAsync } from '../lib/useAsync.ts'
import { store } from '../services/activeStore.ts'
import { appUrl } from '../lib/router.ts'
import { looksLikeWebhookUrl } from '../services/chatCard.ts'

/**
 * Teams가 채팅/채널에 탭을 추가할 때 띄우는 설정 화면.
 * manifest의 configurableTabs.configurationUrl 이 여기를 가리킨다.
 */
export const ConfigPage = () => {
  const session = useSession()
  const [tabName, setTabName] = useState('회의 조율')
  const [webhook, setWebhook] = useState('')
  const [status, setStatus] = useState('')
  const saved = useAsync(() => store.getWebhookUrl(session.scopeId), [session.scopeId])

  useEffect(() => {
    if (saved.data !== undefined) {
      setWebhook(saved.data)
    }
  }, [saved.data])

  useEffect(() => {
    if (!session.inTeams) {
      return
    }

    pages.config.registerOnSaveHandler((event) => {
      void store
        .setWebhookUrl(session.scopeId, webhook)
        .then(() => {
          pages.config.setConfig({
            entityId: 'mas.home',
            contentUrl: appUrl(),
            websiteUrl: appUrl(),
            suggestedDisplayName: tabName.trim() || '회의 조율',
          })
          event.notifySuccess()
        })
        .catch((cause: unknown) => event.notifyFailure(errorMessage(cause)))
    })
    pages.config.setValidityState(tabName.trim().length > 0)
  }, [session.inTeams, session.scopeId, tabName, webhook])

  const saveWebhookOnly = () => {
    setStatus('')
    void store
      .setWebhookUrl(session.scopeId, webhook)
      .then(() => setStatus('웹훅을 저장했습니다.'))
      .catch((cause: unknown) => setStatus(errorMessage(cause)))
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Tab configuration</p>
          <h1>채팅에 MAS 추가</h1>
          <p className="lede">
            이 탭은 <strong>{session.scopeLabel}</strong> 안에서만 보이는 회의를 관리합니다.
          </p>
        </div>
      </header>

      <div className="form-card">
        <label className="field-label" htmlFor="tab-name">
          탭 이름
        </label>
        <input
          id="tab-name"
          className="text-input"
          value={tabName}
          onChange={(event) => setTabName(event.target.value)}
        />

        <label className="field-label" htmlFor="webhook">
          채팅 카드 게시용 Workflows 웹훅 URL (선택)
        </label>
        <input
          id="webhook"
          className="text-input"
          value={webhook}
          placeholder="https://prod-00.westus.logic.azure.com:443/workflows/..."
          onChange={(event) => setWebhook(event.target.value)}
        />
        <p className="hint">
          Teams 채팅의 <strong>워크플로 → &quot;웹후크 요청을 받으면 채팅에 카드 게시&quot;</strong> 템플릿을 만들고 나온
          URL을 붙여넣으세요. 비워 두면 카드 게시 버튼만 비활성화되고 나머지 기능은 그대로 동작합니다.
        </p>
        {webhook && !looksLikeWebhookUrl(webhook) && (
          <p className="error">Workflows(Power Automate) 웹훅 URL 형식이 아닙니다.</p>
        )}

        {!session.inTeams && (
          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={saveWebhookOnly}>
              웹훅만 저장
            </button>
            <span className="hint">지금은 Teams 밖이라 저장 버튼이 여기서 동작합니다.</span>
          </div>
        )}
        {status && <p className="success">{status}</p>}
        {saved.error && <p className="error">{saved.error}</p>}
      </div>
    </section>
  )
}
