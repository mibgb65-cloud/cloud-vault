import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppVariables, Env } from './types/env'
import { handleError } from './middlewares/error.middleware'
import { requestIdMiddleware } from './middlewares/request-id.middleware'
import { initRoutes } from './routes/init.routes'
import { publicRoutes } from './routes/public.routes'
import { authRoutes } from './routes/auth.routes'
import { meRoutes } from './routes/me.routes'
import { adminRoutes } from './routes/admin.routes'
import { booksRoutes } from './routes/books.routes'
import { accountsRoutes } from './routes/accounts.routes'
import { categoriesRoutes } from './routes/categories.routes'
import { tagsRoutes } from './routes/tags.routes'
import { transactionsRoutes } from './routes/transactions.routes'
import { budgetsRoutes } from './routes/budgets.routes'
import { reportsRoutes } from './routes/reports.routes'
import { aiRoutes } from './routes/ai.routes'
import { requireAuth } from './middlewares/auth.middleware'
import { fail } from './utils/response'

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

app.use('*', requestIdMiddleware)
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'Accept-Language'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400
  })
)

app.route('/api/init', initRoutes)
app.route('/api/v1/public', publicRoutes)
app.route('/api/v1/auth', authRoutes)

app.use('/api/v1/me', requireAuth)
app.route('/api/v1/me', meRoutes)

app.use('/api/v1/admin', requireAuth)
app.use('/api/v1/admin/*', requireAuth)
app.route('/api/v1/admin', adminRoutes)

app.use('/api/v1/books', requireAuth)
app.use('/api/v1/books/*', requireAuth)
app.route('/api/v1/books', booksRoutes)
app.route('/api/v1/books/:bookId/accounts', accountsRoutes)
app.route('/api/v1/books/:bookId/categories', categoriesRoutes)
app.route('/api/v1/books/:bookId/tags', tagsRoutes)
app.route('/api/v1/books/:bookId/transactions', transactionsRoutes)
app.route('/api/v1/books/:bookId/budgets', budgetsRoutes)
app.route('/api/v1/books/:bookId/reports', reportsRoutes)
app.route('/api/v1/books/:bookId/ai', aiRoutes)

app.notFound((c) => fail(c, 404, 'NOT_FOUND', '接口不存在'))
app.onError(handleError)

export default app
