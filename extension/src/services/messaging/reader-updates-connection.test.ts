import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeToReaderUpdates } from './reader-updates-connection'

interface FakePort {
  disconnect: ReturnType<typeof vi.fn>
  emitDisconnect: () => void
  messageListener: (message: unknown) => void
}

function createPort(): FakePort & chrome.runtime.Port {
  let disconnectListener: () => void = () => undefined
  let messageListener: (message: unknown) => void = () => undefined
  const fakePort = {
    disconnect: vi.fn(),
    emitDisconnect: () => disconnectListener(),
    get messageListener() {
      return messageListener
    },
    onDisconnect: {
      addListener: vi.fn((listener: () => void) => {
        disconnectListener = listener
      }),
      removeListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void) => {
        messageListener = listener
      }),
      removeListener: vi.fn(),
    },
  }
  return fakePort as unknown as FakePort & chrome.runtime.Port
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('reader update connection', () => {
  it('reconnects after a disconnected runtime port', () => {
    vi.useFakeTimers()
    const ports = [createPort(), createPort()]
    const connect = vi.fn().mockReturnValueOnce(ports[0]).mockReturnValueOnce(ports[1])
    vi.stubGlobal('chrome', { runtime: { connect } })
    const onMessage = vi.fn()
    const unsubscribe = subscribeToReaderUpdates(onMessage, 100)

    ports[0]!.emitDisconnect()
    vi.advanceTimersByTime(99)
    expect(connect).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(connect).toHaveBeenCalledTimes(2)

    ports[1]!.messageListener({ type: 'update' })
    expect(onMessage).toHaveBeenCalledWith({ type: 'update' })
    unsubscribe()
    expect(ports[1]!.disconnect).toHaveBeenCalledOnce()
  })

  it('does not reconnect after unsubscribe', () => {
    vi.useFakeTimers()
    const port = createPort()
    const connect = vi.fn().mockReturnValue(port)
    vi.stubGlobal('chrome', { runtime: { connect } })
    const unsubscribe = subscribeToReaderUpdates(vi.fn(), 100)

    port.emitDisconnect()
    unsubscribe()
    vi.advanceTimersByTime(100)

    expect(connect).toHaveBeenCalledOnce()
  })
})
