import type { RouterInput, RouterOutput } from '../trpc'

/**
 * Определяет, к какой сущности относится комментарий.
 * Значения должны быть синхронизированы с `commentParentTypeEnum` на бэкенде.
 */
export enum CommentParentType {
  TRIP = 'trip',
  DAY = 'day',
}

/**
 * Тип комментария, выведенный из ответа tRPC-процедуры.
 * Это гарантирует, что тип на фронтенде всегда соответствует тому, что возвращает API.
 */
export type Comment = RouterOutput['comment']['list'][number]

/**
 * Тип для создания нового комментария.
 */
export type CreateCommentInput = RouterInput['comment']['create']

/**
 * Тип для обновления комментария.
 */
export type UpdateCommentInput = RouterInput['comment']['update']
