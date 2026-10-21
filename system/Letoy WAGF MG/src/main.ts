import 'remixicon/fonts/remixicon.css'
import './styles/index.css'
import './styles/campus.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initTheme } from './utils/theme'
import { installPointerFx } from './utils/fx'

initTheme()
installPointerFx()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
