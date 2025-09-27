import {
  CancelMessage,
  CompleteMessage,
  PauseMessage,
  PublishTemplateMessage,
  ResumeMessage,
  StatusMessage,
} from '..'

describe('Protocol messages constructors', () => {
  test('Pause/Resume/Cancel/Complete set type, body and thread', () => {
    const thid = 't1'
    const iid = 'i1'

    const p = new PauseMessage({ thid, body: { instance_id: iid, reason: 'r' } })
    expect(p.type).toBe('https://didcomm.org/workflow/1.0/pause')
    expect(p.threadId).toBe(thid)
    expect(p.body.instance_id).toBe(iid)

    const r = new ResumeMessage({ thid, body: { instance_id: iid, reason: 'r' } })
    expect(r.type).toBe('https://didcomm.org/workflow/1.0/resume')
    expect(r.threadId).toBe(thid)
    expect(r.body.instance_id).toBe(iid)

    const c = new CancelMessage({ thid, body: { instance_id: iid, reason: 'r' } })
    expect(c.type).toBe('https://didcomm.org/workflow/1.0/cancel')
    expect(c.threadId).toBe(thid)
    expect(c.body.instance_id).toBe(iid)

    const done = new CompleteMessage({ thid, body: { instance_id: iid, reason: 'ok' } })
    expect(done.type).toBe('https://didcomm.org/workflow/1.0/complete')
    expect(done.threadId).toBe(thid)
    expect(done.body.instance_id).toBe(iid)
  })

  test('StatusMessage body shape is preserved', () => {
    const thid = 't2'
    const msg = new StatusMessage({
      thid,
      body: {
        instance_id: 'i2',
        state: 's',
        section: 'Main',
        allowed_events: ['a', 'b'],
        action_menu: [{ label: 'L', event: 'E' }],
        artifacts: { k: 'v' },
        ui: [{ type: 'text', text: 'hello' }],
      },
    })
    expect(msg.type).toBe('https://didcomm.org/workflow/1.0/status')
    expect(msg.threadId).toBe(thid)
    expect(msg.body.allowed_events).toContain('a')
    expect(msg.body.ui?.[0]).toEqual({ type: 'text', text: 'hello' })
  })

  test('PublishTemplateMessage sets type and embeds template', () => {
    const tpl: any = {
      template_id: 't',
      version: '1.0.0',
      title: 'T',
      instance_policy: { mode: 'multi_per_connection' },
      states: [{ name: 's', type: 'start' }],
      transitions: [],
      catalog: {},
      actions: [],
    }
    const m = new PublishTemplateMessage({ body: { template: tpl, mode: 'upsert' } })
    expect(m.type).toBe('https://didcomm.org/workflow/1.0/publish-template')
    expect((m.body as any).template.template_id).toBe('t')
  })
})
