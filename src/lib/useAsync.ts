import { useEffect, useRef, useState } from 'react'

export type AsyncState<T> = {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

type Snapshot<T> = { data: T | undefined; loading: boolean; error: string | null }

/**
 * 비동기 저장소 호출을 화면에 붙일 때 쓰는 최소 훅.
 *
 * run 은 매 렌더 새로 만들어지므로 ref 로 최신 것만 들고, 재실행 여부는
 * 호출부가 넘긴 deps 를 직렬화한 키로 판단한다.
 */
export const useAsync = <T>(run: () => Promise<T>, deps: unknown[]): AsyncState<T> => {
  const runRef = useRef(run)
  runRef.current = run

  const [state, setState] = useState<Snapshot<T>>({ data: undefined, loading: true, error: null })
  const [nonce, setNonce] = useState(0)
  const key = JSON.stringify(deps)

  useEffect(() => {
    let cancelled = false
    setState((current) => ({ ...current, loading: true, error: null }))

    runRef
      .current()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState({ data: undefined, loading: false, error: errorMessage(cause) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key, nonce])

  return { ...state, reload: () => setNonce((value) => value + 1) }
}
