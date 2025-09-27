import {
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommProofEventTypes,
  DidCommProofState,
} from '@credo-ts/didcomm'
import { AgentContext, Constructor } from 'packages/core/src'
import { WorkflowModule } from '..'

describe('WorkflowModule event mapping', () => {
  test('maps credential/proof events to workflow autoAdvance', async () => {
    const module = new WorkflowModule({})
    const handlers: unknown[] = []
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    const service = { autoAdvanceByConnection: jest.fn(async () => {}) }
    const dm = {
      resolve: (ctor: unknown) => {
        const name = (ctor as { name?: string })?.name || ''
        if (name.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
        if (name.includes('FeatureRegistry')) return { register: () => {} }
        if (name.includes('MessageHandlerRegistry'))
          return { registerMessageHandler: (h: Constructor) => handlers.push(h) }
        if (name.includes('EventEmitter'))
          return {
            on: (evt: string, cb: (...args: unknown[]) => void) => {
              listeners[evt] = cb
            },
          }
        if (name.includes('WorkflowService')) return service
        return {}
      },
    }
    await module.initialize({ dependencyManager: dm } as unknown as AgentContext)
    listeners[DidCommCredentialEventTypes.DidCommCredentialStateChanged]?.({
      payload: { credentialExchangeRecord: { connectionId: 'c1', state: DidCommCredentialState.RequestReceived } },
    })
    listeners[DidCommCredentialEventTypes.DidCommCredentialStateChanged]?.({
      payload: { credentialExchangeRecord: { connectionId: 'c1', state: DidCommCredentialState.Done } },
    })
    listeners[DidCommProofEventTypes.ProofStateChanged]?.({
      payload: { proofRecord: { connectionId: 'c2', state: DidCommProofState.PresentationReceived } },
    })
    listeners[DidCommProofEventTypes.ProofStateChanged]?.({
      payload: { proofRecord: { connectionId: 'c2', state: DidCommProofState.Done } },
    })
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c1', 'request_received')
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c1', 'issued_ack')
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c2', 'presentation_received')
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c2', 'verified_ack')
  })

  test('ignores events without connectionId', async () => {
    const module = new WorkflowModule({})
    const handlers: unknown[] = []
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    const service = { autoAdvanceByConnection: jest.fn(async () => {}) }
    const dm = {
      resolve: (ctor: Constructor) => {
        const name = (ctor as { name?: string })?.name || ''
        if (name.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
        if (name.includes('FeatureRegistry')) return { register: () => {} }
        if (name.includes('MessageHandlerRegistry'))
          return { registerMessageHandler: (h: Constructor) => handlers.push(h) }
        if (name.includes('EventEmitter'))
          return {
            on: (evt: string, cb: (...args: unknown[]) => void) => {
              listeners[evt] = cb
            },
          }
        if (name.includes('WorkflowService')) return service
        return {}
      },
    }
    await module.initialize({ dependencyManager: dm } as unknown as AgentContext)
    // Fire events with no connectionId
    listeners[DidCommCredentialEventTypes.DidCommCredentialStateChanged]?.({
      payload: { credentialExchangeRecord: { state: DidCommCredentialState.RequestReceived } },
    })
    listeners[DidCommProofEventTypes.ProofStateChanged]?.({
      payload: { proofRecord: { state: DidCommProofState.PresentationReceived } },
    })
    expect(service.autoAdvanceByConnection).not.toHaveBeenCalled()
  })

  test('no-op for unrelated states (neither mapped branch)', async () => {
    const module = new WorkflowModule({})
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    const service = { autoAdvanceByConnection: jest.fn(async () => {}) }
    const dm = {
      resolve: (ctor: Constructor) => {
        const name = (ctor as { name?: string })?.name || ''
        if (name.includes('AgentConfig')) return { logger: { info() {}, warn() {}, debug() {} } }
        if (name.includes('FeatureRegistry')) return { register: () => {} }
        if (name.includes('MessageHandlerRegistry')) return { registerMessageHandler: () => {} }
        if (name.includes('EventEmitter'))
          return {
            on: (evt: string, cb: (...args: unknown[]) => void) => {
              listeners[evt] = cb
            },
          }
        if (name.includes('WorkflowService')) return service
        return {}
      },
    }
    await module.initialize({ dependencyManager: dm } as unknown as AgentContext)
    listeners[DidCommCredentialEventTypes.DidCommCredentialStateChanged]?.({
      payload: { credentialExchangeRecord: { connectionId: 'c', state: 'offer-sent' } },
    })
    listeners[DidCommProofEventTypes.ProofStateChanged]?.({
      payload: { proofRecord: { connectionId: 'c', state: 'proposal-sent' } },
    })
    expect(service.autoAdvanceByConnection).not.toHaveBeenCalled()
  })
})
