export function formatMoney(amount: number, currency = 'CNY', locale = 'zh-CN') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount / 100)
}

export function parseMoneyToMinorUnit(value: string) {
  const normalized = value.replace(/[^\d.-]/g, '')
  const numberValue = Number(normalized)
  if (!Number.isFinite(numberValue)) {
    return null
  }
  return Math.round(numberValue * 100)
}
