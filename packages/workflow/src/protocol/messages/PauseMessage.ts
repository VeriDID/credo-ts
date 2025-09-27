import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export class PauseMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/pause')

  @IsValidMessageType(PauseMessage.type)
  public type = PauseMessage.type.messageTypeUri

  public body!: { instance_id: string; reason?: string }

  public constructor(options?: { id?: string; body: PauseMessage['body']; thid?: string }) {
    super()
    this.type = PauseMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
