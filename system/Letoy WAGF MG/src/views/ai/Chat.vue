<template>
  <div class="ai-chat-page">
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="ai-profile">
          <div class="ai-avatar"><i class="ri-robot-2-fill"></i></div>
          <div class="ai-info">
            <div class="ai-name">Letoy Pro Assistant</div>
            <div class="ai-status"><span class="pulse-dot"></span> 流式响应 + Markdown 渲染</div>
          </div>
        </div>
        <div class="header-actions">
          <AppButton type="ghost" size="sm" @click="handleClear">
            <template #icon><i class="ri-delete-bin-7-line"></i></template>清空历史
          </AppButton>
        </div>
      </div>

      <!-- Messages Body -->
      <div class="messages-viewport" ref="messageViewport">
        <div v-if="messages.length === 0" class="welcome-guide">
          <div class="guide-icon"><i class="ri-sparkling-2-fill"></i></div>
          <h2>有什么我可以帮您的吗？</h2>
          <p>我是系统内置的智能助理，支持 Markdown 渲染和代码高亮。</p>
          <div class="suggested-questions">
            <div v-for="q in suggestions" :key="q" class="suggestion-item" @click="handleSuggest(q)">{{ q }}</div>
          </div>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="message-wrapper" :class="msg.role">
          <div class="message-avatar" :style="msg.role === 'user' ? { background: avatarGradient } : {}">
            <i v-if="msg.role === 'ai'" class="ri-robot-2-line"></i>
            <span v-else>{{ authStore.user?.nickname?.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="message-bubble">
            <div class="message-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <div class="message-time">{{ formatSmartDateTime(msg.time, nowTick) }}</div>
          </div>
        </div>

        <div v-if="loading && !currentAiMsg" class="message-wrapper ai">
          <div class="message-avatar"><i class="ri-robot-2-line"></i></div>
          <div class="message-bubble loading-bubble">
            <div class="typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div class="input-wrapper">
          <textarea
            v-model="inputMsg"
            placeholder="请输入您的问题..."
            rows="1"
            ref="textareaRef"
            @keydown.enter="handleEnter"
          ></textarea>
          <div class="input-actions">
            <button class="send-btn" :disabled="!inputMsg.trim() || loading" @click="sendMessage">
              <i class="ri-send-plane-2-fill"></i>
            </button>
          </div>
        </div>
        <div class="input-footer-tip">Powered by Alibaba DashScope & Spring AI</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useAuthStore } from '@/store/auth'
import { streamChatMessage } from '@/api/ai'
import { formatSmartDateTime } from '@/utils/datetime'
import { renderMarkdown } from '@/utils/markdown'
import { toast } from '@/utils/toast'
import { messageBox } from '@/utils/messageBox'
import AppButton from '@/components/common/AppButton.vue'
import { useIsMobile } from '@/utils/responsive'

const authStore = useAuthStore()
const isMobile = useIsMobile()
const inputMsg = ref('')
const loading = ref(false)
const messageViewport = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const nowTick = ref(Date.now())

// 改用 ref 管理数组，清空逻辑更稳健
const messages = ref<any[]>([])
const currentAiMsg = ref<any>(null)

const suggestions = ['帮我写一段 Java 查询代码', '解释一下 Markdown 是什么', '系统如何配置角色？', '写一篇关于 AI 助手的周报']

const avatarGradient = computed(() => {
  const name = authStore.user?.username || 'admin'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return `linear-gradient(135deg, hsl(${hash % 360}, 70%, 60%), hsl(${(hash + 40) % 360}, 70%, 50%))`
})

const scrollToBottom = () => {
  nextTick(() => {
    if (messageViewport.value) messageViewport.value.scrollTop = messageViewport.value.scrollHeight
  })
}

const sendMessage = async () => {
  if (!inputMsg.value.trim() || loading.value) return
  const userText = inputMsg.value.trim()

  messages.value.push({
    role: 'user',
    content: userText,
    time: new Date().toISOString()
  })

  inputMsg.value = ''
  loading.value = true
  currentAiMsg.value = null
  scrollToBottom()

  try {
    await streamChatMessage(
      { message: userText },
      (delta) => {
        if (!currentAiMsg.value) {
          currentAiMsg.value = {
            role: 'ai',
            content: '',
            time: new Date().toISOString()
          }
          messages.value.push(currentAiMsg.value)
        }
        currentAiMsg.value.content += delta
        scrollToBottom()
      },
      (err) => {
        toast.error('AI 服务请求失败')
        loading.value = false
      },
      () => {
        loading.value = false
        currentAiMsg.value = null
        scrollToBottom()
      }
    )
  } catch (e) {
    loading.value = false
  }
}

/**
 * 桌面端 Enter 发送、Shift+Enter 换行；
 * 移动端软键盘的 Enter 是换行键，拦截它会让用户无法输入多行，故不接管。
 */
const handleEnter = (e: KeyboardEvent) => {
  if (isMobile.value || e.shiftKey || e.isComposing) return
  e.preventDefault()
  sendMessage()
}

const handleSuggest = (q: string) => {
  inputMsg.value = q
  sendMessage()
}

const handleClear = async () => {
  try {
    await messageBox.danger('确定要清空所有聊天记录吗？', '清空历史')
    // 直接重置数组引用，Vue 3 的 ref 会完美触发响应式更新
    messages.value = []
    currentAiMsg.value = null
    toast.success('历史记录已清空')
  } catch (e) {
    // 取消时不执行
  }
}

watch(inputMsg, () => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
    }
  })
})

