import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { WorkflowModule } from '../src'

const makeAgent = async () => {
  const agent = new Agent({
    config: {
      label: 'wf-test',
      logger: new ConsoleLogger(LogLevel.off),
      walletConfig: { id: 'wf-test', key: 'wf-test' },
    },
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        askar,
        store: { id: 'wf-store', key: 'wf-store', database: { type: 'sqlite', config: { inMemory: true } } },
      }),
      workflow: new WorkflowModule({ guardEngine: 'jmespath' }),
    },
  })
  await agent.initialize()
  return agent
}

describe('Workflow module', () => {
  test('publishTemplate validates schema and refs', async () => {
    const agent = await makeAgent()
    const tpl = {
      template_id: 't1',
      version: '1.0.0',
      title: 'Demo',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{ name: 'Main' }],
      states: [
        { name: 'start', type: 'start', section: 'Main' },
        { name: 'end', type: 'final', section: 'Main' },
      ],
      transitions: [{ from: 'start', to: 'end', on: 'go' }],
      catalog: {},
      actions: [],
    }
    await agent.modules.workflow.publishTemplate(tpl as any)
    await agent.shutdown()
  })

  test('publishTemplate invalid (missing start state) throws', async () => {
    const agent = await makeAgent()
    const bad = {
      template_id: 'bad',
      version: '1.0.0',
      title: 'Bad',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 'x', type: 'normal' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    await expect(agent.modules.workflow.publishTemplate(bad as any)).rejects.toHaveProperty('code', 'invalid_template')
    await agent.shutdown()
  })

  test('singleton_per_connection returns existing instance', async () => {
    const agent = await makeAgent()
    const tpl = {
      template_id: 'single',
      version: '1.0.0',
      title: 'S',
      instance_policy: { mode: 'singleton_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    await agent.modules.workflow.publishTemplate(tpl as any)
    const a = await agent.modules.workflow.start({ template_id: 'single', connection_id: 'conn-1' })
    const b = await agent.modules.workflow.start({ template_id: 'single', connection_id: 'conn-1' })
    expect(a.instanceId).toBe(b.instanceId)
    await agent.shutdown()
  })

  test('multi_per_connection multiplicity_key dedupes per key', async () => {
    const agent = await makeAgent()
    const tpl = {
      template_id: 'multi',
      version: '1.0.0',
      title: 'M',
      instance_policy: { mode: 'multi_per_connection', multiplicity_key: 'context.k' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    await agent.modules.workflow.publishTemplate(tpl as any)
    const a = await agent.modules.workflow.start({ template_id: 'multi', connection_id: 'c1', context: { k: 'A' } })
    const b = await agent.modules.workflow.start({ template_id: 'multi', connection_id: 'c1', context: { k: 'A' } })
    const c = await agent.modules.workflow.start({ template_id: 'multi', connection_id: 'c1', context: { k: 'B' } })
    expect(a.instanceId).toBe(b.instanceId)
    expect(c.instanceId).not.toBe(a.instanceId)
    await agent.shutdown()
  })

  test('guards, local action, final state, idempotency', async () => {
    const agent = await makeAgent()
    const tpl = {
      template_id: 'flow',
      version: '1.0.0',
      title: 'F',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{ name: 'Main' }],
      states: [
        { name: 'menu', type: 'start', section: 'Main' },
        { name: 'done', type: 'final', section: 'Main' },
      ],
      transitions: [
        { from: 'menu', to: 'menu', on: 'save', action: 'state_save_form' },
        { from: 'menu', to: 'done', on: 'finish', guard: 'context.name' },
      ],
      catalog: {},
      actions: [
        {
          key: 'state_save_form',
          typeURI: 'https://didcomm.org/workflow/actions/state:set@1',
          staticInput: { merge: '{{ input.form }}' },
        },
      ],
    }
    await agent.modules.workflow.publishTemplate(tpl as any)
    const inst = await agent.modules.workflow.start({ template_id: 'flow', context: {} })
    const s1 = await agent.modules.workflow.status({ instance_id: inst.instanceId })
    expect(s1.allowed_events.includes('finish')).toBe(false)
    await agent.modules.workflow.advance({
      instance_id: inst.instanceId,
      event: 'save',
      idempotency_key: 'k1',
      input: { form: { name: 'Alice' } },
    })
    const s2 = await agent.modules.workflow.status({ instance_id: inst.instanceId })
    expect(s2.allowed_events.includes('finish')).toBe(true)
    await agent.modules.workflow.advance({
      instance_id: inst.instanceId,
      event: 'save',
      idempotency_key: 'k1',
      input: { form: { name: 'Alice' } },
    })
    const s3 = await agent.modules.workflow.status({ instance_id: inst.instanceId })
    expect(s3.state).toBe('menu')
    await agent.modules.workflow.advance({ instance_id: inst.instanceId, event: 'finish', idempotency_key: 'k2' })
    const s4 = await agent.modules.workflow.status({ instance_id: inst.instanceId })
    expect(s4.state).toBe('done')
    await agent.shutdown()
  })
})
