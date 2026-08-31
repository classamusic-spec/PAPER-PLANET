/* PAPER PLANET — entry point. */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shell/navigator.css'
import './shell/crash.css'
import App from './App'
import { installAudioBridge } from './shell/audioBridge'
import { registerServiceWorker } from './shell/pwa'

const host = document.getElementById('root')
if (!host) throw new Error('#root is missing from index.html')

installAudioBridge()
registerServiceWorker()

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
