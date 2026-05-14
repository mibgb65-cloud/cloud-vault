import type { Account, Category, TransactionType } from '@/types/domain'

export interface StatementImportContext {
  accounts: Account[]
  categories: Category[]
  defaultAccountId: string
  defaultExpenseCategoryId: string
  defaultIncomeCategoryId: string
}

export interface StatementImportDraft {
  id: string
  provider: 'alipay' | 'wechat'
  occurredAt: string
  type: Exclude<TransactionType, 'transfer'>
  amount: number
  accountId: string
  categoryId: string
  merchantName: string | null
  note: string | null
  sourceRef: string
  rawCategory: string
  rawStatus: string
  valid: boolean
  reason: string | null
}

type SheetRow = string[]

const UTF8_BOM = /^\uFEFF/
const excelEpoch = Date.UTC(1899, 11, 30)

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function rowToRecord(headers: string[], row: string[]) {
  const record: Record<string, string> = {}
  for (const [index, header] of headers.entries()) {
    const key = header.trim()
    if (key) {
      record[key] = (row[index] ?? '').trim()
    }
  }
  return record
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^\d.-]/g, '')
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }
  return Math.round(amount * 100)
}

function localChinaTimeToIso(value: string) {
  const normalized = value.trim().replace(/\//g, '-').replace(' ', 'T')
  const date = new Date(`${normalized}+08:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function excelSerialToChinaIso(value: string) {
  const serial = Number(value)
  if (!Number.isFinite(serial)) {
    return localChinaTimeToIso(value)
  }
  const date = new Date(excelEpoch + serial * 24 * 60 * 60 * 1000)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`).toISOString()
}

function normalizeSourceRef(provider: 'alipay' | 'wechat', value: string) {
  const ref = value.trim().replace(/\s+/g, '')
  return ref ? `${provider}:${ref}`.slice(0, 200) : ''
}

function matchAccount(method: string, context: StatementImportContext) {
  const source = method.toLowerCase()
  return (
    context.accounts.find((account) => source && (account.name.toLowerCase().includes(source) || source.includes(account.name.toLowerCase())))?.id ??
    context.accounts.find((account) => source.includes('花呗') && account.type === 'credit_card')?.id ??
    context.accounts.find((account) => source.includes('零钱') && /微信|零钱/.test(account.name))?.id ??
    context.accounts.find((account) => source.includes('余额宝') && /余额宝|支付宝/.test(account.name))?.id ??
    context.defaultAccountId
  )
}

function categoryKeywords(source: string, type: Exclude<TransactionType, 'transfer'>) {
  const value = source.toLowerCase()
  const candidates: string[] = []
  if (/餐|饭|咖啡|美食|外卖|奶茶/.test(value)) candidates.push('餐饮')
  if (/交通|出行|地铁|公交|打车|火车|机票/.test(value)) candidates.push('交通')
  if (/购物|百货|超市|淘宝|京东|拼多多|电商/.test(value)) candidates.push('购物')
  if (/住房|房租|物业|水电|燃气/.test(value)) candidates.push('住房')
  if (/医疗|医院|药/.test(value)) candidates.push('医疗')
  if (/娱乐|游戏|电影|会员/.test(value)) candidates.push('娱乐')
  if (/教育|课程|学习/.test(value)) candidates.push('教育')
  if (/通讯|话费|流量|宽带/.test(value)) candidates.push('通讯')
  if (/工资|薪资/.test(value)) candidates.push('工资')
  if (/奖金/.test(value)) candidates.push('奖金')
  if (/退款|退货/.test(value)) candidates.push('退款')
  if (/红包|转账/.test(value) && type === 'income') candidates.push('红包')
  candidates.push('其他')
  return candidates
}

function matchCategory(rawCategory: string, description: string, type: Exclude<TransactionType, 'transfer'>, context: StatementImportContext) {
  const categories = context.categories.filter((category) => category.type === type)
  const source = `${rawCategory} ${description}`.trim()
  const exact = source
    ? categories.find((category) => source.includes(category.name) || (rawCategory && category.name.includes(rawCategory)))
    : null
  if (exact) {
    return exact.id
  }

  for (const keyword of categoryKeywords(source, type)) {
    const matched = categories.find((category) => category.name.includes(keyword) || keyword.includes(category.name))
    if (matched) {
      return matched.id
    }
  }

  return type === 'expense' ? context.defaultExpenseCategoryId : context.defaultIncomeCategoryId
}

function statusIsImportable(status: string) {
  return !/关闭|失败|撤销/.test(status) && /成功|已收钱|已存入|已完成/.test(status)
}

function buildDraft(
  provider: 'alipay' | 'wechat',
  index: number,
  input: {
    occurredAt: string
    io: string
    amount: string
    method: string
    rawCategory: string
    description: string
    merchantName: string
    status: string
    sourceRef: string
    noteParts: string[]
  },
  context: StatementImportContext
): StatementImportDraft {
  const type = input.io === '收入' ? 'income' : 'expense'
  const amount = parseAmount(input.amount)
  const accountId = matchAccount(input.method, context)
  const categoryId = matchCategory(input.rawCategory, input.description, type, context)
  const invalidReason =
    input.io !== '收入' && input.io !== '支出'
      ? '不计收支'
      : !input.occurredAt
        ? '时间无效'
        : !input.sourceRef
          ? '缺少订单号'
        : !statusIsImportable(input.status)
        ? `状态不导入：${input.status || '-'}`
        : !amount
          ? '金额无效'
          : !accountId
            ? '缺少账户'
            : !categoryId
              ? '缺少分类'
              : null

  return {
    id: `${provider}-${index}`,
    provider,
    occurredAt: input.occurredAt,
    type,
    amount,
    accountId,
    categoryId,
    merchantName: input.merchantName || null,
    note: input.noteParts.filter(Boolean).join(' / ') || null,
    sourceRef: input.sourceRef,
    rawCategory: input.rawCategory,
    rawStatus: input.status,
    valid: !invalidReason,
    reason: invalidReason
  }
}

async function parseAlipayCsv(file: File, context: StatementImportContext) {
  const buffer = await file.arrayBuffer()
  const decoder = new TextDecoder('gb18030')
  const text = decoder.decode(buffer).replace(UTF8_BOM, '')
  const rows = parseCsv(text)
  const headerIndex = rows.findIndex((row) => row[0]?.trim() === '交易时间')
  if (headerIndex < 0) {
    throw new Error('没有找到支付宝账单表头')
  }

  const headers = rows[headerIndex]
  return rows.slice(headerIndex + 1).filter((row) => row.some(Boolean)).map((row, index) => {
    const record = rowToRecord(headers, row)
    const orderNo = record['交易订单号'] || record['商家订单号']
    return buildDraft(
      'alipay',
      index,
      {
        occurredAt: localChinaTimeToIso(record['交易时间']),
        io: record['收/支'],
        amount: record['金额'],
        method: record['收/付款方式'],
        rawCategory: record['交易分类'],
        description: record['商品说明'],
        merchantName: record['交易对方'],
        status: record['交易状态'],
        sourceRef: normalizeSourceRef('alipay', orderNo),
        noteParts: [record['商品说明'], record['备注'], orderNo ? `支付宝订单 ${orderNo}` : '']
      },
      context
    )
  })
}

function readUInt16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUInt32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

async function inflateRaw(data: Uint8Array) {
  if (!('DecompressionStream' in window)) {
    throw new Error('当前浏览器不支持直接解析 XLSX，请先将微信账单另存为 CSV')
  }
  const buffer = data.buffer instanceof ArrayBuffer
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : new Uint8Array(data).buffer
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readZipEntries(buffer: ArrayBuffer, wanted: string[]) {
  const bytes = new Uint8Array(buffer)
  let eocd = -1
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (readUInt32(bytes, index) === 0x06054b50) {
      eocd = index
      break
    }
  }
  if (eocd < 0) {
    throw new Error('XLSX 文件结构无效')
  }

  const count = readUInt16(bytes, eocd + 10)
  let offset = readUInt32(bytes, eocd + 16)
  const decoder = new TextDecoder()
  const output = new Map<string, string>()

  for (let i = 0; i < count; i += 1) {
    if (readUInt32(bytes, offset) !== 0x02014b50) {
      throw new Error('XLSX 中央目录无效')
    }
    const method = readUInt16(bytes, offset + 10)
    const compressedSize = readUInt32(bytes, offset + 20)
    const nameLength = readUInt16(bytes, offset + 28)
    const extraLength = readUInt16(bytes, offset + 30)
    const commentLength = readUInt16(bytes, offset + 32)
    const localOffset = readUInt32(bytes, offset + 42)
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength

    if (!wanted.includes(name)) {
      continue
    }

    const localNameLength = readUInt16(bytes, localOffset + 26)
    const localExtraLength = readUInt16(bytes, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null
    if (!data) {
      throw new Error('XLSX 使用了暂不支持的压缩方式')
    }
    output.set(name, decoder.decode(data))
  }

  return output
}

function parseSharedStrings(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t')).map((node) => node.textContent || '').join('')
  )
}

function columnNameToIndex(reference: string | null) {
  const letters = reference?.match(/^[A-Z]+/i)?.[0].toUpperCase()
  if (!letters) {
    return -1
  }

  let index = 0
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64
  }
  return index - 1
}

