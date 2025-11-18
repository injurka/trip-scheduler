/* eslint-disable no-console */
// deno-lint-ignore-file no-explicit-any

export enum LogType {
  Log = 'log',
  Info = 'info',
  Error = 'error',
  Success = 'success',
}

export interface Log {
  message: string
  value?: any
  type: LogType
  createdAt?: Date
}

export class Logger {
  logs: Log[] = []

  log = (message: string) => {
    this.logs.push({
      message,
      type: LogType.Log,
      createdAt: new Date(),
    })

    console.log('\x1B[33m%s\x1B[0m', message)
  }

  info = (message: string) => {
    this.logs.push({
      message,
      type: LogType.Info,
      createdAt: new Date(),
    })

    console.log('\x1B[34m%s\x1B[0m', message)
  }

  error = (message: string, value?: any) => {
    this.logs.push({
      message,
      value,
      type: LogType.Error,
      createdAt: new Date(),
    })

    console.log('\x1B[31m%s\x1B[0m', `❌ ${message}`, value)
  }

  success = (message: string) => {
    this.logs.push({
      message,
      type: LogType.Success,
      createdAt: new Date(),
    })

    console.log('\x1B[32m%s\x1B[0m', `✅ ${message}`)
  }
}
