import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import pc from 'picocolors'
import sharp from 'sharp'
import { config } from './config.js'

export async function downloadImage(url: string, day: string, index: number, locationName: string, outputDir: string): Promise<string> {
  const imagesDir = path.join(outputDir, 'Images')

  if (!fs.existsSync(imagesDir))
    await fsPromises.mkdir(imagesDir, { recursive: true })

  // eslint-disable-next-line regexp/no-obscure-range
  const safeName = locationName.replace(/\s+/g, '_').replace(/[^\wа-я]/gi, '').toLowerCase()
  const fileName = `day${day}_${safeName}_${index + 1}.webp`
  const filePath = path.join(imagesDir, fileName)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    await sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(filePath)

    console.log(pc.green(`✅ Сохранена картинка: [[${fileName}]]`))
    return fileName
  }
  catch (error: any) {
    if (error.name === 'AbortError' || error.message.includes('abort')) {
      console.error(pc.red(`❌ Таймаут картинки (слишком долгая загрузка): ${url}`))
    }
    else {
      console.error(pc.red(`❌ Ошибка картинки ${url}: ${error.message}`))
    }
    return ''
  }
}

export async function saveLocationData(day: string, data: any, outputDir: string) {
  const dataDir = path.join(outputDir, 'LLM_Data')
  if (!fs.existsSync(dataDir))
    await fsPromises.mkdir(dataDir, { recursive: true })
  const filePath = path.join(dataDir, `day_${day}_data.json`)
  let currentData = []
  try {
    if (fs.existsSync(filePath))
      currentData = JSON.parse(await fsPromises.readFile(filePath, 'utf-8'))
    currentData.push(data)
    await fsPromises.writeFile(filePath, JSON.stringify(currentData, null, 2))
  }
  catch { }
}

export async function getGlobalCache(cachePath: string, key: string): Promise<any | null> {
  try {
    if (!fs.existsSync(cachePath))
      return null
    return JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'))[key] || null
  }
  catch {
    return null
  }
}

export async function saveGlobalCache(cachePath: string, key: string, data: any) {
  try {
    let cache: any = {}
    if (fs.existsSync(cachePath))
      cache = JSON.parse(await fsPromises.readFile(cachePath, 'utf-8'))
    cache[key] = data
    await fsPromises.writeFile(cachePath, JSON.stringify(cache, null, 2))
  }
  catch { }
}

export async function searchMapbox(query: string): Promise<string> {
  const token = config.apiKeys.mapbox
  if (!token)
    return 'Ошибка: mapbox API key не задан в config.json'

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`
    const res = await fetch(url)
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      const f = data.features[0]
      return JSON.stringify({ address: f.place_name, coordinates: { lat: f.center[1], lng: f.center[0] } })
    }
    return 'Ничего не найдено в Mapbox.'
  }
  catch (e: any) {
    return `Ошибка Mapbox: ${e.message}`
  }
}

export function chunkText(text: string, maxLength: number = 1500): string[] {
  // Режем по любым переносам строк
  const paragraphs = text.split(/\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (let p of paragraphs) {
    // ЖЕСТКАЯ РЕЗКА: Если кусок текста сам по себе длиннее лимита (например, нет абзацев)
    while (p.length > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      chunks.push(p.slice(0, maxLength).trim())
      p = p.slice(maxLength)
    }

    if (currentChunk.length + p.length > maxLength) {
      if (currentChunk.trim())
        chunks.push(currentChunk.trim())
      currentChunk = p
    }
    else {
      currentChunk += (currentChunk ? '\n' : '') + p
    }
  }
  if (currentChunk.trim())
    chunks.push(currentChunk.trim())

  return chunks
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0)
    return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
