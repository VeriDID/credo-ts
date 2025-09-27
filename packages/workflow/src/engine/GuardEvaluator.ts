import jmespath from 'jmespath'
import { Participants, WorkflowInstanceData } from '../model/types'

export type GuardEnv = {
  context: Record<string, unknown>
  participants: Participants
  artifacts: Record<string, unknown>
}

export class GuardEvaluator {
  public static evalGuard(expression: string | undefined, env: GuardEnv): boolean {
    if (!expression) return true
    try {
      const res = jmespath.search(env as any, expression)
      return !!res
    } catch {
      return false
    }
  }

  public static evalValue(expression: string, env: GuardEnv): any {
    try {
      return jmespath.search(env as any, expression)
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
