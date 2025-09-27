import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class ResumeMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/resume')

  @IsValidMessageType(ResumeMessage.type)
  public type = ResumeMessage.type.messageTypeUri

  public body!: { instance_id: string; reason?: string }

  public constructor(options?: { id?: string; body: ResumeMessage['body']; thid?: string }) {
    super()
    this.type = ResumeMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
