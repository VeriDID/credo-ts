import { IssueCredentialV2Action, PresentProofV2Action } from '..'

const makeAgentContext = (mocks: any) => ({
  dependencyManager: {
    resolve: (ctor: any) => {
      const name = ctor?.name || ''
      if (name.includes('CredentialsApi')) return mocks.credentials
      if (name.includes('ProofsApi')) return mocks.proofs
      if (name.includes('ConnectionService')) return mocks.connections
      return {}
    },
  },
})

const baseInstance = {
  instance_id: 'i1',
  template_id: 't1',
  template_version: '1.0.0',
  connection_id: 'conn1',
  participants: { holder: { did: 'did:example:holder' } },
  state: 's',
  section: 'Main',
  context: {},
  artifacts: {},
  status: 'active' as const,
  history: [],
}

describe('Action handlers message id retrieval', () => {
  test('IssueCredentialV2Action uses findOfferMessage id and falls back', async () => {
    const action = new IssueCredentialV2Action()
    const template: any = {
      template_id: 't1',
      version: '1.0.0',
      title: 'T',
      catalog: {
        credential_profiles: {
          test: {
            cred_def_id: 'CREDDEF',
            attribute_plan: { name: { source: 'static', value: 'Alice' } },
            to_ref: 'holder',
            options: {},
          },
        },
      },
    }
    const actionDef: any = {
      key: 'offer',
      typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential',
      profile_ref: 'cp.test',
    }
    // Primary path: findOfferMessage returns message with id
    const credsMock1 = {
      offerCredential: jest.fn(async () => ({ id: 'rec-1' })),
      findOfferMessage: jest.fn(async (_id: string) => ({ message: { id: 'msg-1' } })),
    }
    const connections = { getById: jest.fn(async () => ({ theirDid: 'did:example:holder' })) }
    const ctx1 = {
      agentContext: makeAgentContext({ credentials: credsMock1, connections }),
      template,
      instance: baseInstance,
      action: actionDef,
    }
    const res1 = await action.execute(ctx1 as any)
    expect(res1.messageId).toBe('msg-1')
    expect(res1.artifacts?.issueRecordId).toBe('rec-1')
    // Fallback: findOfferMessage throws → use record id
    const credsMock2 = {
      offerCredential: jest.fn(async () => ({ id: 'rec-2' })),
      findOfferMessage: jest.fn(async (_id: string) => {
        throw new Error('not found')
      }),
    }
    const ctx2 = {
      agentContext: makeAgentContext({ credentials: credsMock2, connections }),
      template,
      instance: baseInstance,
      action: actionDef,
    }
    const res2 = await action.execute(ctx2 as any)
    expect(res2.messageId).toBe('rec-2')
  })

  test('PresentProofV2Action uses findRequestMessage id and falls back', async () => {
    const action = new PresentProofV2Action()
    const template: any = {
      template_id: 't1',
      version: '1.0.0',
      title: 'T',
      catalog: {
        proof_profiles: {
          test: {
            schema_id: 'SCHEMA',
            requested_attributes: ['name'],
            requested_predicates: [],
            to_ref: 'holder',
            options: {},
          },
        },
      },
    }
    const actionDef: any = {
      key: 'request',
      typeURI: 'https://didcomm.org/present-proof/2.0/request-presentation',
      profile_ref: 'pp.test',
    }
    const proofsMock1 = {
      requestProof: jest.fn(async () => ({ id: 'prec-1' })),
      findRequestMessage: jest.fn(async (_id: string) => ({ message: { id: 'pmsg-1' } })),
    }
    const connections = { getById: jest.fn(async () => ({ theirDid: 'did:example:holder' })) }
    const ctx1 = {
      agentContext: makeAgentContext({ proofs: proofsMock1, connections }),
      template,
      instance: baseInstance,
      action: actionDef,
    }
    const res1 = await action.execute(ctx1 as any)
    expect(res1.messageId).toBe('pmsg-1')
    expect(res1.artifacts?.proofRecordId).toBe('prec-1')
    const proofsMock2 = {
      requestProof: jest.fn(async () => ({ id: 'prec-2' })),
      findRequestMessage: jest.fn(async (_id: string) => {
        throw new Error('not found')
      }),
    }
    const ctx2 = {
      agentContext: makeAgentContext({ proofs: proofsMock2, connections }),
      template,
      instance: baseInstance,
      action: actionDef,
    }
    const res2 = await action.execute(ctx2 as any)
    expect(res2.messageId).toBe('prec-2')
  })
})
import 'reflect-metadata'
