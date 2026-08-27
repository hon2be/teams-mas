export type PostResult =
  | { ok: true; verified: boolean }
  | { ok: false; reason: string }

/** Power Automate / Logic Apps 가 웹훅 URL을 내보내는 호스트들. */
const WEBHOOK_HOSTS = ['logic.azure.com', 'powerplatform.com', 'azure-apihub.net', 'logic.azure.us']

export const looksLikeWebhookUrl = (url: string): boolean => {
  const trimmed = url.trim()
  if (!trimmed) {
    return false
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') {
      return false
    }
    return WEBHOOK_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    )
  } catch {
    return false
  }
}

/**
 * Power Automate Workflows 웹훅으로 Adaptive Card를 채팅에 게시한다.
 *
 * 브라우저 → Logic Apps 엔드포인트는 CORS 프리플라이트가 막히는 경우가 있어서
 * Content-Type을 text/plain으로 보내 단순 요청으로 만들고, 그래도 막히면
 * no-cors로 한 번 더 던진다. no-cors는 응답을 못 읽으므로 verified=false로 표시한다.
 */
export const postCardToChat = async (
  webhookUrl: string,
  card: Record<string, unknown>,
): Promise<PostResult> => {
  if (!looksLikeWebhookUrl(webhookUrl)) {
    return { ok: false, reason: 'Workflows 웹훅 URL이 아닙니다. 설정에서 다시 확인하세요.' }
  }

  const body = JSON.stringify({
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: card,
      },
    ],
  })

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
    })
    if (!response.ok) {
      return { ok: false, reason: `웹훅이 ${response.status} 를 반환했습니다.` }
    }
    return { ok: true, verified: true }
  } catch {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body,
      })
      return { ok: true, verified: false }
    } catch {
      return { ok: false, reason: '웹훅 호출에 실패했습니다. URL과 네트워크를 확인하세요.' }
    }
  }
}
