<script setup lang="ts">
const uid = `cv-brand-${Math.random().toString(36).slice(2)}`
const bgId = `${uid}-bg`
const panelId = `${uid}-panel`
const globeId = `${uid}-globe`
const paperId = `${uid}-paper`
const arrowId = `${uid}-arrow`
const goldId = `${uid}-gold`
const coinId = `${uid}-coin`
const shadowId = `${uid}-shadow`
const clipId = `${uid}-clip`
</script>

<template>
  <svg class="block" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="bgId" x1="88" y1="46" x2="422" y2="476" gradientUnits="userSpaceOnUse">
        <stop stop-color="#F8FEFF" />
        <stop offset="0.45" stop-color="#C8F4F2" />
        <stop offset="1" stop-color="#7DC7F2" />
      </linearGradient>
      <radialGradient :id="panelId" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(168 124) rotate(53) scale(324 342)">
        <stop stop-color="#FFFFFF" stop-opacity="0.96" />
        <stop offset="0.56" stop-color="#DDF8F1" stop-opacity="0.72" />
        <stop offset="1" stop-color="#6EB6E8" stop-opacity="0.72" />
      </radialGradient>
      <linearGradient :id="globeId" x1="132" y1="116" x2="386" y2="420" gradientUnits="userSpaceOnUse">
        <stop stop-color="#D8FFE5" />
        <stop offset="0.48" stop-color="#9EE8E0" />
        <stop offset="1" stop-color="#5BA6D9" />
      </linearGradient>
      <linearGradient :id="paperId" x1="126" y1="238" x2="312" y2="424" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFFFFF" />
        <stop offset="1" stop-color="#E4F7FB" />
      </linearGradient>
      <linearGradient :id="arrowId" x1="236" y1="296" x2="418" y2="112" gradientUnits="userSpaceOnUse">
        <stop stop-color="#5CB7F0" />
        <stop offset="0.48" stop-color="#8CE8B0" />
        <stop offset="1" stop-color="#D7FF86" />
      </linearGradient>
      <linearGradient :id="goldId" x1="284" y1="300" x2="386" y2="426" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FFF2A6" />
        <stop offset="0.45" stop-color="#FFC64D" />
        <stop offset="1" stop-color="#F28C24" />
      </linearGradient>
      <linearGradient :id="coinId" x1="260" y1="348" x2="380" y2="444" gradientUnits="userSpaceOnUse">
        <stop stop-color="#E9FBFF" />
        <stop offset="0.52" stop-color="#B8DAE8" />
        <stop offset="1" stop-color="#F3B23F" />
      </linearGradient>
      <filter :id="shadowId" x="54" y="52" width="412" height="414" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="15" stdDeviation="13" flood-color="#123A57" flood-opacity="0.2" />
      </filter>
      <clipPath :id="clipId">
        <rect x="42" y="42" width="428" height="428" rx="88" />
      </clipPath>
    </defs>

    <rect x="35" y="35" width="442" height="442" rx="94" :fill="`url(#${bgId})`" stroke="#133D5B" stroke-width="16" />
    <rect x="57" y="57" width="398" height="398" rx="76" :fill="`url(#${panelId})`" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="8" />

    <g :clip-path="`url(#${clipId})`" :filter="`url(#${shadowId})`">
      <circle cx="258" cy="270" r="184" :fill="`url(#${globeId})`" opacity="0.86" />
      <path d="M86 330c38 78 108 126 183 126 88 0 164-65 189-157" fill="none" stroke="#113D5A" stroke-linecap="round" stroke-width="15" />
      <path d="M106 246c22-87 91-158 174-172 65-11 132 18 178 77" fill="none" stroke="#113D5A" stroke-linecap="round" stroke-width="15" />

      <path d="M139 200l51-45 55 34 47-54 45 28" fill="none" stroke="#143E5E" stroke-linecap="round" stroke-linejoin="round" stroke-width="15" />
      <circle cx="139" cy="200" r="16" fill="#6DB7F2" stroke="#143E5E" stroke-width="10" />
      <circle cx="190" cy="155" r="14" fill="#FFE46B" stroke="#143E5E" stroke-width="10" />
      <circle cx="245" cy="189" r="15" fill="#6DB7F2" stroke="#143E5E" stroke-width="10" />
      <circle cx="292" cy="135" r="15" fill="#8FE8AA" stroke="#143E5E" stroke-width="10" />

      <path d="M217 292l128-128-27-27 113-42-41 116-27-27-119 119z" :fill="`url(#${arrowId})`" stroke="#143E5E" stroke-linejoin="round" stroke-width="13" />

      <path d="M116 238h112c29 0 52 23 52 52v132c-15-17-34-25-60-25H116z" :fill="`url(#${paperId})`" stroke="#143E5E" stroke-linejoin="round" stroke-width="12" />
      <path d="M280 290c0-29 23-52 52-52h66v159h-58c-26 0-45 8-60 25z" :fill="`url(#${paperId})`" stroke="#143E5E" stroke-linejoin="round" stroke-width="12" />
      <path d="M146 278h82M146 309h82M146 340h72M310 278h58M310 309h58M310 340h48" stroke="#9BB9C6" stroke-linecap="round" stroke-width="8" />

      <path d="M176 430l32-105c3-9 12-14 21-11l10 3c9 3 14 12 11 21l-32 105z" fill="#7EC9EE" stroke="#143E5E" stroke-linejoin="round" stroke-width="10" />
      <path d="M176 430l42-28" fill="none" stroke="#143E5E" stroke-linecap="round" stroke-width="9" />

      <rect x="345" y="221" width="89" height="134" rx="18" fill="#E9FAFF" stroke="#143E5E" stroke-width="11" />
      <path d="M345 264h89" stroke="#143E5E" stroke-width="9" />
      <path d="M363 290h19M389 281v19M409 290h17M363 323l18 18M381 323l-18 18M407 332h20" stroke="#FFFFFF" stroke-linecap="round" stroke-width="8" />
      <path d="M356 273h38v38h-38z" fill="#5DB2E7" />
      <path d="M394 273h40v38h-40z" fill="#3B91CA" />
      <path d="M356 311h38v38h-38z" fill="#3B91CA" />
      <path d="M394 311h40v38h-40z" fill="#62C37A" />
      <path d="M386 242c8 8 18 8 26 0M387 242l24-21" fill="none" stroke="#143E5E" stroke-linecap="round" stroke-width="7" />

      <g stroke="#143E5E" stroke-width="10">
        <ellipse cx="342" cy="356" rx="47" ry="18" :fill="`url(#${goldId})`" />
        <path d="M295 356v52c0 10 21 18 47 18s47-8 47-18v-52" :fill="`url(#${goldId})`" />
        <path d="M295 383c0 10 21 18 47 18s47-8 47-18" fill="none" />
        <ellipse cx="407" cy="383" rx="42" ry="16" :fill="`url(#${goldId})`" />
        <path d="M365 383v44c0 9 19 16 42 16s42-7 42-16v-44" :fill="`url(#${goldId})`" />
        <path d="M365 406c0 9 19 16 42 16s42-7 42-16" fill="none" />
        <circle cx="326" cy="428" r="34" :fill="`url(#${coinId})`" />
      </g>
      <path d="M309 415l17 23 17-23M316 430h20M316 441h20M326 437v16" fill="none" stroke="#143E5E" stroke-linecap="round" stroke-linejoin="round" stroke-width="8" />
    </g>
  </svg>
</template>
