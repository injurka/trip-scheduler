/* eslint-disable no-console */
// lib/logger.ts
export enum LogType {
  Log = 'log',
  Info = 'info',
  Warn = 'warn',
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

  private ts(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, 23)
  }

  log(message: string) {
    this.logs.push({ message, type: LogType.Log, createdAt: new Date() })
    console.log(`\x1B[2m${this.ts()}\x1B[0m \x1B[33m◆\x1B[0m ${message}`)
  }

  info(message: string) {
    this.logs.push({ message, type: LogType.Info, createdAt: new Date() })
    console.log(`\x1B[2m${this.ts()}\x1B[0m \x1B[34mℹ\x1B[0m ${message}`)
  }

  warn(message: string, value?: any) {
    this.logs.push({ message, value, type: LogType.Warn, createdAt: new Date() })
    console.warn(`\x1B[2m${this.ts()}\x1B[0m \x1B[33m⚠\x1B[0m ${message}`, value ?? '')
  }

  error(message: string, value?: any) {
    this.logs.push({ message, value, type: LogType.Error, createdAt: new Date() })
    console.error(`\x1B[2m${this.ts()}\x1B[0m \x1B[31m✖\x1B[0m ${message}`, value ?? '')
  }

  success(message: string) {
    this.logs.push({ message, type: LogType.Success, createdAt: new Date() })
    console.log(`\x1B[2m${this.ts()}\x1B[0m \x1B[32m✔\x1B[0m ${message}`)
  }
}
