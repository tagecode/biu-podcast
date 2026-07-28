import { ipcMain, type BrowserWindow } from 'electron'
import type { ZodType } from 'zod'

import { fail, ok, toIpcError } from '@shared/errors'

type IpcHandler<TInput, TOutput> = (
  event: Electron.IpcMainInvokeEvent,
  input: TInput
) => Promise<TOutput> | TOutput

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window
}

export function broadcast(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

export function registerHandler<TInput, TOutput>(
  channel: string,
  schema: ZodType<TInput>,
  handler: IpcHandler<TInput, TOutput>
): void {
  ipcMain.handle(channel, async (event, rawInput: unknown) => {
    try {
      const input = schema.parse(rawInput)
      const data = await handler(event, input)
      return ok(data)
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error) {
        return fail('INVALID_INPUT', '输入参数无效，请检查后重试')
      }
      return fail(toIpcError(error).code, toIpcError(error).message)
    }
  })
}

export function registerVoidHandler<TInput>(
  channel: string,
  schema: ZodType<TInput>,
  handler: IpcHandler<TInput, void>
): void {
  registerHandler(channel, schema, handler)
}

export function registerNoInputHandler<TOutput>(
  channel: string,
  handler: () => Promise<TOutput> | TOutput
): void {
  ipcMain.handle(channel, async () => {
    try {
      const data = await handler()
      return ok(data)
    } catch (error) {
      const ipcError = toIpcError(error)
      return fail(ipcError.code, ipcError.message)
    }
  })
}
