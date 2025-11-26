/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_NOTIFICATION_WS_URL?: string
  readonly VITE_DOC_CONVERTER_URL?: string
  readonly VITE_MEILISEARCH_URL?: string
  readonly VITE_MINIO_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

