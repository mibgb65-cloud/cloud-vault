import { expect, test, type Page, type Route } from '@playwright/test'

const now = '2026-05-11T12:00:00.000Z'
const bookId = 'book_visual'

function ok(data: unknown) {
  return {
    code: 'OK',
    message: 'ok',
    data,
    requestId: 'req_visual',
    timestamp: now
  }
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(ok(data))
  })
}

async function mockApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('cloud-vault-token', 'visual-token')
    window.localStorage.setItem('cloud-vault-book-id', 'book_visual')
  })

  await page.route('**/api/v1/me', (route) =>
    fulfill(route, {
      user: {
        id: 'user_visual',
        email: 'visual@example.com',
        nickname: 'Visual',
        avatarUrl: null,
        defaultCurrency: 'CNY',
        locale: 'zh-CN',
        timezone: 'Asia/Shanghai',
        systemRole: 'admin',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      }
    })
  )

  await page.route('**/api/v1/books', (route) =>
    fulfill(route, {
      items: [
        {
          id: bookId,
          ownerUserId: 'user_visual',
          name: '我的账本',
          type: 'personal',
          defaultCurrency: 'CNY',
          icon: 'book-open',
          role: 'owner',
          createdAt: now,
          updatedAt: now
        }
      ]
    })
  )

  await page.route(`**/api/v1/books/${bookId}/accounts`, (route) =>
    fulfill(route, {
      items: [
        {
          id: 'acc_wallet',
          bookId,
          createdBy: 'user_visual',
          name: '微信钱包',
          type: 'ewallet',
          currency: 'CNY',
          openingBalance: 0,
          cachedBalance: 235600,
          icon: 'wallet',
          color: '#111111',
          includeInAssets: true,
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'acc_card',
          bookId,
          createdBy: 'user_visual',
          name: '银行卡',
          type: 'bank',
          currency: 'CNY',
          openingBalance: 0,
          cachedBalance: 860000,
          icon: 'credit-card',
          color: '#111111',
          includeInAssets: true,
          createdAt: now,
          updatedAt: now
        }
      ]
    })
  )

  await page.route(`**/api/v1/books/${bookId}/categories**`, (route) =>
    fulfill(route, {
      items: [
        { id: 'cat_food', bookId, name: '餐饮', type: 'expense', icon: 'utensils', color: '#111111', sortOrder: 1, createdAt: now, updatedAt: now },
        { id: 'cat_transport', bookId, name: '交通', type: 'expense', icon: 'train', color: '#111111', sortOrder: 2, createdAt: now, updatedAt: now },
        { id: 'cat_salary', bookId, name: '工资', type: 'income', icon: 'wallet', color: '#15803D', sortOrder: 1, createdAt: now, updatedAt: now }
      ]
    })
  )

  await page.route(`**/api/v1/books/${bookId}/transactions**`, (route) =>
    fulfill(route, {
      items: [
        {
          id: 'txn_lunch',
          bookId,
          type: 'expense',
          amount: 3500,
          currency: 'CNY',
          accountId: 'acc_wallet',
          accountName: '微信钱包',
          categoryId: 'cat_food',
          categoryName: '餐饮',
          transferAccountId: null,
          transferAccountName: null,
          merchantName: null,
          note: '午饭',
          tagIds: [],
          occurredAt: now,
          dateKey: '2026-05-11',
          createdBy: 'user_visual',
          createdAt: now,
          updatedAt: now
        }
      ],
      nextCursor: null
    })
  )

  await page.route(`**/api/v1/books/${bookId}/reports/summary**`, (route) =>
    fulfill(route, {
      income: 1200000,
      expense: 235000,
      balance: 965000,
      netAssets: 1095600
    })
  )

  await page.route(`**/api/v1/books/${bookId}/ai/parse-transaction`, (route) =>
    fulfill(route, {
      draft: {
        type: 'expense',
        amount: '35',
        date: '2026-05-11',
        accountId: 'acc_wallet',
        categoryId: 'cat_food',
        transferAccountId: '',
        note: '午饭35 微信 今天',
        merchantName: null,
        confidence: 0.92,
        provider: 'deepseek'
      }
    })
  )
}

test('dashboard visual density and natural entry parser', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByText('我的账本').first()).toBeVisible()
  await expect(page.locator('.boot-screen')).toHaveCount(0)
  await expect(page.getByText('午饭').first()).toBeVisible()
  await expect(page.getByText('微信钱包').first()).toBeVisible()
  await page.getByPlaceholder('输入账单，如：午饭35、微信买菜25.5').fill('午饭35 微信 今天')
  await page.getByTitle('解析账单').click()
  await expect(page.getByPlaceholder('0.00')).toHaveValue('35')
  await page.locator('body').click({ position: { x: 12, y: 12 } })
  await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true, animations: 'disabled' })
})

test('transactions workspace keeps dense three-column structure', async ({ page }) => {
  await mockApi(page)
  await page.goto('/transactions')
  await expect(page.locator('.boot-screen')).toHaveCount(0)
  await expect(page.getByText('账单工作台')).toBeVisible()
  await expect(page.getByText('账单列表')).toBeVisible()
  await expect(page.getByText('午饭').first()).toBeVisible()
  await expect(page).toHaveScreenshot('transactions.png', { fullPage: true, animations: 'disabled' })
})

test('accounts workspace keeps dense four-column structure', async ({ page }) => {
  await mockApi(page)
  await page.goto('/accounts')
  await expect(page.locator('.boot-screen')).toHaveCount(0)
  await expect(page.getByText('账户工作台')).toBeVisible()
  await expect(page.getByText('账户列表')).toBeVisible()
  await expect(page.getByText('微信钱包').first()).toBeVisible()
  await expect(page).toHaveScreenshot('accounts.png', { fullPage: true, animations: 'disabled' })
})

test('theme switch does not create horizontal overflow', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByText('我的账本').first()).toBeVisible()
  await expect(page.locator('.boot-screen')).toHaveCount(0)
  await page.getByTitle('暗色').click()
  await page.waitForTimeout(450)
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth)
  expect(hasHorizontalOverflow).toBe(false)
})
