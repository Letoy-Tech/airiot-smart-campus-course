import { h, render } from 'vue'
import VToast from '@/components/common/VToast.vue'

export interface ToastOptions {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const createToast = (options: ToastOptions) => {
  const container = document.createElement('div')
  
  const vnode = h(VToast, {
    ...options,
    onDestroy: () => {
      render(null, container)
      container.remove()
    }
  })

  render(vnode, container)
  document.body.appendChild(container)
}

export const toast = {
  success: (msg: string) => createToast({ message: msg, type: 'success' }),
  error: (msg: string) => createToast({ message: msg, type: 'error' }),
  warning: (msg: string) => createToast({ message: msg, type: 'warning' }),
  info: (msg: string) => createToast({ message: msg, type: 'info' })
}
