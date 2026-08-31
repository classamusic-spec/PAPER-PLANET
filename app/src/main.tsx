/* PAPER PLANET — entry point. */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shell/navigator.css'
import './shell/crash.css'
import App from './App'

const host = document.getElementById('root')
if (!host) throw new Error('#root is missing from index.html')

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
