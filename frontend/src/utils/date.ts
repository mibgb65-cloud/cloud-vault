export function dateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function dateTimeInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

export function dateTimeInputValueFromIso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? dateTimeInputValue() : dateTimeInputValue(date)
}

export function dateTimeInputToIso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function dateTimeFromDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`).toISOString()
}

export function monthRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10)
  }
}
