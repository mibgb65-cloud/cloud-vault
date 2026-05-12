import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/RegisterView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: () => import('@/components/layout/UserLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/features/dashboard/DashboardView.vue') },
        { path: 'transactions', name: 'transactions', component: () => import('@/features/transactions/TransactionsView.vue') },
        { path: 'accounts', name: 'accounts', component: () => import('@/features/accounts/AccountsView.vue') },
        { path: 'reports', name: 'reports', component: () => import('@/features/reports/ReportsView.vue') },
        { path: 'budgets', name: 'budgets', component: () => import('@/features/budgets/BudgetsView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/features/settings/SettingsView.vue') }
      ]
    },
    {
      path: '/admin',
      component: () => import('@/components/layout/AdminLayout.vue'),
      meta: { admin: true },
      children: [
        { path: '', redirect: '/admin/users' },
        { path: 'users', name: 'admin-users', component: () => import('@/features/admin/AdminUsersView.vue') },
        { path: 'invites', name: 'admin-invites', component: () => import('@/features/admin/AdminInvitesView.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('@/features/admin/AdminSettingsView.vue') }
      ]
    },
    { path: '/403', name: 'forbidden', component: () => import('@/features/auth/ForbiddenView.vue'), meta: { public: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/features/auth/NotFoundView.vue'), meta: { public: true } }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.token && !auth.user) {
    try {
      await auth.loadMe()
    } catch {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  if (to.meta.public && auth.user && (to.name === 'login' || to.name === 'register')) {
    return { name: 'dashboard' }
  }

  if (!to.meta.public && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.admin && auth.user?.systemRole !== 'admin') {
    return { name: 'forbidden' }
  }

  return true
})