function sheetCellText(cell: Element, shared: string[]) {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagName('t')).map((node) => node.textContent || '').join('')
  }
  const value = cell.getElementsByTagName('v')[0]?.textContent || ''
  return type === 's' ? shared[Number(value)] || '' : value
}

function parseSheet(xml: string, shared: string[]): SheetRow[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('row')).map((row) => {
    const values: string[] = []
    let nextIndex = 0
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const explicitIndex = columnNameToIndex(cell.getAttribute('r'))
      const index = explicitIndex >= 0 ? explicitIndex : nextIndex
      values[index] = sheetCellText(cell, shared)
      nextIndex = index + 1
    }
    return values.map((value) => value ?? '')
  })
}

async function parseWechatXlsx(file: File, context: StatementImportContext) {
  const entries = await readZipEntries(await file.arrayBuffer(), ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml'])
  const shared = parseSharedStrings(entries.get('xl/sharedStrings.xml') || '')
  const rows = parseSheet(entries.get('xl/worksheets/sheet1.xml') || '', shared)
  const headerIndex = rows.findIndex((row) => row[0]?.trim() === '交易时间')
  if (headerIndex < 0) {
    throw new Error('没有找到微信账单表头')
  }

  const headers = rows[headerIndex]
  return rows.slice(headerIndex + 1).filter((row) => row.some(Boolean)).map((row, index) => {
    const record = rowToRecord(headers, row)
    const orderNo = record['交易单号'] || record['商户单号']
    return buildDraft(
      'wechat',
      index,
      {
        occurredAt: excelSerialToChinaIso(record['交易时间']),
        io: record['收/支'],
        amount: record['金额(元)'],
        method: record['支付方式'],
        rawCategory: record['交易类型'],
        description: record['商品'],
        merchantName: record['交易对方'],
        status: record['当前状态'],
        sourceRef: normalizeSourceRef('wechat', orderNo),
        noteParts: [record['商品'], record['备注'], orderNo ? `微信单号 ${orderNo}` : '']
      },
      context
    )
  })
}

export async function parseStatementFile(file: File, context: StatementImportContext) {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.csv')) {
    return parseAlipayCsv(file, context)
  }
  if (lowerName.endsWith('.xlsx')) {
    return parseWechatXlsx(file, context)
  }
  throw new Error('仅支持支付宝 CSV 和微信 XLSX')
}
