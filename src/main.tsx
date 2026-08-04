import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { initPersistence } from './game/systems/persistence'
import { blindarGestos } from './ui/gestos'

if (import.meta.env.DEV) {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

// Antes del render: la pipa lee su posición del store al montar, así que el
// guardado tiene que estar hidratado cuando la escena aparezca.
initPersistence()

// Los gestos del sistema, apagados desde el arranque: si se registraran al
// montar un control, el primer pellizco antes de tiempo sí haría zoom.
blindarGestos()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
