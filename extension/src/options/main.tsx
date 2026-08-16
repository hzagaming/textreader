import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsApp } from './options-app'
import '@/styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
)
