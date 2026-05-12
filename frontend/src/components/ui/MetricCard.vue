<script setup lang="ts">
defineProps<{
  label: string
  value: string
  tone?: 'default' | 'income' | 'expense' | 'warning'
}>()
</script>

<template>
  <section class="min-h-24 border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-[var(--app-text)]">
    <p class="text-sm font-bold text-[var(--app-muted)]">{{ label }}</p>
    <p
      class="mt-4 truncate font-mono text-2xl font-extrabold leading-none"
      :class="{
        'text-income': tone === 'income',
        'text-expense': tone === 'expense',
        'text-warning': tone === 'warning'
      }"
    >
      {{ value }}
    </p>
  </section>
</template>
