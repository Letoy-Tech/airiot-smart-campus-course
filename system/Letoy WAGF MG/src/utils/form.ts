import { ref, onUnmounted } from 'vue'

/**
 * 验证码倒计时钩子
 * @param initCount 初始秒数
 */
export function useCountdown(initCount = 60) {
  const count = ref(0)
  const isRunning = ref(false)
  let timer: any = null

  const start = () => {
    if (isRunning.value) return
    count.value = initCount
    isRunning.value = true
    timer = setInterval(() => {
      count.value--
      if (count.value <= 0) {
        stop()
      }
    }, 1000)
  }

  const stop = () => {
    isRunning.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onUnmounted(stop)

  return {
    count,
    isRunning,
    start,
    stop
  }
}
