import type { BackupSettings } from './store/types'

export interface AppConfig {
  storagePath: string
  apiPort: number
  version: string
  backup: BackupSettings
}

let config: AppConfig | null = null
let onUpdate: ((config: AppConfig) => void) | null = null

export function setConfig(c: AppConfig): void {
  config = c
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error(
      'Config not initialized. Call setConfig() before using the API.',
    )
  }
  return config
}

export function updateConfig(partial: Partial<AppConfig>): void {
  if (!config) {
    throw new Error('Config not initialized.')
  }
  Object.assign(config, partial)
  onUpdate?.(config)
}

export function setOnConfigUpdate(cb: (config: AppConfig) => void): void {
  onUpdate = cb
}
