export function toUser(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    email: String(row.email),
    nickname: String(row.nickname),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    defaultCurrency: String(row.default_currency),
    locale: String(row.locale),
    timezone: String(row.timezone),
    systemRole: row.system_role === 'admin' ? 'admin' : 'user',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  }
}

export function toBook(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    type: String(row.type),
    defaultCurrency: String(row.default_currency),
    icon: row.icon ? String(row.icon) : null,
    role: row.role ? String(row.role) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }
}

export function toAccount(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    name: String(row.name),
    type: String(row.type),
    currency: String(row.currency),
    openingBalance: Number(row.opening_balance),
    cachedBalance: Number(row.cached_balance),
    icon: row.icon ? String(row.icon) : null,
    color: row.color ? String(row.color) : null,
    includeInAssets: Number(row.include_in_assets) === 1,
    creditLimit: row.credit_limit == null ? null : Number(row.credit_limit),
    statementDay: row.statement_day == null ? null : Number(row.statement_day),
    repaymentDay: row.repayment_day == null ? null : Number(row.repayment_day),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }
}

export function toCategory(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    name: String(row.name),
    type: String(row.type),
    icon: String(row.icon),
    color: row.color ? String(row.color) : null,
    isSystem: Number(row.is_system) === 1,
    sortOrder: Number(row.sort_order),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }
}

export function toTag(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    name: String(row.name),
    color: row.color ? String(row.color) : null,
    createdAt: String(row.created_at),
    archivedAt: row.archived_at ? String(row.archived_at) : null
  }
}

export function toTransaction(row: Record<string, unknown>, tagIds: string[] = []) {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    type: String(row.type),
    accountId: String(row.account_id),
    transferAccountId: row.transfer_account_id ? String(row.transfer_account_id) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    amount: Number(row.amount),
    currency: String(row.currency),
    baseAmount: Number(row.base_amount),
    baseCurrency: String(row.base_currency),
    occurredAt: String(row.occurred_at),
    dateKey: String(row.date_key),
    note: row.note ? String(row.note) : null,
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    source: String(row.source),
    status: String(row.status),
    accountName: row.account_name ? String(row.account_name) : undefined,
    transferAccountName: row.transfer_account_name ? String(row.transfer_account_name) : undefined,
    categoryName: row.category_name ? String(row.category_name) : undefined,
    categoryIcon: row.category_icon ? String(row.category_icon) : undefined,
    tagIds,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null
  }
}
