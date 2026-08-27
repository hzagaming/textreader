import { READER_UPDATES_PORT } from './protocol'

export function subscribeToReaderUpdates(
  onMessage: (message: unknown) => void,
  reconnectDelay = 250,
  onReconnect?: () => void,
): () => void {
  let port: chrome.runtime.Port | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let connectionAttempted = false

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      connect()
    }, reconnectDelay)
  }

  const handleDisconnect = () => {
    port?.onMessage.removeListener(onMessage)
    port?.onDisconnect.removeListener(handleDisconnect)
    port = undefined
    scheduleReconnect()
  }

  const connect = () => {
    if (stopped) return
    const reconnecting = connectionAttempted
    connectionAttempted = true
    try {
      port = chrome.runtime.connect({ name: READER_UPDATES_PORT })
      port.onMessage.addListener(onMessage)
      port.onDisconnect.addListener(handleDisconnect)
      if (reconnecting) onReconnect?.()
    } catch {
      port = undefined
      scheduleReconnect()
    }
  }

  connect()

  return () => {
    stopped = true
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
    port?.onMessage.removeListener(onMessage)
    port?.onDisconnect.removeListener(handleDisconnect)
    port?.disconnect()
    port = undefined
  }
}
