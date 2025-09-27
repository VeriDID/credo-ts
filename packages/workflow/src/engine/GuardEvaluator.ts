import jmespath from 'jmespath'
import { Participants, WorkflowInstanceData } from '../model/types'

export type GuardEnv = {
  context: Record<string, unknown>
  participants: Participants
  artifacts: Record<string, unknown>
}

export class GuardEvaluator {
  public static evalGuard(
    expression: string | undefined,
    env: GuardEnv,
    engine: 'jmespath' | 'cel' | 'js' = 'jmespath'
  ): boolean {
    if (!expression) return true
    try {
      if (engine === 'jmespath') {
        const res = jmespath.search(env as any, expression)
        return !!res
      }
      // fallback JS for dev
      const fn = new Function('context', 'participants', 'artifacts', `return (${expression});`)
      return !!fn(env.context, env.participants, env.artifacts)
    } catch {
      return false
    }
  }

  public static evalValue(expression: string, env: GuardEnv, engine: 'jmespath' | 'cel' | 'js' = 'jmespath'): any {
    try {
      if (engine === 'jmespath') return jmespath.search(env as any, expression)
      const fn = new Function('context', 'participants', 'artifacts', `return (${expression});`)
      return fn(env.context, env.participants, env.artifacts)
    } catch {
      return undefined
    }
  }

  public static envFromInstance(instance: WorkflowInstanceData): GuardEnv {
    return {
      context: instance.context || {},
      participants: instance.participants || {},
      artifacts: instance.artifacts || {},
    }
  }
}
