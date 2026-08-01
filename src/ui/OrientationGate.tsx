import { useEffect, useState } from 'react'

function usePortrait() {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = (event: MediaQueryListEvent) => setPortrait(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return portrait
}

export function OrientationGate() {
  const portrait = usePortrait()

  if (!portrait) return null

  return (
    <div className="overlay orientation-gate">
      <div className="phone-icon" />
      <p>Gira tu teléfono</p>
      <p className="hint">Este juego se juega en horizontal</p>
    </div>
  )
}
