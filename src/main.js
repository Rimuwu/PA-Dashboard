import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.config.globalProperties.$getIconUrl = (path) => {
  if (!path) return '';
  const base = import.meta.env.BASE_URL || '/';
  if (path.startsWith('/')) {
    return (base + path.slice(1)).replace(/\/+/g, '/');
  }
  return path;
}

app.mount('#app')
