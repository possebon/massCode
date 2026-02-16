export function useEnvironment() {
  const isElectron
    = typeof window !== 'undefined' && !!(window as any).electron
  const isWeb = !isElectron

  return { isElectron, isWeb }
}
