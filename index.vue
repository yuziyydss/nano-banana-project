<template>
  <div class="banana-page">
    <div class="studio" :class="{ 'debug-on': debugMode }">
      <h1 class="title" @click="onTitleClick">Spes AI Studio</h1>

      <!-- 会话管理按钮 -->
      <div class="session-controls">
        <button class="btn-clear" @click="clearSession" :disabled="loading">
          清空对话历史
        </button>
        <span class="session-info" v-if="sessionId">
          会话ID: {{ sessionId.substring(0, 8) }}...
        </span>
      </div>

      <!-- 结果展示区（历史对话列表） -->
      <div class="result" v-if="conversation.length">
        <div class="chat" ref="chatRef">
          <div class="msg" v-for="m in conversation" :key="m.id" :class="m.role">
            <div class="bubble">
              <p v-if="m.text" class="text">{{ m.text }}</p>
              <div v-if="m.role === 'user' && m.images && m.images.length" class="images">
                <div class="thumb small" v-for="(u, i) in m.images" :key="`u-${m.id}-${i}`">
                  <img :src="u" :alt="`u-${i+1}`" @click="openImagePreview(u)" />
                </div>
              </div>
              <div v-if="m.role === 'assistant' && m.imageUrl" class="result-preview">
                <img :src="m.imageUrl" alt="生成结果" />
              </div>
              <!-- 用户消息操作栏：仅对用户气泡显示 -->
              <div v-if="m.role === 'user'" class="actions">
                <button class="action-btn" title="重发" @click="onResendMessage(m)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6 0 1.01-.25 1.96-.69 2.8l1.46 1.46C19.54 18.07 20 16.59 20 15c0-4.42-3.58-8-8-8z" fill="currentColor"/>
                    <path d="M6 15c0-1.01.25-1.96.69-2.8L5.23 10.74C4.46 11.93 4 13.41 4 15c0 4.42 3.58 8 8 8v3l5-5-5-5v3c-3.31 0-6-2.69-6-6z" fill="currentColor"/>
                  </svg>
                </button>
                <button class="action-btn" title="复制文本" @click="onCopyText(m.text)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1z" fill="currentColor"/>
                    <path d="M20 5H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h12v14z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="prompt-row">
        <div class="prompt-box" :class="{ 'is-loading': loading }">
          <!-- 输入框 -->
          <textarea
            ref="promptRef"
            v-model.trim="prompt"
            class="prompt-input"
            :placeholder="placeholder"
            @keydown.enter.exact.prevent="onRun"
            @input="onPromptInput"
          />

          <!-- 图片预览区与上传按钮 -->
          <div class="thumbs">
            <div class="thumb" v-for="(img, i) in images" :key="img.id">
              <img :src="img.url" :alt="`image-${i+1}`" />
              <button class="remove" title="删除" @click="removeImage(i)">×</button>
            </div>
            <!-- + 上传按钮 -->
            <button
              class="btn-upload"
              type="button"
              title="上传图片（最多10张）"
              @click="triggerSelect"
              :disabled="images.length >= maxImages"
            >
              +
            </button>
          </div>
          <input
            ref="fileInputRef"
            class="hidden-input"
            type="file"
            accept="image/*"
            multiple
            @change="onSelectFiles"
          />

          <!-- 右下角 Run 按钮 -->
          <button class="btn-run" :disabled="!canRun || loading" @click="onRun">
            <span v-if="!loading">运行</span>
            <span v-else class="spinner"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- 调试面板：右侧显示 callBackendGenerate 的请求与响应 -->
    <aside v-if="debugMode" class="debug-panel">
      <header class="debug-header">
        <strong>调试面板</strong>
        <button class="debug-clear" @click="debugLogs = []">清空</button>
      </header>
      <div class="debug-body" ref="debugRef">
        <div v-for="(log, idx) in debugLogs" :key="log.id" class="debug-item">
          <div class="debug-line time">#{{ idx + 1 }} · {{ log.time }}</div>
          <div class="debug-line req"><b>REQUEST</b>: {{ log.request }}</div>
          <div class="debug-line res" :class="{ error: !log.success }"><b>RESPONSE</b>: {{ log.response }}</div>
        </div>
      </div>
    </aside>
  </div>

  <!-- 图片预览弹窗 -->
  <div v-if="previewVisible" class="img-preview-overlay" @click="closeImagePreview">
    <div class="img-preview-body" @click.stop>
      <img :src="previewUrl" alt="预览" />
      <button class="img-preview-close" @click="closeImagePreview">×</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, computed, onMounted, nextTick, watch } from 'vue'

