/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENTRA_CLIENT_ID?: string
  readonly VITE_ENTRA_TENANT_ID?: string
  readonly VITE_TEAMS_APP_ID?: string
  readonly VITE_SHAREPOINT_HOSTNAME?: string
  readonly VITE_SHAREPOINT_SITE_PATH?: string
  readonly VITE_BASE_PATH?: string
  readonly VITE_ROUTER?: 'history' | 'hash'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
