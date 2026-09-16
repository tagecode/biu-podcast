export function dateLocaleFromLang(lang: string | undefined): 'zh-CN' | 'en-US' {
  return lang?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--:--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function formatFileSize(bytes: number | null, lang?: string): string {
  if (!bytes || bytes <= 0) return '--'
  const locale = dateLocaleFromLang(lang)
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1024))} KB`
  }
  return `${new Intl.NumberFormat(locale).format(Number((bytes / (1024 * 1024)).toFixed(0)))} MB`
}

export function formatDate(timestamp: number, lang?: string): string {
  return new Intl.DateTimeFormat(dateLocaleFromLang(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestamp))
}
