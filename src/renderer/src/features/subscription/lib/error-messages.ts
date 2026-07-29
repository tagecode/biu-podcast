import type { FetchStatus } from '@shared/types'

const CODE_MESSAGES: Record<string, string> = {
  NOT_FOUND: '该订阅源已失效（404），请检查地址是否正确',
  TIMEOUT: '请求超时，请检查网络连接后重试',
  PARSE_ERROR: '无法解析该 RSS Feed，请确认地址是否正确',
  INVALID_XML: 'Feed 返回的 XML 无效，请确认订阅源是否正常',
  NETWORK_ERROR: '当前无网络或连接失败，请稍后重试',
  ALREADY_SUBSCRIBED: '该播客已订阅，无需重复添加'
}

const STATUS_MESSAGES: Record<Exclude<FetchStatus, 'ok'>, string> = {
  timeout: CODE_MESSAGES.TIMEOUT,
  parse_error: CODE_MESSAGES.PARSE_ERROR,
  invalid_xml: CODE_MESSAGES.INVALID_XML,
  not_found: CODE_MESSAGES.NOT_FOUND,
  network_error: CODE_MESSAGES.NETWORK_ERROR
}

export function messageForFeedError(codeOrStatus: string): string {
  if (codeOrStatus in CODE_MESSAGES) return CODE_MESSAGES[codeOrStatus]
  if (codeOrStatus in STATUS_MESSAGES) {
    return STATUS_MESSAGES[codeOrStatus as Exclude<FetchStatus, 'ok'>]
  }
  return '刷新失败，请稍后重试'
}
