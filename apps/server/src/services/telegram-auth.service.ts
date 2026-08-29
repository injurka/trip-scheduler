import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { Logger } from '~/lib/logger'
import { userRepository } from '~/repositories/user.repository'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface PendingAuthSession {
  type?: 'auth' | 'link'
  userId?: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'already_linked'
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
  constructor(
    private readonly userRepo: typeof userRepository,
    private readonly logger: Logger,
  ) { }

  private get botToken(): string {
    const t = process.env.TELEGRAM_BOT_TOKEN

    if (!t)
      throw new HTTPException(503, { message: 'TELEGRAM_BOT_TOKEN не задан в переменных окружения на сервере' })

    return t
  }

  private get botUsername(): string {
    const u = process.env.TELEGRAM_BOT_USERNAME
    if (!u)
      throw new HTTPException(503, { message: 'TELEGRAM_BOT_USERNAME не задан в переменных окружения на сервере' })
    return u.replace(/^@/, '')
  }

  initAuth(): { token: string, url: string } {
    const token = crypto.randomUUID()
    pendingSessions.set(token, {
      type: 'auth',
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    return { token, url: `https://t.me/${this.botUsername}?start=${token}` }
  }

  initLink(userId: string): { token: string, url: string } {
    const token = crypto.randomUUID()
    pendingSessions.set(token, {
      type: 'link',
      userId,
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
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Пользователь Telegram'
      const user = await this.userRepo.findOrCreateFromOAuth({
        provider: 'telegram',
        providerId: tgUser.id.toString(),
        email: null,
        name,
        avatarUrl: undefined,
      })

      const tokenPair = await authUtils.generateTokens({ id: user.id, email: user.email })
      pendingSessions.delete(token)

      return { status: 'confirmed' as const, token: tokenPair, user }
    }

    return { status: 'pending' as const }
  }

  async getLinkStatus(token: string, currentUserId: string) {
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

    if (session.status === 'already_linked') {
      pendingSessions.delete(token)
      return { status: 'already_linked' as const, message: 'Этот Telegram-аккаунт уже привязан к другому пользователю' }
    }

    if (session.status === 'confirmed') {
      pendingSessions.delete(token)
      const user = await this.userRepo.getById(currentUserId)
      return { status: 'confirmed' as const, user }
    }

    return { status: 'pending' as const }
  }

  async handleUpdate(update: any): Promise<void> {
    this.logger.info(`[TelegramAuth] Входящий update #${update.update_id}: text=${JSON.stringify(update.message?.text)}, callback=${JSON.stringify(update.callback_query?.data)}`)
    try {
      if (update.message?.text) {
        await this.handleMessage(update.message)
      }
      else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query)
      }
    }
    catch (err) {
      this.logger.error('[TelegramAuth] Ошибка при обработке update:', err)
    }
  }

  private async handleMessage(message: any): Promise<void> {
    const text: string = message.text ?? ''
    const chatId: number = message.chat.id
    const from = message.from

    if (!text.startsWith('/start ')) {
      await this.sendMessage(chatId, 'Привет! Перейдите на сайт trip-scheduler.ru для входа или привязки аккаунта.')
      return
    }

    const token = text.split(' ')[1]?.trim()
    if (!token)
      return

    const session = pendingSessions.get(token)
    if (!session || session.status !== 'pending' || session.expiresAt < new Date()) {
      await this.sendMessage(chatId, '❌ Ссылка устарела или недействительна. Попробуйте снова на сайте.')
      return
    }

    const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    const mention = from.username ? ` (@${from.username})` : ''

    if (session.type === 'link') {
      await this.sendMessage(
        chatId,
        `🔗 Подтверждение привязки к trip-scheduler.ru\n\nАккаунт: ${name}${mention}\n\nВы действительно хотите привязать этот Telegram к вашему профилю?`,
        {
          inline_keyboard: [
            [
              { text: '✅ Привязать', callback_data: `confirm:${token}` },
              { text: '❌ Отмена', callback_data: `cancel:${token}` },
            ],
          ],
        },
      )
      return
    }

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
        await this.editMessage(chatId, messageId, '❌ Ссылка устарела. Запросите новую на сайте.')
        return
      }

      if (session.type === 'link' && session.userId) {
        try {
          await this.userRepo.linkOAuthProvider(session.userId, 'telegram', from.id.toString())
          session.status = 'confirmed'
          session.telegramUser = {
            id: from.id,
            first_name: from.first_name,
            last_name: from.last_name,
            username: from.username,
          }
          await this.answerCallback(cbId, '✅ Telegram привязан!')
          await this.editMessage(chatId, messageId, '✅ Telegram успешно привязан к вашему профилю! Возвращайтесь на сайт.')
        }
        catch (err: any) {
          session.status = 'already_linked'
          await this.answerCallback(cbId, '❌ Ошибка')
          await this.editMessage(chatId, messageId, `❌ ${err?.message || 'Этот Telegram-аккаунт уже привязан к другому пользователю.'}`)
        }
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
      await this.editMessage(chatId, messageId, '✅ Авторизация успешна! Возвращайтесь на сайт.')
    }
    else if (data?.startsWith('cancel:')) {
      const token = data.replace('cancel:', '')
      const session = pendingSessions.get(token)
      if (session)
        session.status = 'cancelled'

      await this.answerCallback(cbId, 'Отменено')
      await this.editMessage(chatId, messageId, '❌ Действие отменено.')
    }
  }

  async setupWebhook(): Promise<void> {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
      this.logger.warn('[TelegramAuth] BACKEND_URL not set, webhook не зарегистрирован')
      return
    }

    const webhookUrl = `${backendUrl}/api/auth/telegram/webhook`
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET

    try {
      const payload: Record<string, any> = { url: webhookUrl }
      if (secret) {
        payload.secret_token = secret
      }

      const res = await this.fetchTelegram('setWebhook', payload)

      const data = await res.json()
      if (data.ok) {
        this.logger.info(`[TelegramAuth] Webhook зарегистрирован: ${webhookUrl}`)
      }
      else {
        this.logger.error('[TelegramAuth] Ошибка регистрации webhook:', data)
      }
    }
    catch (error) {
      this.logger.error('[TelegramAuth] Критическая ошибка сети при регистрации webhook (возможно блокировка):', error)
    }
  }

  private async fetchTelegram(methodName: string, body: object): Promise<Response> {
    const telegramApiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org'
    const url = `${telegramApiUrl}/bot${this.botToken}/${methodName}`
    const options: any = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }

    const proxy = process.env.TELEGRAM_PROXY
    if (proxy) {
      options.proxy = proxy
    }

    try {
      const res = await fetch(url, options)
      if (!res.ok) {
        const errData = await res.text()
        this.logger.error(`[TelegramAuth] Ошибка вызова Telegram API ${methodName} (${res.status}): ${errData}`)
      }
      return res
    }
    catch (error) {
      this.logger.error(`[TelegramAuth] Сетевая ошибка при вызове Telegram API ${methodName}:`, error)
      throw error
    }
  }

  private async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<void> {
    const body: any = { chat_id: chatId, text }
    if (replyMarkup)
      body.reply_markup = replyMarkup

    await this.fetchTelegram('sendMessage', body)
  }

  private async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    await this.fetchTelegram('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
    })
  }

  private async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    await this.fetchTelegram('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
    })
  }
}

export const telegramAuthService = new TelegramAuthService(userRepository, new Logger())
