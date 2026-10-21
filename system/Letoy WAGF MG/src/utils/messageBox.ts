import { h, render } from 'vue'
import VMessageBox from '@/components/common/VMessageBox.vue'

export interface MessageBoxOptions {
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

const createMessageBox = (options: MessageBoxOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    
    const vnode = h(VMessageBox, {
      ...options,
      onConfirm: () => {
        render(null, container)
        container.remove()
        resolve()
      },
      onCancel: () => {
        render(null, container)
        container.remove()
        reject(new Error('cancel'))
      }
    })

    render(vnode, container)
    document.body.appendChild(container)
  })
}

export const messageBox = {
  alert: (message: string, title = '提示', type: any = 'info') => 
    createMessageBox({ message, title, type, showCancel: false }),
  
  confirm: (message: string, title = '确认操作', type: any = 'warning') => 
    createMessageBox({ message, title, type, showCancel: true }),
    
  success: (message: string, title = '成功') => 
    createMessageBox({ message, title, type: 'success', showCancel: false }),
    
  danger: (message: string, title = '危险操作') => 
    createMessageBox({ message, title, type: 'danger', showCancel: true })
}
