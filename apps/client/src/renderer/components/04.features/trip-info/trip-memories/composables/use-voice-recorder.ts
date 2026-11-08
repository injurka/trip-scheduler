import { computed, onBeforeUnmount, ref } from 'vue'

export type VoiceRecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped'

function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined')
    return 'audio/webm'

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate))
      return candidate
  }

  return ''
}

export function useVoiceRecorder() {
  const isSupported = typeof window !== 'undefined'
    && Boolean(navigator?.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined'

  const status = ref<VoiceRecorderStatus>('idle')
  const duration = ref(0)
  const audioBlob = ref<Blob | null>(null)
  const audioUrl = ref<string | null>(null)
  const mimeType = ref<string>('audio/webm')
  const error = ref<string | null>(null)

  let mediaStream: MediaStream | null = null
  let mediaRecorder: MediaRecorder | null = null
  let recordedChunks: Blob[] = []
  let timerId: ReturnType<typeof setInterval> | null = null

  const formattedDuration = computed(() => {
    const mins = Math.floor(duration.value / 60)
    const secs = duration.value % 60

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function startTimer() {
    stopTimer()
    timerId = setInterval(() => {
      duration.value += 1
    }, 1000)
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function cleanupStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
  }

  function cleanupUrl() {
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = null
    }
  }

  async function start(): Promise<boolean> {
    if (!isSupported) {
      error.value = 'Запись голоса не поддерживается в данном браузере или окружении.'

      return false
    }

    reset()
    error.value = null

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const chosenMime = getSupportedMimeType()
      mimeType.value = chosenMime || 'audio/webm'
      mediaRecorder = chosenMime ? new MediaRecorder(mediaStream, { mimeType: chosenMime }) : new MediaRecorder(mediaStream)
      recordedChunks = []

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const finalMime = mediaRecorder?.mimeType || mimeType.value || 'audio/webm'
        const blob = new Blob(recordedChunks, { type: finalMime })
        audioBlob.value = blob

        if (blob.size > 0) {
          cleanupUrl()
          audioUrl.value = URL.createObjectURL(blob)
        }

        cleanupStream()
        status.value = 'stopped'
      }

      mediaRecorder.onerror = () => {
        error.value = 'Произошла ошибка при записи звука.'
        stop()
      }

      mediaRecorder.start(250)
      status.value = 'recording'
      startTimer()

      return true
    }
    catch (err: unknown) {
      cleanupStream()
      const message = err instanceof Error ? err.name : 'UnknownError'

      if (message === 'NotAllowedError' || message === 'PermissionDeniedError') {
        error.value = 'Доступ к микрофону запрещен в настройках браузера или системы.'
      }
      else if (message === 'NotFoundError' || message === 'DevicesNotFoundError') {
        error.value = 'Микрофон не найден на данном устройстве.'
      }
      else {
        error.value = 'Не удалось запустить запись аудио.'
      }

      status.value = 'idle'

      return false
    }
  }

  function pause() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause()
      status.value = 'paused'
      stopTimer()
    }
  }

  function resume() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume()
      status.value = 'recording'
      startTimer()
    }
  }

  function stop() {
    stopTimer()

    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
      mediaRecorder.stop()
    }
    else {
      cleanupStream()
      status.value = audioBlob.value ? 'stopped' : 'idle'
    }
  }

  function reset() {
    stopTimer()

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      }
      catch {
        // ignore
      }
    }

    cleanupStream()
    cleanupUrl()
    recordedChunks = []
    audioBlob.value = null
    duration.value = 0
    error.value = null
    status.value = 'idle'
  }

  onBeforeUnmount(() => {
    reset()
  })

  return {
    isSupported,
    status,
    duration,
    formattedDuration,
    audioBlob,
    audioUrl,
    mimeType,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
