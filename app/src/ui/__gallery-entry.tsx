// PAPER PLANET — dev-only entry that mounts the UI kit gallery. Not part of the app bundle.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Gallery } from './__gallery'

const host = document.getElementById('root')
if (!host) throw new Error('#root is missing from gallery.html')

createRoot(host).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
