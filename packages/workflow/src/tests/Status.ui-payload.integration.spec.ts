import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { WorkflowModule } from '..'

const makeAgent = async () => {
  const agent = new Agent({
    config: {
      label: 'wf-status-ui-test',
      logger: new ConsoleLogger(LogLevel.off),
      walletConfig: { id: 'wf-status-ui-test', key: 'wf-status-ui-test' },
    },
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule({
        askar,
        store: {
          id: 'wf-status-ui-store',
          key: 'wf-status-ui-store',
          database: { type: 'sqlite', config: { inMemory: true } },
        },
      }),
      workflow: new WorkflowModule({ guardEngine: 'jmespath' }),
    },
  })
  await agent.initialize()
  return agent
}

describe('Status UI payload', () => {
  test('status returns action_menu and full ui items when requested', async () => {
    const agent = await makeAgent()
    const ui = [
      { type: 'text', text: 'Welcome!' },
      { type: 'image', url: 'https://example.com/banner.png' },
      { type: 'video', url: 'https://example.com/intro.mp4' },
      { type: 'input', name: 'email', inputType: 'email', label: 'Email' },
      { type: 'check-box', name: 'agree', label: 'I agree' },
      { type: 'drop-down', name: 'country', options: ['US', 'CA'] },
      { type: 'button', label: 'Go', event: 'go' },
      { type: 'submit-button', label: 'Submit', event: 'submit' },
    ]
    const tpl = {
      template_id: 'ui-tpl',
      version: '1.0.0',
      title: 'UI Demo',
      instance_policy: { mode: 'multi_per_connection' },
      sections: [{ name: 'Main' }],
      states: [
        { name: 'menu', type: 'start', section: 'Main' },
        { name: 'done', type: 'final', section: 'Main' },
      ],
      transitions: [],
      catalog: {},
      actions: [],
      display_hints: { states: { menu: ui } },
    }
    await agent.modules.workflow.publishTemplate(tpl as any)
    const inst = await agent.modules.workflow.start({ template_id: 'ui-tpl' })

    const s1 = await agent.modules.workflow.status({ instance_id: inst.instanceId, include_ui: true })
    expect(s1.state).toBe('menu')
    // action_menu only contains button and submit-button
    expect(s1.action_menu).toEqual(
      expect.arrayContaining([
        { label: 'Go', event: 'go' },
        { label: 'Submit', event: 'submit' },
      ])
    )
    // full ui mirror
    expect(s1.ui).toEqual(ui)

    const s2 = await agent.modules.workflow.status({
      instance_id: inst.instanceId,
      include_ui: true,
      include_actions: false,
    })
    expect(s2.action_menu.length).toBe(0)
    expect(s2.ui).toEqual(ui)

    const s3 = await agent.modules.workflow.status({ instance_id: inst.instanceId, include_actions: true })
    expect(s3.ui).toEqual(ui)
    await agent.shutdown()
  })
})
