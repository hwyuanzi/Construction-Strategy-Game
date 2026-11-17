import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter/wght.css'
import './styles.css'
import { App } from './ui/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>,
)
