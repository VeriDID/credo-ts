import { AgentConfig, injectable } from '@credo-ts/core'
import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '@credo-ts/didcomm'
import { ProblemReportMessage } from '../messages/ProblemReportMessage'

@injectable()
export class ProblemReportHandler implements DidCommMessageHandler {
  public supportedMessages = [ProblemReportMessage]
  public async handle(messageContext: DidCommMessageHandlerInboundMessage<ProblemReportHandler>) {
    const logger = messageContext.agentContext.dependencyManager.resolve(AgentConfig).logger
    const body = messageContext.message.body
    const thid = messageContext.message.threadId || messageContext.message.id
    logger.warn('[Workflow] problem-report received', { thid, code: body?.code, comment: body?.comment })
    return undefined
  }
}
