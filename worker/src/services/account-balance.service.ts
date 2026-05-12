export interface BalanceEffect {
  type: 'expense' | 'income' | 'transfer'
  accountId: string
  transferAccountId?: string | null
  amount: number
}

export function balanceStatements(db: D1Database, effect: BalanceEffect, reverse = false) {
  const sign = reverse ? -1 : 1

  if (effect.type === 'income') {
    return [
      db
        .prepare(`UPDATE accounts SET cached_balance = cached_balance + ? WHERE id = ?`)
        .bind(effect.amount * sign, effect.accountId)
    ]
  }

  if (effect.type === 'expense') {
    return [
      db
        .prepare(`UPDATE accounts SET cached_balance = cached_balance - ? WHERE id = ?`)
        .bind(effect.amount * sign, effect.accountId)
    ]
  }

  return [
    db
      .prepare(`UPDATE accounts SET cached_balance = cached_balance - ? WHERE id = ?`)
      .bind(effect.amount * sign, effect.accountId),
    db
      .prepare(`UPDATE accounts SET cached_balance = cached_balance + ? WHERE id = ?`)
      .bind(effect.amount * sign, effect.transferAccountId)
  ]
}
