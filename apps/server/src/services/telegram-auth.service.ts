import { authUtils } from '~/lib/auth.utils'
import { userRepository } from '~/repositories/user.repository'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface PendingAuthSession {
  status: 'pending' | 'confirmed' | 'cancelled'
  telegramUser?: TelegramUser
  expiresAt: Date
}

const pendingSessions = new Map<string, PendingAuthSession>()

setInterval(() => {
  const now = new Date()
  for (const [token, session] of pendingSessions.entries()) {
    if (session.expiresAt < now)
      pendingSessions.delete(token)
  }
}, 5 * 60 * 1000)

export class TelegramAuthService {
  constructor(private readonly userRepo: typeof userRepository) { }

  private get botToken(): string {
    const t = process.env.TELEGRAM_BOT_TOKEN
    if (!t)
      throw new Error('TELEGRAM_BOT_TOKEN is not set')
    return t
  }

  private get botUsername(): string {
    const u = process.env.TELEGRAM_BOT_USERNAME
    if (!u)
      throw new Error('TELEGRAM_BOT_USERNAME is not set')
    return u
  }

  initAuth(): { token: string, url: string } {
    const token = crypto.randomUUID()
    pendingSessions.set(token, {
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    return { token, url: `https://t.me/${this.botUsername}?start=${token}` }
  }

  async getStatus(token: string) {
    const session = pendingSessions.get(token)

    if (!session)
      return { status: 'not_found' as const }

    if (session.expiresAt < new Date()) {
      pendingSessions.delete(token)
      return { status: 'expired' as const }
    }

    if (session.status === 'pending')
      return { status: 'pending' as const }

    if (session.status === 'cancelled') {
      pendingSessions.delete(token)
      return { status: 'cancelled' as const }
    }

    if (session.status === 'confirmed' && session.telegramUser) {
      const tgUser = session.telegramUser
      const user = await this.userRepo.findOrCreateFromOAuth({
        provider: 'telegram',
        providerId: tgUser.id.toString(),
        email: null,
        name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
        avatarUrl: undefined,
      })

      const tokenPair = await authUtils.generateTokens({ id: user.id, email: user.email! })
      pendingSessions.delete(token)

      return { status: 'confirmed' as const, token: tokenPair, user }
    }

    return { status: 'pending' as const }
  }

  async handleUpdate(update: any): Promise<void> {
    if (update.message?.text) {
      await this.handleMessage(update.message)
    }
    else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query)
    }
  }

  private async handleMessage(message: any): Promise<void> {
    const text: string = message.text ?? ''
    const chatId: number = message.chat.id
    const from = message.from

    if (!text.startsWith('/start ')) {
      await this.sendMessage(chatId, 'Привет! Перейдите на сайт и нажмите «Войти через Telegram».')
      return
    }

    const token = text.split(' ')[1]?.trim()
    if (!token)
      return

    const session = pendingSessions.get(token)
    if (!session || session.status !== 'pending' || session.expiresAt < new Date()) {
      await this.sendMessage(chatId, '❌ Ссылка для входа устарела или недействительна. Попробуйте снова.')
      return
    }

    const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    const mention = from.username ? ` (@${from.username})` : ''

    await this.sendMessage(
      chatId,
      `🔐 Подтверждение входа на trip-scheduler.ru\n\nАккаунт: ${name}${mention}\n\nВы действительно хотите войти?`,
      {
        inline_keyboard: [
          [
            { text: '✅ Войти', callback_data: `confirm:${token}` },
            { text: '❌ Отмена', callback_data: `cancel:${token}` },
          ],
        ],
      },
    )
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const { id: cbId, data, message, from } = callbackQuery
    const chatId: number = message.chat.id
    const messageId: number = message.message_id

    if (data?.startsWith('confirm:')) {
      const token = data.replace('confirm:', '')
      const session = pendingSessions.get(token)

      if (!session || session.status !== 'pending' || session.expiresAt < new Date()) {
        await this.answerCallback(cbId, '❌ Ссылка устарела')
        await this.editMessage(chatId, messageId, '❌ Ссылка для входа устарела. Запросите новую.')
        return
      }

      session.status = 'confirmed'
      session.telegramUser = {
        id: from.id,
        first_name: from.first_name,
        last_name: from.last_name,
        username: from.username,
      }

      await this.answerCallback(cbId, '✅ Вход выполнен!')
      await this.editMessage(chatId, messageId, '✅  на trip-scheduler.ru')
    }
    else if (data?.startsWith('cancel:')) {
      const token = data.replace('cancel:', '')
      const session = pendingSessions.get(token)
      if (session)
        session.status = 'cancelled'

      await this.answerCallback(cbId, 'Вход отменён')
      await this.editMessage(chatId, messageId, '❌ Вход отменён.')
    }
  }

  async setupWebhook(): Promise<void> {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
      console.warn('[TelegramAuth] BACKEND_URL not set, webhook не зарегистрирован')
      return
    }
    const webhookUrl = `${backendUrl}/api/auth/telegram/webhook`
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
    })

    const data = await res.json()
    if (data.ok) {
      // eslint-disable-next-line no-console
      console.info('[TelegramAuth] Webhook зарегистрирован:', webhookUrl)
    }
    else {
      console.error('[TelegramAuth] Ошибка регистрации webhook:', data)
    }
  }

  private async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<void> {
    const body: any = { chat_id: chatId, text }
    if (replyMarkup)
      body.reply_markup = replyMarkup

    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  private async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    })
  }

  private async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    await fetch(`https://api.telegram.org/bot${this.botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    })
  }
}

export const telegramAuthService = new TelegramAuthService(userRepository)
