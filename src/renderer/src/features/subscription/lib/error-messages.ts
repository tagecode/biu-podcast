import i18n from '@/lib/i18n'
import type { FetchStatus } from '@shared/types'

const CODE_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'subscription.feedErrorNotFound',
  TIMEOUT: 'subscription.feedErrorTimeout',
  PARSE_ERROR: 'subscription.feedErrorParse',
  INVALID_XML: 'subscription.feedErrorInvalidXml',
  NETWORK_ERROR: 'subscription.feedErrorNetwork',
  ALREADY_SUBSCRIBED: 'subscription.feedErrorAlreadySubscribed'
}

const STATUS_MESSAGES: Record<Exclude<FetchStatus, 'ok'>, string> = {
  timeout: CODE_MESSAGES.TIMEOUT,
  parse_error: CODE_MESSAGES.PARSE_ERROR,
  invalid_xml: CODE_MESSAGES.INVALID_XML,
  not_found: CODE_MESSAGES.NOT_FOUND,
  network_error: CODE_MESSAGES.NETWORK_ERROR
}

export function messageForFeedError(codeOrStatus: string): string {
  if (codeOrStatus in CODE_MESSAGES) return i18n.t(CODE_MESSAGES[codeOrStatus])
  if (codeOrStatus in STATUS_MESSAGES) {
    return i18n.t(STATUS_MESSAGES[codeOrStatus as Exclude<FetchStatus, 'ok'>])
  }
  return i18n.t('subscription.feedErrorGeneric')
}
