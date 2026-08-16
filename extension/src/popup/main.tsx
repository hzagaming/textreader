import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PopupApp } from './popup-app'
import '@/styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
)
