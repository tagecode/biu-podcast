import { AppError } from '@shared/errors'

/** Compare final file size against expected Content-Length / enclosure length. */
export function assertDownloadComplete(
  actualBytes: number,
  expectedBytes: number | null | undefined
): void {
  if (expectedBytes == null || expectedBytes <= 0) return
  if (actualBytes !== expectedBytes) {
    throw new AppError(
      'DOWNLOAD_INCOMPLETE',
      `下载文件不完整（期望 ${expectedBytes} 字节，实际 ${actualBytes} 字节），请重试`
    )
  }
}
