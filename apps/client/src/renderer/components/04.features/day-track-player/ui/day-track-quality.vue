<script setup lang="ts">
import type {
  recordingQuality,
  TrackQualityIssue,
} from '@limiteddissolve/track-processing'
import { computed, ref, watch } from 'vue'
import { KitBtn } from '~/components/01.kit/kit-btn'
import { KitDisclosure } from '~/components/01.kit/kit-disclosure'

interface Props {
  quality: ReturnType<typeof recordingQuality>
  timeZone?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ seek: [issue: TrackQualityIssue] }>()

const issueLimit = ref(30)

const visibleIssues = computed(() =>
  props.quality.issues.slice(0, issueLimit.value))

watch(() => props.quality, () => {
  issueLimit.value = 30
})

function duration(ms: number) {
  return `${Math.round(ms / 60000)} мин`
}
function time(ts: number, timeZone?: string) {
  return new Date(ts).toLocaleTimeString('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <section class="track-quality">
    <h3>Качество записи</h3>
    <dl>
      <div>
        <dt>Паузы в записи</dt>
        <dd>
          {{ quality.gapCount }} · {{ duration(quality.gapDurationMs) }} ·
          {{ quality.gapPercent.toFixed(1) }}%
        </dd>
      </div>
      <div>
        <dt>Неточные участки &gt;35 м</dt>
        <dd>
          {{ quality.inaccurateSections }} ·
          {{ duration(quality.inaccurateDurationMs) }} ·
          {{ quality.inaccuratePercent.toFixed(1) }}%
        </dd>
      </div>
      <div>
        <dt>Без данных о точности</dt>
        <dd>{{ quality.unknownAccuracyPoints }} точек</dd>
      </div>
      <div>
        <dt>Ручные исправления</dt>
        <dd>{{ quality.manualCorrections }}</dd>
      </div>
    </dl>
    <p>
      Пауза — промежуток сверх ожидаемой частоты замеров: обычно более 30 с, при
      экономии в покое — более 75 с. Причина неизвестна; потеря GPS не
      подтверждена. Время после последней точки не оценивается.
    </p>
    <KitDisclosure
      v-if="quality.issues.length"
      v-slot="{ open }"
      label="Показать участки"
      :count="quality.issues.length"
    >
      <div v-if="open" class="quality-issues">
        <KitBtn
          v-for="issue in visibleIssues"
          :key="`${issue.sessionId}:${issue.kind}:${issue.startedAt}`"
          variant="text"
          size="sm"
          @click="emit('seek', issue)"
        >
          {{ issue.kind === "pause" ? "Пауза" : "Неточные координаты" }} ·
          {{ time(issue.startedAt, timeZone) }}–{{
            time(issue.endedAt, timeZone)
          }}
        </KitBtn>
        <KitBtn
          v-if="issueLimit < quality.issues.length"
          variant="text"
          size="sm"
          @click="issueLimit += 30"
        >
          Ещё 30 участков
        </KitBtn>
      </div>
    </KitDisclosure>
    <slot />
  </section>
</template>

<style scoped lang="scss">
.track-quality {
  display: grid;
  gap: 10px;
  font-size: 0.8rem;
}
h3,
p {
  margin: 0;
}
p {
  color: var(--fg-secondary-color);
  line-height: 1.5;
}
dl {
  display: grid;
  gap: 8px;
  margin: 0;
}
dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
dt {
  color: var(--fg-secondary-color);
}
dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.quality-issues {
  display: grid;
  max-height: 180px;
  padding: 0 6px 6px;
  overflow: auto;
}
</style>
