import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { authUtils } from '~/lib/auth.utils'
import { bookingGenerationService } from '~/services/llm/booking-generation.service'
import { financesGenerationService } from '~/services/llm/finances-generation.service'

const llmController = new Hono()

async function generateBookingController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)
  if (!user)
    throw new HTTPException(401, { message: 'Невалидный или истекший токен.' })

  const formData = await c.req.formData()
  const file = formData.get('file')
  const bookingType = formData.get('bookingType') as string
  const notes = formData.get('notes') as string | null

  if (!file || !(file instanceof File))
    throw new HTTPException(400, { message: 'Файл не найден в запросе.' })

  if (!bookingType)
    throw new HTTPException(400, { message: 'Необходимо указать тип бронирования (bookingType).' })

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const generatedData = await bookingGenerationService.generateBookingFromFile({
      userId: user.id,
      fileBuffer,
      fileName: file.name,
      bookingType,
      notes,
    })
    return c.json(generatedData)
  }
  catch (error: any) {
    console.error('Ошибка при генерации бронирования:', error)
    throw new HTTPException(500, { message: error.message || 'Внутренняя ошибка при обработке файла.' })
  }
}

async function generateFinancesController(c: Context) {
  const token = c.req.header('authorization')?.split(' ')[1]
  const user = await authUtils.getUserFromToken(token)
  if (!user)
    throw new HTTPException(401, { message: 'Невалидный или истекший токен.' })

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null
  const notes = formData.get('notes') as string | null
  const categories = formData.get('categories') as string | null

  if (!file && !text) {
    throw new HTTPException(400, { message: 'Необходимо предоставить либо текст, либо файл для анализа.' })
  }

  try {
    const fileBuffer = file ? Buffer.from(await file.arrayBuffer()) : undefined

    const generatedData = await financesGenerationService.generateTransactionsFromData({
      userId: user.id,
      fileBuffer,
      fileName: file?.name,
      text,
      notes,
      categories,
    })
    return c.json(generatedData)
  }
  catch (error: any) {
    console.error('Ошибка при генерации транзакций:', error)
    throw new HTTPException(500, { message: error.message || 'Внутренняя ошибка при обработке данных.' })
  }
}

llmController.post('/booking/generate', generateBookingController)
llmController.post('/finances/generate', generateFinancesController)

export { llmController }
