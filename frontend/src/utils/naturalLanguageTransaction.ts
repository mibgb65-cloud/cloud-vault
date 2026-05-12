import type { Account, Category, TransactionType } from '@/types/domain'

interface ParseContext {
  accounts: Account[]
  categories: Category[]
  today: string
}

export interface NaturalTransactionDraft {
  type: TransactionType
  amount: string
  date: string
  accountId: string
  categoryId: string
  transferAccountId: string
  note: string
  summary: string
}

const incomeWords = ['收入', '工资', '奖金', '报销', '收款', '入账', '利息', '分红']
const transferWords = ['转账', '转给', '转入', '转出', '还款']
const categoryKeywords: Record<string, string[]> = {
  餐饮: ['饭', '早餐', '午饭', '晚饭', '外卖', '咖啡', '奶茶', '餐', '吃'],
  交通: ['地铁', '公交', '打车', '加油', '停车', '高铁', '机票'],
  购物: ['买', '购物', '淘宝', '京东', '拼多多'],
  住房: ['房租', '水电', '物业', '宽带'],
  医疗: ['医院', '药', '挂号', '体检'],
  娱乐: ['电影', '游戏', '演出', '会员'],
  通讯: ['话费', '流量', '手机费'],
  工资: ['工资', '薪水', '薪资'],
  奖金: ['奖金', '绩效'],
  报销: ['报销'],
  退款: ['退款', '退回']
}

function addDays(dateKey: string, delta: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + delta)
  return date.toISOString().slice(0, 10)
}

function parseDate(text: string, today: string) {
  if (text.includes('前天')) {
    return addDays(today, -2)
  }
  if (text.includes('昨天')) {
    return addDays(today, -1)
  }
  if (text.includes('今天')) {
    return today
  }

  const monthDay = text.match(/(\d{1,2})\s*(?:月|\/|-)\s*(\d{1,2})/)
  if (!monthDay) {
    return today
  }

  const year = today.slice(0, 4)
  const month = monthDay[1].padStart(2, '0')
  const day = monthDay[2].padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseAmount(text: string) {
  const match = text.match(/(?:￥|¥)?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)?/)
  return match?.[1] ?? ''
}

function inferType(text: string): TransactionType {
  if (transferWords.some((word) => text.includes(word))) {
    return 'transfer'
  }
  if (incomeWords.some((word) => text.includes(word))) {
    return 'income'
  }
  return 'expense'
}

function findAccount(text: string, accounts: Account[], excludeId?: string) {
  return accounts.find((account) => account.id !== excludeId && text.includes(account.name))
}

function findCategory(text: string, categories: Category[], type: TransactionType) {
  if (type === 'transfer') {
    return undefined
  }

  const typedCategories = categories.filter((category) => category.type === type)
  const direct = typedCategories.find((category) => text.includes(category.name))
  if (direct) {
    return direct
  }

  return typedCategories.find((category) => categoryKeywords[category.name]?.some((word) => text.includes(word)))
}

export function parseNaturalTransaction(text: string, context: ParseContext): NaturalTransactionDraft | null {
  const source = text.trim()
  const amount = parseAmount(source)
  if (!source || !amount) {
    return null
  }

  const type = inferType(source)
  const account = findAccount(source, context.accounts)
  const transferAccount = type === 'transfer' ? findAccount(source, context.accounts, account?.id) : undefined
  const category = findCategory(source, context.categories, type)
  const date = parseDate(source, context.today)

  return {
    type,
    amount,
    date,
    accountId: account?.id ?? '',
    transferAccountId: transferAccount?.id ?? '',
    categoryId: category?.id ?? '',
    note: source,
    summary: [type === 'income' ? '收入' : type === 'transfer' ? '转账' : '支出', amount, category?.name || transferAccount?.name || '待确认']
      .filter(Boolean)
      .join(' / ')
  }
}
