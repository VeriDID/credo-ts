import type { SubjectMessage } from './transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { getAnonCredsModules } from '../packages/anoncreds/tests/anoncredsSetup'
import { getAgentOptions, makeConnection } from '../packages/core/tests/helpers'
import { anoncredsDefinitionFourAttributesNoRevocation, storePreCreatedAnonCredsDefinition } from '../packages/anoncreds/tests/preCreatedAnonCredsDefinition'
import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

import { Agent } from '@credo-ts/core'
import { DidCommAutoAcceptCredential, DidCommMessageSender, DidCommOutboundMessageContext, DidCommCredentialsApi, DidCommCredentialState } from '@credo-ts/didcomm'
import { WorkflowModule } from '../packages/workflow/src'
import { AdvanceMessage } from '../packages/workflow/src'

describe('Workflow AnonCreds E2E with UI and holder confirmation', () => {
  let issuerAgent: Agent
  let holderAgent: Agent

  beforeEach(async () => {
    const issuerOptions = getAgentOptions(
      'E2E Workflow Issuer',
      { endpoints: ['rxjs:issuer'] },
      {},
      {
        ...getAnonCredsModules({ autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved }),
        workflow: new WorkflowModule({ guardEngine: 'jmespath' }),
      },
      { requireDidcomm: true }
    )
    const holderOptions = getAgentOptions(
      'E2E Workflow Holder',
      { endpoints: ['rxjs:holder'] },
      {},
      {
        ...getAnonCredsModules({ autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved }),
        workflow: new WorkflowModule({ guardEngine: 'jmespath' }),
      },
      { requireDidcomm: true }
    )

    issuerAgent = new Agent(issuerOptions)
    holderAgent = new Agent(holderOptions)

    const subjectIssuer = new Subject<SubjectMessage>()
    const subjectHolder = new Subject<SubjectMessage>()
    const map = { 'rxjs:issuer': subjectIssuer, 'rxjs:holder': subjectHolder }

    issuerAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(map))
    issuerAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(subjectIssuer))
    holderAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(map))
    holderAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(subjectHolder))

    await issuerAgent.initialize()
    await holderAgent.initialize()
  })

  afterEach(async () => {
    await issuerAgent.shutdown()
    await holderAgent.shutdown()
  })

  test('Full UI flow with multi-input save and holder confirmation → credential includes submitted values', async () => {
    // Connect issuer and holder
    const [issuerConn, holderConn] = await makeConnection(issuerAgent, holderAgent)
    expect(issuerConn).toBeConnectedWith(holderConn)

    // Prepare pre-created anoncreds def
    const { credentialDefinitionId } = await storePreCreatedAnonCredsDefinition(
      issuerAgent as any,
      anoncredsDefinitionFourAttributesNoRevocation
    )

    // Publish template on issuer
    const ui = [
      { type: 'text', text: 'Enter your details' },
      { type: 'image', url: 'https://example.com/banner.png' },
      { type: 'video', url: 'https://example.com/intro.mp4' },
      { type: 'input', name: 'name', inputType: 'text', label: 'Full Name' },
      { type: 'input', name: 'age', inputType: 'number', label: 'Age' },
      { type: 'check-box', name: 'agree', label: 'I agree' },
      { type: 'drop-down', name: 'country', options: ['US', 'CA'] },
      { type: 'button', label: 'Save', event: 'save' },
      { type: 'submit-button', label: 'Confirm', event: 'request_confirm' },
    ]
    const tpl = {
      template_id: 'ui-flow',
      version: '1.0.0',
      title: 'Workflow UI and Issue',
      instance_policy: { mode: 'singleton_per_connection' },
      sections: [{ name: 'Main' }],
      states: [
        { name: 'menu', type: 'start', section: 'Main' },
        { name: 'confirm', type: 'normal', section: 'Main' },
        { name: 'done', type: 'final', section: 'Main' },
      ],
      transitions: [
        { from: 'menu', to: 'menu', on: 'save', action: 'state_save_form' },
        { from: 'menu', to: 'confirm', on: 'request_confirm', guard: 'context.name && context.age && context.agree && context.country' },
        { from: 'confirm', to: 'done', on: 'confirm_accept', action: 'offer_name_cred' },
      ],
      catalog: {
        credential_profiles: {
          demo: {
            cred_def_id: credentialDefinitionId,
            attribute_plan: {
              name: { source: 'context', path: 'name', required: true },
              age: { source: 'context', path: 'age', required: true },
              'x-ray': { source: 'static', value: 'not taken' },
              profile_picture: { source: 'static', value: 'looking good' },
            },
            to_ref: 'holder',
          },
        },
      },
      actions: [
        { key: 'state_save_form', typeURI: 'https://didcomm.org/workflow/actions/state:set@1', staticInput: { merge: '{{ input.form }}' } },
        { key: 'offer_name_cred', typeURI: 'https://didcomm.org/issue-credential/2.0/offer-credential', profile_ref: 'cp.demo' },
      ],
      display_hints: { states: { menu: ui, confirm: [{ type: 'text', text: 'Please confirm your details.' }, { type: 'submit-button', label: 'Accept', event: 'confirm_accept' }] } },
    }
    await (issuerAgent.modules as any).workflow.publishTemplate(tpl)

    // Start instance on issuer, scoped to connection and participants
    const inst = await (issuerAgent.modules as any).workflow.start({
      template_id: 'ui-flow',
      connection_id: issuerConn.id,
      participants: { holder: { did: issuerConn.theirDid as string } },
      context: {},
    })

    // Status returns UI and action menu
    const s1 = await (issuerAgent.modules as any).workflow.status({ instance_id: inst.instanceId, include_ui: true })
    expect(s1.state).toBe('menu')
    // UI items - various types
    expect(s1.ui?.find((i: any) => i.type === 'text')?.text).toContain('Enter your details')
    expect(s1.ui?.find((i: any) => i.type === 'image')?.url).toContain('banner.png')
    expect(s1.ui?.find((i: any) => i.type === 'video')?.url).toContain('intro.mp4')
    expect(s1.ui?.find((i: any) => i.type === 'input' && i.name === 'name')?.label).toBe('Full Name')
    expect(s1.ui?.find((i: any) => i.type === 'input' && i.name === 'age')?.label).toBe('Age')
    expect(s1.ui?.find((i: any) => i.type === 'check-box')?.label).toBe('I agree')
    expect(s1.ui?.find((i: any) => i.type === 'drop-down')?.options).toEqual(expect.arrayContaining(['US', 'CA']))
    // Buttons
    expect(s1.action_menu).toEqual(expect.arrayContaining([{ label: 'Save', event: 'save' }, { label: 'Confirm', event: 'request_confirm' }]))

    // Submit fields via save event
    await (issuerAgent.modules as any).workflow.advance({ instance_id: inst.instanceId, event: 'save', idempotency_key: 'k1', input: { form: { name: 'Alice', age: 30, agree: true, country: 'US' } } })
    const sAfterSave = await (issuerAgent.modules as any).workflow.status({ instance_id: inst.instanceId, include_ui: false })

    // Now request_confirm becomes allowed
    const s2 = await (issuerAgent.modules as any).workflow.status({ instance_id: inst.instanceId })
    expect(s2.allowed_events).toContain('request_confirm')

    // Issuer requests confirmation (moves to 'confirm')
    await (issuerAgent.modules as any).workflow.advance({ instance_id: inst.instanceId, event: 'request_confirm', idempotency_key: 'k2' })
    const sConfirm = await (issuerAgent.modules as any).workflow.status({ instance_id: inst.instanceId })

    // Holder would confirm. For deterministic e2e, advance on issuer side
    // Holder confirms by sending Advance DIDComm message to issuer
    const sender = holderAgent.dependencyManager.resolve(DidCommMessageSender)
    const msg = new AdvanceMessage({ thid: inst.instanceId, body: { instance_id: inst.instanceId, event: 'confirm_accept' } })
    const outbound = new DidCommOutboundMessageContext(msg as any, { agentContext: (holderAgent as any).context, connection: holderConn as any })
    await sender.sendMessage(outbound)

    // Wait for holder to receive the offer explicitly, then accept
    const holderOffer = await waitForHolderOffer(holderAgent)
    await (holderAgent.modules as any).credentials.acceptOffer({ credentialExchangeRecordId: holderOffer.id, autoAcceptCredential: 2 })
    // Wait until both sides have Done
    await waitForCredentialDone(issuerAgent)
    await waitForCredentialDone(holderAgent)

    // Verify offer attributes contained the submitted values
    const statusAfter = await (issuerAgent.modules as any).workflow.status({ instance_id: inst.instanceId })
    const issueRecordId: string = (statusAfter as any).artifacts?.issueRecordId
    expect(issueRecordId).toBeTruthy()
    const creds = issuerAgent.dependencyManager.resolve(DidCommCredentialsApi)
    const fmt = await creds.getFormatData(issueRecordId)
    const nameAttr = fmt.offerAttributes?.find((a: any) => a.name === 'name')
    const ageAttr = fmt.offerAttributes?.find((a: any) => a.name === 'age')
    expect(nameAttr?.value).toBe('Alice')
    expect(ageAttr?.value).toBe('30')
  })
})

async function waitForCredentialDone(agent: Agent, { timeoutMs = 10000, intervalMs = 250 } = {}) {
  const start = Date.now()
  const creds = agent.dependencyManager.resolve(DidCommCredentialsApi)
  while (Date.now() - start < timeoutMs) {
    const all = await creds.getAll()
    if (all.some((r) => (r as any).state === DidCommCredentialState.Done)) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Timeout waiting for credential to reach Done state')
}

async function waitForHolderOffer(agent: Agent, { timeoutMs = 10000, intervalMs = 250 } = {}) {
  const start = Date.now()
  const creds = agent.dependencyManager.resolve(DidCommCredentialsApi)
  while (Date.now() - start < timeoutMs) {
    const all = await creds.getAll()
    const rec = all.find((r: any) => r.state === 'offer-received')
    if (rec) return rec
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Timeout waiting for holder offer')
}
