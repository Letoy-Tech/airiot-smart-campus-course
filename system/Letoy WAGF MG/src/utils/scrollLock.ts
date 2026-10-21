/**
 * 引用计数的页面滚动锁。
 *
 * 移动端弹层（抽屉 / 底部选择器 / 对话框）会叠加出现，例如在抽屉表单里
 * 打开下拉选择。若每个组件各自设置与清除 body.overflow，
 * 内层弹层关闭时会把外层仍需要的锁一并解除，导致背景列表跟着手指滚动。
 * 这里用计数保证「全部弹层关闭后」才真正解锁。
 */
let lockCount = 0
let previousOverflow = ''

export function lockBodyScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function unlockBodyScroll() {
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow
  }
}

/** 根据开关状态自动加锁 / 解锁，返回当前是否持有锁 */
export function setBodyScrollLock(locked: boolean, held: boolean) {
  if (locked && !held) {
    lockBodyScroll()
    return true
  }
  if (!locked && held) {
    unlockBodyScroll()
    return false
  }
  return held
}