let nowTimer: number | undefined

onMounted(() => {
  scrollToBottom()
  nowTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (nowTimer) window.clearInterval(nowTimer)
})
</script>

<style scoped>
.ai-chat-page { height: calc(100vh - var(--header-height) - 48px); display: flex; justify-content: center; }
@supports (height: 100dvh) {
  .ai-chat-page { height: calc(100dvh - var(--header-height) - 48px); }
}
.chat-container { width: 100%; background-color: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--glass-shadow); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-light); }
.chat-header { padding: 16px 24px; border-bottom: 1px solid var(--border-base); display: flex; justify-content: space-between; align-items: center; background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); }
.ai-profile { display: flex; align-items: center; gap: 12px; }
.ai-avatar { width: 42px; height: 42px; background: linear-gradient(135deg, var(--primary-color), #0ea5e9); color: white; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.ai-name { font-weight: 800; font-size: 15px; color: var(--text-main); }
.ai-status { font-size: 12px; color: var(--text-tertiary); display: flex; align-items: center; gap: 6px; font-weight: 600; }
.pulse-dot { width: 6px; height: 6px; background-color: var(--success-color); border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
.messages-viewport { flex: 1; overflow-y: auto; padding: 32px; background-color: #fcfdfe; display: flex; flex-direction: column; gap: 32px; }
.welcome-guide { margin: auto; text-align: center; max-width: 500px; }
.guide-icon { font-size: 56px; color: var(--primary-color); margin-bottom: 16px; }
.welcome-guide h2 { font-size: 24px; font-weight: 800; color: var(--text-main); margin-bottom: 8px; }
.welcome-guide p { color: var(--text-tertiary); margin-bottom: 32px; font-size: 15px; }
.suggested-questions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.suggestion-item { padding: 12px 20px; background-color: white; border: 1px solid var(--border-strong); border-radius: 24px; font-size: 13px; font-weight: 700; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); }
.suggestion-item:hover { border-color: var(--primary-color); color: var(--primary-color); background-color: var(--primary-light); transform: translateY(-2px); }
.message-wrapper { display: flex; gap: 16px; max-width: 85%; }
.message-wrapper.user { flex-direction: row-reverse; align-self: flex-end; }
.message-avatar { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.ai .message-avatar { background-color: var(--primary-light); color: var(--primary-color); }
.message-bubble { padding: 16px 20px; border-radius: 20px; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.ai .message-bubble { background-color: white; color: var(--text-main); border-top-left-radius: 4px; border: 1px solid var(--border-base); }
.user .message-bubble { background: linear-gradient(135deg, var(--primary-color), #0ea5e9); color: white; border-top-right-radius: 4px; box-shadow: 0 8px 16px -4px rgba(14, 165, 233, 0.4); }
.message-time { font-size: 10px; margin-top: 8px; opacity: 0.5; font-weight: 600; }
.user .message-time { text-align: right; }
.chat-input-area { padding: 24px 32px; background-color: white; border-top: 1px solid var(--border-base); }
.input-wrapper { display: flex; background-color: #f8fafc; border: 1px solid var(--border-strong); border-radius: 20px; padding: 12px 18px; gap: 12px; align-items: flex-end; transition: all 0.3s; }
.input-wrapper:focus-within { border-color: var(--primary-color); background-color: white; box-shadow: 0 0 0 5px var(--primary-light); }
textarea { flex: 1; border: none; background: transparent; padding: 8px 0; font-size: 15px; line-height: 1.5; max-height: 180px; resize: none; font-family: inherit; color: var(--text-main); outline: none; }
.send-btn { width: 40px; height: 40px; background-color: var(--primary-color); color: white; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; transition: all 0.2s; }
.send-btn:hover:not(:disabled) { transform: scale(1.1); background-color: var(--primary-hover); }
.input-footer-tip { font-size: 11px; color: var(--text-tertiary); margin-top: 12px; text-align: center; }

@media (max-width: 768px) {
  /*
   * 铺满 header 以下的剩余高度：视口 - 头部(含顶部安全区) - 内容区上下内边距(含底部安全区)。
   * 用 dvh 而非 vh：iOS 地址栏收起时 vh 不变，输入框会被顶出可视区。
   */
  .ai-chat-page {
    /* 先给不支持 dvh 的浏览器一个可用值，再由下一条覆盖 */
    height: calc(100vh - var(--header-height-mobile) - var(--safe-top)
                 - var(--space-page) * 2 - var(--safe-bottom));
    height: calc(100dvh - var(--header-height-mobile) - var(--safe-top)
                 - var(--space-page) * 2 - var(--safe-bottom));
    min-height: 320px;
  }
  .chat-container { border-radius: var(--radius-lg); }

  .chat-header { padding: 12px 14px; }
  .ai-avatar { width: 36px; height: 36px; font-size: 19px; border-radius: 12px; }
  .ai-name { font-size: 14px; }
  .ai-status { font-size: 11px; }

  .messages-viewport { padding: 16px 14px; gap: 20px; }
  /* 窄屏下 85% 会让长回答挤成细长条，放宽到 92% */
  .message-wrapper { max-width: 92%; gap: 10px; }
  .message-avatar { width: 32px; height: 32px; font-size: 13px; border-radius: 10px; }
  .message-bubble { padding: 12px 14px; border-radius: 16px; }

  .welcome-guide { padding: 0 4px; }
  .guide-icon { font-size: 44px; margin-bottom: 12px; }
  .welcome-guide h2 { font-size: 19px; }
  .welcome-guide p { font-size: 14px; margin-bottom: 24px; }
  .suggested-questions { gap: 8px; }
  .suggestion-item { padding: 10px 16px; font-size: 13px; min-height: var(--tap-target); display: flex; align-items: center; }

  .chat-input-area { padding: 12px 14px; padding-bottom: max(12px, var(--safe-bottom)); }
  .input-wrapper { padding: 8px 10px 8px 14px; border-radius: 18px; }
  /* 16px 以下 iOS 会在聚焦时放大页面 */
  textarea { font-size: var(--font-size-input-mobile); max-height: 120px; }
  .send-btn { width: var(--tap-target); height: var(--tap-target); flex-shrink: 0; }
  .input-footer-tip { display: none; }
}

/* Markdown Styles */
:deep(.markdown-body) { font-size: 14px; line-height: 1.6; word-wrap: break-word; }
:deep(.markdown-body p) { margin-bottom: 12px; }
:deep(.markdown-body p:last-child) { margin-bottom: 0; }
:deep(.markdown-body code) { font-family: monospace; background-color: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-size: 13px; }
:deep(.markdown-body pre) { background-color: #1e293b; color: #f8fafc; padding: 16px; border-radius: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; margin: 16px 0; }
:deep(.markdown-body a) { overflow-wrap: anywhere; }
:deep(.markdown-body table) { display: block; overflow-x: auto; max-width: 100%; }
:deep(.markdown-body pre code) { background: transparent; padding: 0; color: inherit; }
:deep(.markdown-body ul, .markdown-body ol) { padding-left: 20px; margin-bottom: 12px; }
:deep(.markdown-body li) { margin-bottom: 4px; }
:deep(.markdown-body h1, .markdown-body h2, .markdown-body h3) { margin: 16px 0 8px; font-weight: 800; color: var(--text-main); }
:deep(.markdown-body blockquote) { border-left: 4px solid var(--primary-color); padding-left: 16px; color: var(--text-secondary); font-style: italic; margin: 12px 0; }
</style>
