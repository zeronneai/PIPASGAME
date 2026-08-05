import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { blindarGestos } from './ui/gestos'

if (import.meta.env.DEV) {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

/*
 * La hidratación del guardado se mudó a `Game.tsx`. Vivía aquí para que el
 * store estuviera puesto antes de que la pipa leyera su posición, y eso sigue
 * garantizado —ahora corre al evaluarse el chunk del juego, antes de que
 * monte nada que lea el store—. Lo que se gana es que `initPersistence`
 * importa el store, y el store importa la colonia entera: tenerla aquí metía
 * toda la geometría del mapa en el chunk de arranque para poder dibujar un
 * botón.
 */

// Los gestos del sistema, apagados desde el arranque: si se registraran al
// montar un control, el primer pellizco antes de tiempo sí haría zoom.
blindarGestos()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
