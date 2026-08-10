import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Remove the static HTML boot splash once React has painted.
requestAnimationFrame(() => {
  const boot = document.getElementById('boot-splash')
  if (!boot) return
  boot.style.opacity = '0'
  boot.style.transition = 'opacity 180ms ease'
  setTimeout(() => boot.remove(), 200)
})
