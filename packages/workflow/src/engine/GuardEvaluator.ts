import jmespath from 'jmespath'
import { Participants, WorkflowInstanceData } from '../model/types'

export type GuardEnv = {
  context: Record<string, unknown>
  participants: Participants
  artifacts: Record<string, unknown>
}

// biome-ignore lint/complexity/noStaticOnlyClass: Utility holder class for guard evaluation
export class GuardEvaluator {
  public static evalGuard(expression: string | undefined, env: GuardEnv): boolean {
    if (!expression) return true
    try {
      const jpSearch = jmespath.search as unknown as (obj: unknown, expr: string) => unknown
      const res = jpSearch(env, expression)
      return !!res
    } catch {
      return false
    }
  }

  public static evalValue(expression: string, env: GuardEnv): unknown {
    try {
      const jpSearch = jmespath.search as unknown as (obj: unknown, expr: string) => unknown
      return jpSearch(env, expression)
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
