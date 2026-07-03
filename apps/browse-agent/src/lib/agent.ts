import type { DayTask, LocationInfo } from '../types.js'
import type { BrowserService } from './browser.js'
import { isCancel, text } from '@clack/prompts'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import pc from 'picocolors'
import { z } from 'zod'
import { config } from './config.js'
import { chunkText, cosineSimilarity, searchMapbox } from './helpers.js'

export class TravelAgent {
  private openai: OpenAI
  private browser: BrowserService
  private model: string
  private ragModel: string

  private currentDocumentChunks: { text: string, embedding: number[] }[] = []

  public tokenUsage: Record<string, { prompt: number, completion: number, total: number }> = {}

  constructor(browser: BrowserService) {
    this.openai = new OpenAI({
      baseURL: config.llm.apiUrl,
      apiKey: config.llm.apiKey,
      timeout: 90000,
      maxRetries: 1,
    })
    this.ragModel = config.llm.ragModel
    this.model = config.llm.model
    this.browser = browser
  }

  private trackUsage(model: string, usage?: any) {
    if (!usage)
      return

    if (!this.tokenUsage[model]) {
      this.tokenUsage[model] = { prompt: 0, completion: 0, total: 0 }
    }

    this.tokenUsage[model].prompt += usage.prompt_tokens || 0
    this.tokenUsage[model].completion += usage.completion_tokens || 0
    this.tokenUsage[model].total += usage.total_tokens || 0
  }

