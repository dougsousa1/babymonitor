import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Home from './pages/Home'
import Transmitter from './pages/Transmitter'
import Viewer from './pages/Viewer'

type Route = { page: 'home' } | { page: 'tx' } | { page: 'ver'; room: string }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  if (parts[0] === 'tx') return { page: 'tx' }
  if (parts[0] === 'ver' && parts[1]) return { page: 'ver', room: parts[1] }
  return { page: 'home' }
}

export default function App() {
  const [route, setRoute] = useState(() => parse(location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!supabase) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm leading-relaxed">
        <h1 className="mb-2 text-lg font-semibold">Falta configurar o Supabase</h1>
        <p>
          Crie o arquivo <code>.env</code> (veja <code>.env.example</code>) com <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, ou cadastre essas variáveis na Vercel.
        </p>
      </div>
    )
  }

  if (route.page === 'tx') return <Transmitter />
  if (route.page === 'ver') return <Viewer room={route.room} />
  return <Home />
}
