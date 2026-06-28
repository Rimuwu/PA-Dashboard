import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.config.globalProperties.$getIconUrl = (path) => {
  if (!path) return '';
  const base = import.meta.env.BASE_URL || '/';
  if (path.startsWith(base)) {
    return path;
  }
  if (path.startsWith('/')) {
    const baseSeg = base.replace(/\/+/g, '');
    if (baseSeg && path.replace(/\/+/g, '').startsWith(baseSeg)) {
      return path;
    }
    return (base + path.slice(1)).replace(/\/+/g, '/');
  }
  return path;
}

app.mount('#app')
