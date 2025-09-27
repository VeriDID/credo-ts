import { AttributePlanner, GuardEvaluator } from '../src'

describe('Engine helpers', () => {
  test('AttributePlanner materialize: context/static/compute', () => {
    const plan: any = {
      a: { source: 'context', path: 'user.name', required: true },
      b: { source: 'static', value: 42 },
      c: { source: 'compute', expr: 'concat("hi-", "there")' },
    }
    const instance: any = { context: { user: { name: 'Alice' } } }
    const out = AttributePlanner.materialize(plan, instance)
    expect(out).toEqual({ a: 'Alice', b: 42, c: 'hi-there' })
  })

  test('AttributePlanner required throws missing_attributes', () => {
    const plan: any = { req: { source: 'context', path: 'x', required: true } }
    const instance: any = { context: {} }
    expect(() => AttributePlanner.materialize(plan, instance)).toThrow()
  })

  test('GuardEvaluator evalGuard with JMESPath truthy/falsey', () => {
    const env = { context: { a: 1, b: 0 }, participants: {}, artifacts: {} }
    expect(GuardEvaluator.evalGuard('context.a', env as any, 'jmespath')).toBe(true)
    expect(GuardEvaluator.evalGuard('context.b', env as any, 'jmespath')).toBe(false)
  })

  test('GuardEvaluator evalValue returns selected JSON piece', () => {
    const env = { context: { a: { x: 'ok' } }, participants: {}, artifacts: {} }
    expect(GuardEvaluator.evalValue('context.a.x', env as any, 'jmespath')).toBe('ok')
  })

  test('GuardEvaluator JS engine evalGuard/evalValue', () => {
    const env = { context: { a: 2 }, participants: {}, artifacts: {} }
    expect(GuardEvaluator.evalGuard('context.a + 1 > 2', env as any, 'js')).toBe(true)
    expect(GuardEvaluator.evalValue('context.a + 2', env as any, 'js')).toBe(4)
  })

  test('AttributePlanner compute error returns undefined unless required', () => {
    const badPlan: any = {
      x: { source: 'compute', expr: 'invalid++expr' },
      y: { source: 'compute', expr: 'invalid++expr', required: true },
    }
    const inst: any = { context: {} }
    // x will be omitted silently
    expect(() => AttributePlanner.materialize({ x: badPlan.x }, inst)).not.toThrow()
    // y required → throws
    expect(() => AttributePlanner.materialize({ y: badPlan.y }, inst)).toThrow()
  })
})
