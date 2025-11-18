import { TRPCError } from '@trpc/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'

export const emailService = {
  async sendVerificationEmail(to: string, code: string) {
    try {
      await resend.emails.send({
        from: `Trip Scheduler <${FROM_EMAIL}>`,
        to,
        subject: 'Код для подтверждения регистрации',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h2>Добро пожаловать в Trip Scheduler!</h2>
            <p>Ваш код для подтверждения регистрации:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f0f0f0; padding: 10px 20px; border-radius: 5px; display: inline-block;">
              ${code}
            </p>
            <p>Этот код действителен в течение 10 минут.</p>
            <p style="font-size: 12px; color: #888;">Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.</p>
          </div>
        `,
      })
    }
    catch (error) {
      console.error('Ошибка при отправке письма через Resend:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Не удалось отправить письмо для подтверждения.',
      })
    }
  },
}
