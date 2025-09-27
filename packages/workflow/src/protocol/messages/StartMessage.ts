import { DidCommMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'
import type { Participants } from '../../model/types'

export class StartMessage extends DidCommMessage {
  public static readonly type = parseMessageType('https://didcomm.org/workflow/1.0/start')

  @IsValidMessageType(StartMessage.type)
  public type = StartMessage.type.messageTypeUri

  public body!: {
    template_id: string
    template_version?: string
    instance_id?: string
    connection_id?: string
    participants?: Participants
    context?: Record<string, unknown>
  }

  public constructor(options?: { id?: string; body: StartMessage['body']; thid?: string }) {
    super()
    this.type = StartMessage.type.messageTypeUri
    if (options) {
      this.id = options.id || this.generateId()
      this.body = options.body
      if (options.thid) this.setThread({ threadId: options.thid })
    }
  }
}