const placeholder = 'Start typing a prompt'
const maxImages = 10

const prompt = ref('')
const images = ref([]) // { id, file, url }
const loading = ref(false)
const conversation = ref([])
const sessionId = ref('')

const fileInputRef = ref(null)
const promptRef = ref(null)
const chatRef = ref(null)

// 后端服务地址
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_BANANA_API_URL)
  ? import.meta.env.VITE_BANANA_API_URL
  : 'http://127.0.0.1:5300'

// 自动调整输入框高度
const autoResizePrompt = () => {
  const el = promptRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// 滚动到底部
const scrollToBottom = () => {
  const el = chatRef.value
  if (!el) return
  try {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  } catch (e) {
    el.scrollTop = el.scrollHeight
  }
}

const onPromptInput = () => {
  autoResizePrompt()
}

// 创建会话
const createSession = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error('创建会话失败')
    }
    const data = await res.json()
    sessionId.value = data.session_id
    console.log('新会话已创建:', sessionId.value)
  } catch (error) {
    console.error('创建会话失败:', error)
    // 如果创建失败，使用本地生成的ID作为备用
    sessionId.value = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

// 加载会话历史
const loadSessionHistory = async () => {
  if (!sessionId.value) return
  
  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId.value}/history`)
    if (!res.ok) {
      throw new Error('加载历史失败')
    }
    const data = await res.json()
    conversation.value = data.conversation_history || []
    console.log('会话历史已加载:', conversation.value.length, '条消息')
  } catch (error) {
    console.error('加载会话历史失败:', error)
  }
}

// 清空会话历史
const clearSession = async () => {
  if (!sessionId.value) return
  
  try {
    const res = await fetch(`${API_BASE}/api/session/${sessionId.value}/clear`, {
      method: 'POST',
    })
    if (!res.ok) {
      throw new Error('清空会话失败')
    }
    conversation.value = []
    console.log('会话历史已清空')
  } catch (error) {
    console.error('清空会话失败:', error)
    // 即使后端失败，也清空本地历史
    conversation.value = []
  }
}

// 文件选择相关
const triggerSelect = () => {
  if (images.value.length >= maxImages) return
  fileInputRef.value && fileInputRef.value.click()
}

const onSelectFiles = (e) => {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  const remain = Math.max(0, maxImages - images.value.length)
  const selected = files.slice(0, remain)
  const newOnes = selected.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    url: URL.createObjectURL(file)
  }))
  images.value.push(...newOnes)
  e.target.value = ''
}

const removeImage = (idx) => {
  const img = images.value[idx]
  if (img) URL.revokeObjectURL(img.url)
  images.value.splice(idx, 1)
}

// 清空输入图片
const clearInputImages = () => {
  images.value.forEach((img) => { try { URL.revokeObjectURL(img.url) } catch (e) {} })
  images.value = []
}

// 调用后端生成API
const callBackendGenerate = async (promptText, imageList) => {
  const fd = new FormData()
  fd.append('prompt', promptText || '')
  fd.append('session_id', sessionId.value)
  
  if (imageList && imageList.length > 0) {
    imageList.forEach((img) => {
      if (img && img.file) fd.append('images', img.file)
    })
  }

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    body: fd,
  })
  
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch (e) { /* ignore */ }
    const msg = (data && data.message) || '生成失败，请稍后重试'
    throw new Error(msg)
  }
  
  const data = await res.json()
  return data
}

// 生成ID
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// 运行生成
const onRun = async () => {
  if (!canRun.value || loading.value) return
  loading.value = true

  // 保存当前输入值和图片，用于传给接口
  const currentPrompt = prompt.value
  const currentImages = [...images.value]

  // 1) 将当前输入与选择的图片作为一条 user 消息加入历史
  const userMsg = { id: createId(), role: 'user', text: currentPrompt, images: [] }
  currentImages.forEach((img) => {
    if (img && img.file) {
      const u = URL.createObjectURL(img.file)
      userMsg.images.push(u)
    }
  })
  conversation.value.push(userMsg)
  nextTick(() => scrollToBottom())

  // 立即清空输入框和图片
  prompt.value = ''
  clearInputImages()
  nextTick(() => autoResizePrompt())

  try {
    // 2) 调用后端生成
    const reqInfo = { prompt: currentPrompt, images: currentImages.map(i=>i?.file?.name || 'blob'), sessionId: sessionId.value }
    const startAt = Date.now()
    const res = await callBackendGenerate(currentPrompt, currentImages)
    logDebugRequest(reqInfo, { ok: res.success, image: !!res.image, text: (res.text||'').slice(0,120), elapsed: (Date.now()-startAt)+'ms' }, res.success)
    if (res.success) {
      const assistantMsg = {
        id: createId(),
        role: 'assistant',
        text: res.text || '生成成功',
        imageUrl: res.image,
      }
      conversation.value.push(assistantMsg)
      nextTick(() => scrollToBottom())
    } else {
      const assistantMsg = { id: createId(), role: 'assistant', text: '运行失败，请稍后重试' }
      conversation.value.push(assistantMsg)
      nextTick(() => scrollToBottom())
    }
  } catch (e) {
    const assistantMsg = { id: createId(), role: 'assistant', text: '运行异常：' + (e?.message || '未知错误') }
    conversation.value.push(assistantMsg)
    nextTick(() => scrollToBottom())
  } finally {
    loading.value = false
  }
}

// 计算属性
const canRun = computed(() => prompt.value.length > 0 || images.value.length > 0)

// 生命周期
onMounted(async () => {
  await createSession()
  await loadSessionHistory()
  nextTick(() => {
    autoResizePrompt()
    scrollToBottom()
  })
})

// 当会话长度变化时，自动滚动到底部
watch(
  () => conversation.value.length,
  () => nextTick(() => scrollToBottom()),
  { flush: 'post' }
)

onBeforeUnmount(() => {
  images.value.forEach((img) => URL.revokeObjectURL(img.url))
  conversation.value.forEach((m) => {
    if (m.role === 'user' && Array.isArray(m.images)) {
      m.images.forEach((u) => { try { URL.revokeObjectURL(u) } catch (e) {} })
    }
    if (m.role === 'assistant' && m.imageUrl) {
      try { URL.revokeObjectURL(m.imageUrl) } catch (e) {}
    }
  })
})

// 图片预览与操作栏相关逻辑
const previewVisible = ref(false)
const previewUrl = ref('')

const openImagePreview = (url) => {
  previewUrl.value = url
  previewVisible.value = true
}
const closeImagePreview = () => {
  previewVisible.value = false
  previewUrl.value = ''
}

const onCopyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text || ''
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (err) {}
    document.body.removeChild(ta)
  }
}

const onResendMessage = async (m) => {
  if (loading.value) return
  loading.value = true

  const promptText = m?.text || ''
  const imageUrls = Array.isArray(m?.images) ? m.images : []

  const newUserMsg = { id: createId(), role: 'user', text: promptText, images: [...imageUrls] }
  conversation.value.push(newUserMsg)
  nextTick(() => scrollToBottom())

  const files = []
  for (let i = 0; i < imageUrls.length; i++) {
    const u = imageUrls[i]
    try {
      const resp = await fetch(u)
      const blob = await resp.blob()
      const ext = (blob.type && blob.type.split('/')[1]) || 'png'
      const file = new File([blob], `resend-${i + 1}.${ext}`, { type: blob.type || 'image/png' })
      files.push({ file })
    } catch (err) {
      // ignore image convert error
    }
  }

  try {
    // 记录调试日志
    const requestInfo = {
      prompt: promptText,
      images: files.map(f => f.file?.name || 'blob'),
      sessionId: sessionId.value
    }
    const startTime = Date.now()
    
    const res = await callBackendGenerate(promptText, files)
    
    const responseInfo = {
      success: res.success,
      text: res.text?.substring(0, 100) + (res.text?.length > 100 ? '...' : ''),
      image: res.image ? 'has image' : 'no image',
      elapsed: Date.now() - startTime + 'ms'
    }
    
    logDebugRequest(requestInfo, responseInfo, res.success)
    
    if (res.success) {
      const assistantMsg = {
        id: createId(),
        role: 'assistant',
        text: res.text || '生成成功',
        imageUrl: res.image,
      }
      conversation.value.push(assistantMsg)
      nextTick(() => scrollToBottom())
    } else {
      const assistantMsg = { id: createId(), role: 'assistant', text: '运行失败，请稍后重试' }
      conversation.value.push(assistantMsg)
      nextTick(() => scrollToBottom())
    }
  } catch (e) {
    logDebugRequest({ prompt: promptText, images: files.length }, { error: e.message }, false)
    const assistantMsg = { id: createId(), role: 'assistant', text: '运行异常：' + (e?.message || '未知错误') }
    conversation.value.push(assistantMsg)
    nextTick(() => scrollToBottom())
  } finally {
    loading.value = false
  }
}

// 调试模式相关变量和方法
const debugMode = ref(false)
const debugLogs = ref([])
const debugRef = ref(null)
let titleClickCount = 0
let titleClickTimer = null

// 标题点击处理，连续点击5次进入调试模式
const onTitleClick = () => {
  titleClickCount++
  
  if (titleClickTimer) {
    clearTimeout(titleClickTimer)
  }
  
  titleClickTimer = setTimeout(() => {
    titleClickCount = 0
  }, 2000) // 2秒内连续点击才有效
  
  if (titleClickCount >= 5) {
    debugMode.value = !debugMode.value
    titleClickCount = 0
    if (titleClickTimer) {
      clearTimeout(titleClickTimer)
      titleClickTimer = null
    }
    console.log('调试模式:', debugMode.value ? '开启' : '关闭')
  }
}

// 记录调试日志
const logDebugRequest = (request, response, success = true) => {
  if (!debugMode.value) return
  
  const log = {
    id: createId(),
    time: new Date().toLocaleTimeString(),
    request: JSON.stringify(request, null, 2),
    response: JSON.stringify(response, null, 2),
    success
  }
  
  debugLogs.value.push(log)
  
  // 限制日志数量，最多保留50条
  if (debugLogs.value.length > 50) {
    debugLogs.value.shift()
  }
  
  // 自动滚动到底部
  nextTick(() => {
    if (debugRef.value) {
      debugRef.value.scrollTop = debugRef.value.scrollHeight
    }
  })
}
</script>

<style scoped lang="scss">
.banana-page {
  min-height: 100vh;
  background: #f7f7f8;
  padding: 32px 16px;
}

.studio {
  max-width: 980px;
  margin: 0 auto;
}

// 调试模式下：主区 + 右侧面板两列布局
.studio.debug-on {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 16px;
  align-items: start;
}

.debug-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 360px;
  height: calc(100vh - 32px);
  background: #ffffff;
  border: 1px solid #e8e8ea;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
  z-index: 1000;
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.debug-clear {
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
.debug-clear:hover { background: #f7f7f7; }

.debug-body {
  height: calc(100% - 42px);
  overflow: auto;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
}

.debug-item {
  padding: 8px 0;
  border-bottom: 1px dashed #eee;
}
.debug-line { white-space: pre-wrap; word-break: break-word; }
.debug-line.time { color: #888; margin-bottom: 4px; }
.debug-line.req { color: #333; }
.debug-line.res { color: #116611; }
.debug-line.res.error { color: #aa2222; }
.title {
  text-align: center;
  font-size: 28px;
  font-weight: 600;
  color: #202124;
  margin: 24px 0 28px;
}

.session-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8e8ea;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.btn-clear {
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-clear:hover:not(:disabled) {
  background: #ff5252;
  transform: translateY(-1px);
}

.btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.session-info {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.prompt-row {
  display: flex;
  justify-content: center;
}

.prompt-box {
  position: relative;
  width: 100%;
  background: #fff;
  border: 1px solid #e8e8ea;
  border-radius: 20px;
  padding: 20px 72px 20px 20px;
  box-shadow: 0 3px 12px rgba(0,0,0,0.06);
}

.prompt-input {
  width: 100%;
  border: none;
  outline: none;
  font-size: 15px;
  line-height: 1.6;
  color: #222;
  resize: none;
  overflow: hidden;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(56px, 80px));
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}

.thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
  background: #fafafa;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .remove {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.55);
  color: #fff;
  line-height: 20px;
  font-size: 14px;
  cursor: pointer;
}

.btn-upload {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  border: 1px dashed #c8c8cc;
  background: #fff;
  color: #3b3b40;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-upload:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.btn-run {
  position: absolute;
  right: 16px;
  bottom: 16px;
  background: #f9cc00;
  border: 1px solid #f2c200;
  color: #1f1f1f;
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 600;
  cursor: pointer;
}

.btn-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  display: inline-block;
  border: 2px solid rgba(0,0,0,0.15);
  border-top-color: rgba(0,0,0,0.5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.result {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.chat {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70vh; /* 原为 60vh，提升以容纳更高的消息气泡 */
  overflow-y: auto;
  scroll-behavior: smooth;
  padding-right: 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.28) transparent;
  scrollbar-gutter: stable both-edges;
}

.chat::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.chat::-webkit-scrollbar-track {
  background: transparent;
  margin: 6px 0;
}
.chat::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d9dde4, #c7ccd4);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
}
.chat:hover::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #cfd5dd, #bcc3cd);
}
.chat::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #c0c7d1, #aeb6c2);
}

.msg {
  display: flex;
  width: 100%;
}
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }

.bubble {
  position: relative;
  width: 100%;
  max-width: none;
  background: #fff;
  border: 1px solid #e8e8ea;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.msg.user .bubble {
  background: #eaf3ff;
  border-color: #cfe3ff;
  padding-bottom: 40px; /* 预留操作栏空间，避免遮挡内容 */
}

.bubble .text { 
  color: #333; 
  margin: 0 0 6px; 
  white-space: pre-wrap; 
}

.bubble .images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px; /* 放大间距，视觉更舒展 */
  min-height: 220px; /* 提升带图消息的整体高度 */
}

.result-preview {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.result-preview img {
  width: 100%;
  max-height: 680px; /* 提升助手图片展示高度 */
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

.thumb.small { 
  width: 300px; 
  height: 300px; 
  border-radius: 10px;
}



.actions {
  position: absolute;
  right: 8px;
  bottom: 6px;
  display: flex;
  gap: 8px;
}
.action-btn {
  width: 26px;
  height: 26px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.action-btn:hover {
  background: #f4f4f4;
}

/* 图片预览弹窗样式 */
.img-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.img-preview-body {
  position: relative;
  max-width: min(92vw, 1100px);
  max-height: min(90vh, 900px);
  background: #111;
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.img-preview-body img {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}
.img-preview-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.9);
  color: #111;
  font-size: 20px;
  cursor: pointer;
}
.img-preview-close:hover {
  background: #fff;
}
</style>
