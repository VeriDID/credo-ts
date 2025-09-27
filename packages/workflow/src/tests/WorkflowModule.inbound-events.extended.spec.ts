import {
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommProofEventTypes,
  DidCommProofState,
} from '@credo-ts/didcomm'
import { AgentContext } from 'packages/core/src'
import { WorkflowModule } from '..'

describe('WorkflowModule event mapping (Done branches)', () => {
  test('maps Done branches for credentials and proofs', async () => {
    const module = new WorkflowModule({})
    const listeners: Record<string, (...args: unknown[]) => void> = {}
    const service = { autoAdvanceByConnection: jest.fn(async () => {}) }
    const dm = {
      resolve: (ctor: unknown) => {
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
      payload: { credentialExchangeRecord: { connectionId: 'c', state: DidCommCredentialState.Done } },
    })
    listeners[DidCommProofEventTypes.ProofStateChanged]?.({
      payload: { proofRecord: { connectionId: 'c', state: DidCommProofState.Done } },
    })
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c', 'issued_ack')
    expect(service.autoAdvanceByConnection).toHaveBeenCalledWith(expect.anything(), 'c', 'verified_ack')
  })
})
