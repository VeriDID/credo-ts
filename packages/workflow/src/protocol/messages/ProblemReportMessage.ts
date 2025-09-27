import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class ProblemReportMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/problem-report')

  @IsValidMessageType(ProblemReportMessage.type)
  public type = ProblemReportMessage.type.messageTypeUri

  public body!: { code: string; comment?: string; args?: any }

  public constructor(options?: { id?: string; body: ProblemReportMessage['body']; thid?: string }) {
    super()
    this.type = ProblemReportMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
