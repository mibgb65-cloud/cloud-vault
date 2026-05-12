<template>
  <main class="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 text-[var(--app-text)]">
    <section class="max-w-md border-t border-[var(--app-border)] py-8 text-center">
      <p class="font-mono text-4xl font-extrabold">403</p>
      <p class="mt-3 text-sm font-medium text-[var(--app-muted)]">当前账号无权访问该页面。</p>
      <RouterLink class="mt-5 inline-flex h-10 items-center border border-[var(--app-border)] bg-[var(--app-inverse)] px-4 text-sm font-bold text-[var(--app-inverse-text)]" to="/">
        返回首页
      </RouterLink>
    </section>
  </main>
</template>