  async extractTasks(markdownContent: string, dayNumber: string): Promise<DayTask[]> {
    console.log(pc.cyan('\n📄 Анализирую Markdown-файл для поиска локаций...'))

    const TasksSchema = z.object({
      tasks: z.array(z.object({
        locationName: z.string(),
        cityName: z.string(),
      })),
    })

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Ты — AI-ассистент по туризму. Найди в тексте путеводителя 2-4 главные туристические достопримечательности (храмы, парки, рестораны), о которых стоит найти актуальную информацию.`,
        },
        { role: 'user', content: markdownContent },
      ],
      response_format: zodResponseFormat(TasksSchema, 'tasks_result'),
    })

    this.trackUsage(this.model, response.usage)

    const content = response.choices[0].message.content
    const tasks = content ? JSON.parse(content).tasks : []
    return tasks.map((t: any) => ({ ...t, dayNumber }))
  }

  async researchLocation(task: DayTask): Promise<LocationInfo | null> {
    console.log(pc.magenta(`\n🧠 Агент начинает поиск: ${task.locationName} (${task.cityName})`))
    this.currentDocumentChunks = []

    const sitesStr = config.search.preferredSites.join(', ')
    const sitesInstruction = config.search.preferredSites.length > 0
      ? `ПРИОРИТЕТНЫЕ ИСТОЧНИКИ (ищи в первую очередь на них): ${sitesStr}.`
      : ''

    console.log(pc.blue('📝 Составляю план исследования (Мульти-сорсинг)...'))
    const PlanSchema = z.object({ plan: z.array(z.string()) })

    try {
      const planRes = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `Ты старший исследователь-аналитик. Составь пошаговый план из 4-5 шагов для поиска информации о месте.
КРИТИЧЕСКОЕ ПРАВИЛО (МУЛЬТИ-СОРСИНГ): Ты обязан запланировать поиск минимум на 2-3 разных ресурсах. 
${sitesInstruction}
Не ищи всё только на одном сайте.`,
          },
          {
            role: 'user',
            content: `Локация: ${task.locationName}, Город: ${task.cityName}.`,
          },
        ],
        response_format: zodResponseFormat(PlanSchema, 'search_plan'),
      })

      this.trackUsage(this.model, planRes.usage)
      const planContent = planRes.choices[0].message.content
      const plan = planContent ? JSON.parse(planContent).plan : []
      console.log(pc.gray(`План действий:\n${plan.map((p: string, i: number) => ` ${i + 1}. ${p}`).join('\n')}`))

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Ты — автономный ИИ-агент по туризму. 

ТВОЙ ПЛАН ДЕЙСТВИЙ:
${plan.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}

ПРАВИЛА И АЛГОРИТМ:
1. Вызови "mapbox_search" для координат.
2. Используй "google_search" для кросс-поиска по разным сайтам. ${sitesInstruction} При необходимости добавляй оператор "site:домен" к запросу в Google для прицельного поиска.
3. Используй "goto_url", чтобы открывать страницы и "get_page_content" для извлечения информации.
4. Если документ огромный — используй "search_in_page_content" (RAG).
5. ЭТАП АНАЛИТИКИ: Если ты нашел отзывы посетителей, скопируй их текст и вызови инструмент "analyze_reviews". Он вернет тебе Vibe Check (Плюсы/Минусы).
6. Вызови "get_images" и выбери красивые фото.
7. Вызови "finish_task", объединив и проверив данные из всех источников. ОБЯЗАТЕЛЬНО передай "vibe", "address" и "coordinates".
8. КРИТИЧЕСКИ ВАЖНО (ЯЗЫК): Независимо от того, на каком языке ты нашел информацию, ВЕСЬ ФИНАЛЬНЫЙ ТЕКСТ в "finish_task" ДОЛЖЕН БЫТЬ СТРОГО НА РУССКОМ ЯЗЫКЕ.`,
        },
      ]

      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        { type: 'function', function: { name: 'mapbox_search', description: 'Получить гео-координаты.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
        { type: 'function', function: { name: 'google_search', description: 'Поиск в Google. Формируй хорошие запросы.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
        { type: 'function', function: { name: 'goto_url', description: 'Перейти по ссылке.', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
        { type: 'function', function: { name: 'get_page_content', description: 'Прочитать текст страницы.', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'search_in_page_content', description: 'СЕМАНТИЧЕСКИЙ ПОИСК (RAG) по большой странице.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
        { type: 'function', function: { name: 'get_images', description: 'Получить картинки.', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'ask_human', description: 'Задать вопрос пользователю.', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } } },
        {
          type: 'function',
          function: {
            name: 'analyze_reviews',
            description: 'Анализирует текст отзывов (Vibe Check). Возвращает выжимку: плюсы, минусы, атмосфера. Вызывай, когда нашел отзывы.',
            parameters: {
              type: 'object',
              properties: {
                reviewsText: { type: 'string', description: 'Сырой текст отзывов со страницы' },
              },
              required: ['reviewsText'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'finish_task',
            description: 'Завершить работу. ВСЕ ПОЛЯ СТРОГО НА РУССКОМ ЯЗЫКЕ!',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Название места (на русском, можно в скобках оригинал)' },
                description: { type: 'string', description: 'Подробное описание места на РУССКОМ языке' },
                workingHours: { type: 'string', description: 'Часы работы на РУССКОМ языке' },
                price: { type: 'string', description: 'Цена и стоимость билетов на РУССКОМ языке' },
                tips: { type: 'string', description: 'Полезные советы туристам на РУССКОМ языке' },
                vibe: { type: 'string', description: 'Результат анализа отзывов (или "Нет данных") на РУССКОМ языке' },
                imageUrls: { type: 'array', items: { type: 'string' } },
                siteUrl: { type: 'string', description: 'Главный источник информации (ссылка)' },
                address: { type: 'string', description: 'Адрес на РУССКОМ языке (можно с оригиналом)' },
                coordinates: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
              },
              required: ['name', 'description', 'imageUrls', 'siteUrl', 'vibe'],
            },
          },
        },
      ]

      for (let i = 0; i < 20; i++) {
        console.log(pc.gray(`🔄 Мышление... (шаг ${i + 1})`))

        let response
        try {
          response = await this.openai.chat.completions.create({ model: this.model, messages, tools, tool_choice: 'auto' })
        }
        catch (apiError: any) {
          console.log(pc.red(`❌ Ошибка связи с LLM API: ${apiError.message}`))
          return null // Прерываем поиск локации при сбое сети/таймауте
        }

        this.trackUsage(this.model, response.usage)

        const message = response.choices[0].message
        messages.push(message)

        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            if (toolCall.type !== 'function')
              continue

            let args
            try {
              args = JSON.parse(toolCall.function.arguments)
            }
            catch {
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Error: Invalid JSON' })
              continue
            }

            console.log(pc.yellow(`🛠 Вызов: ${toolCall.function.name}`), args)
            let toolResult = ''

            switch (toolCall.function.name) {
              case 'mapbox_search': toolResult = await searchMapbox(args.query); break
              case 'google_search': toolResult = await this.browser.googleSearch(args.query); break
              case 'goto_url': toolResult = await this.browser.goto(args.url); break
              case 'get_images': toolResult = await this.browser.getImages(); break

              case 'get_page_content':
                {
                  const rawContent = await this.browser.getPageContent()
                  if (rawContent.length > 8000) {
                    console.log(pc.yellow(`📄 Страница огромная (${rawContent.length} симв.). Векторизую (RAG)...`))
                    const chunks = chunkText(rawContent, 1500)
                    try {
                      const embeddingsRes = await this.openai.embeddings.create({ input: chunks, model: this.ragModel })
                      this.trackUsage(this.ragModel, embeddingsRes.usage)
                      this.currentDocumentChunks = chunks.map((text, idx) => ({ text, embedding: embeddingsRes.data[idx].embedding }))
                      toolResult = `Документ загружен в векторную память (${chunks.length} фрагментов). ИСПОЛЬЗУЙ "search_in_page_content" для поиска.`
                    }
                    catch (e: any) {
                      toolResult = `Ошибка при создании эмбеддингов: ${e.message}`
                    }
                  }
                  else {
                    toolResult = rawContent
                  }
                  break
                }

              case 'search_in_page_content':
                {
                  if (this.currentDocumentChunks.length === 0) {
                    toolResult = 'Ошибка: Векторная база пуста.'
                    break
                  }
                  console.log(pc.blue(`🔍 RAG Поиск: "${args.query}"`))
                  try {
                    const qEmbed = await this.openai.embeddings.create({ input: args.query, model: this.ragModel })
                    this.trackUsage(this.ragModel, qEmbed.usage)
                    const queryVector = qEmbed.data[0].embedding
                    const scored = this.currentDocumentChunks.map(c => ({ text: c.text, score: cosineSimilarity(c.embedding, queryVector) })).sort((a, b) => b.score - a.score)
                    toolResult = `РЕЗУЛЬТАТЫ ПОИСКА:\n${scored.slice(0, 3).map(c => c.text).join('\n\n---\n\n')}`
                  }
                  catch (e: any) {
                    toolResult = `Ошибка эмбеддинга запроса: ${e.message}`
                  }
                  break
                }

              case 'analyze_reviews':
                console.log(pc.blue(`📊 Анализ тональности отзывов (Vibe Check)...`))
                try {
                  const vibeRes = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                      {
                        role: 'system',
                        content: 'Ты аналитик отзывов. Сделай краткую, емкую выжимку по тексту на РУССКОМ языке: 1. Плюсы 2. Минусы 3. Советы/Текущая ситуация. Формат: обычный текст, используй эмодзи для наглядности. ВСЕГДА ОТВЕЧАЙ НА РУССКОМ!',
                      },
                      { role: 'user', content: args.reviewsText },
                    ],
                  })
                  this.trackUsage('gpt-4o-mini', vibeRes.usage)
                  toolResult = `Vibe Check результат:\n${vibeRes.choices[0].message?.content || 'Не удалось проанализировать.'}`
                }
                catch (e: any) {
                  toolResult = `Ошибка анализа: ${e.message}`
                }
                break

              case 'ask_human':
                {
                  console.log(pc.bgMagenta(pc.white(' 👨‍💻 ВОПРОС ОТ ИИ ')))
                  const answer = await text({ message: pc.magenta(args.question), placeholder: 'Ваш ответ...' })
                  if (isCancel(answer))
                    process.exit(0)
                  toolResult = `Ответ пользователя: ${answer}`
                  break
                }

              case 'finish_task':
                console.log(pc.green('✅ Агент успешно собрал данные!'))
                return args as LocationInfo

              default: toolResult = `Unknown tool`
            }
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult })
          }
        }
        else {
          messages.push({ role: 'user', content: 'Пожалуйста, используй инструменты.' })
        }
      }
      console.log(pc.red('❌ Агент превысил лимит шагов.'))
      return null
    }
    catch (e: any) {
      console.log(pc.red(`❌ Ошибка в процессе researchLocation: ${e.message}`))
      return null
    }
  }

  async enrichMarkdown(originalMarkdown: string, collectedData: LocationInfo[]): Promise<string> {
    console.log(pc.cyan('\n📝 Обогащаю Markdown собранными данными...'))

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Ты редактор путеводителей для Obsidian. Дополни Markdown новыми данными.
КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ВЕРНИ ВЕСЬ ИСХОДНЫЙ ТЕКСТ ЦЕЛИКОМ, не обрезай.
2. НЕ ОБОРАЧИВАЙ ответ в теги \`\`\`markdown.
3. Блоки информации о месте вставляй строго ПОСЛЕ соответствующего пункта маршрута со временем.
4. Оформляй новые данные через Obsidian Callouts:

> [!INFO]- Информация: Название
> **Описание:** ...
> **Адрес:** ...
> **На карте:** [Google Maps](https://www.google.com/maps/search/?api=1&query=LAT,LNG)
> **Часы работы:** ...
> **Цена:** ...
> **Атмосфера (Отзывы):** ...
> **Советы:** ...
> **Главный источник:** [Ссылка](ссылка)  

> [!INFO]- Картинки
> ![[название.webp]]`,
        },
        {
          role: 'user',
          content: `ОРИГИНАЛЬНЫЙ ТЕКСТ:\n${originalMarkdown}\n\nСОБРАННЫЕ ДАННЫЕ:\n${JSON.stringify(collectedData, null, 2)}`,
        },
      ],
    })

    this.trackUsage(this.model, response.usage)

    let finalContent = response.choices[0].message.content || originalMarkdown
    finalContent = finalContent.replace(/^```(?:markdown)?\s*\n/i, '').replace(/\n```\s*$/, '').trim()

    if (finalContent.length < originalMarkdown.length * 0.7) {
      console.log(pc.yellow('⚠ ВНИМАНИЕ: LLM урезала текст! Применяю безопасный режим вставки в конец.'))

      const safeAppendBlocks = collectedData.map((data) => {
        const imagesList = (data.localImages || []).map(img => `> ![[${img}]]`).join('\n')
        const mapLink = data.coordinates ? `[Google Maps](https://www.google.com/maps/search/?api=1&query=${data.coordinates.lat},${data.coordinates.lng})` : '-'
        const vibeStr = data.vibe ? `\n> **Атмосфера (Отзывы):** ${data.vibe}` : ''

        return `\n\n> [!INFO]- Информация: ${data.name}\n> **Адрес:** ${data.address || '-'}\n> **На карте:** ${mapLink}\n> **Описание:** ${data.description}\n> **Часы работы:** ${data.workingHours || '-'}\n> **Цена:** ${data.price || '-'}${vibeStr}\n> **Источник:** [Ссылка](${data.siteUrl})\n\n> [!INFO]- Картинки\n${imagesList}`
      }).join('\n')

      return `${originalMarkdown}\n\n## Дополнительная информация от ИИ${safeAppendBlocks}`
    }

    return finalContent
  }
}
