import type { DocumentCategoryMeta } from '../models/types'

export const DOCUMENT_CATEGORIES: DocumentCategoryMeta[] = [
  { id: 'tickets', label: 'Билеты', icon: 'mdi:ticket-confirmation-outline', color: '#3b82f6' },
  { id: 'lodging', label: 'Отели / Жильё', icon: 'mdi:bed-outline', color: '#8b5cf6' },
  { id: 'transport', label: 'Транспорт', icon: 'mdi:train-car', color: '#06b6d4' },
  { id: 'id', label: 'Паспорта / Визы', icon: 'mdi:card-account-details-outline', color: '#10b981' },
  { id: 'insurance', label: 'Страховка', icon: 'mdi:shield-check-outline', color: '#f59e0b' },
  { id: 'other', label: 'Прочее', icon: 'mdi:file-document-outline', color: '#64748b' },
]

export function getCategoryMeta(category?: string | null): DocumentCategoryMeta | undefined {
  if (!category)
    return undefined
  return DOCUMENT_CATEGORIES.find(c => c.id === category)
}

export function getFileTypeInfo(extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '')
  if (['pdf'].includes(ext)) {
    return {
      type: 'pdf',
      label: 'PDF документ',
      icon: 'mdi:file-pdf-box',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      badgeColor: '#ef4444',
    }
  }
  if (['doc', 'docx', 'rtf'].includes(ext)) {
    return {
      type: 'doc',
      label: 'Текстовый документ',
      icon: 'mdi:file-word-box',
      color: '#2563eb',
      bgColor: 'rgba(37, 99, 235, 0.1)',
      badgeColor: '#2563eb',
    }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'sheet',
      label: 'Таблица',
      icon: 'mdi:file-excel-box',
      color: '#16a34a',
      bgColor: 'rgba(22, 163, 74, 0.1)',
      badgeColor: '#16a34a',
    }
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'heic'].includes(ext)) {
    return {
      type: 'image',
      label: 'Изображение',
      icon: 'mdi:file-image',
      color: '#a855f7',
      bgColor: 'rgba(168, 85, 247, 0.1)',
      badgeColor: '#a855f7',
    }
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      type: 'archive',
      label: 'Архив',
      icon: 'mdi:folder-zip-outline',
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.1)',
      badgeColor: '#f97316',
    }
  }
  if (['txt', 'md', 'json'].includes(ext)) {
    return {
      type: 'text',
      label: 'Заметка / Текст',
      icon: 'mdi:file-document-outline',
      color: '#0ea5e9',
      bgColor: 'rgba(14, 165, 233, 0.1)',
      badgeColor: '#0ea5e9',
    }
  }
  return {
    type: 'other',
    label: 'Файл',
    icon: 'mdi:file-outline',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    badgeColor: '#64748b',
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0)
    return '0 Байт'
  const k = 1024
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(decimals))} ${sizes[i]}`
}
