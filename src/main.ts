import './app.css' // aqui entra o Tailwind
import App from './App.svelte'
import { push } from 'svelte-spa-router'

// força abrir na UpdatePage na primeira execução
push('/update')

const app = new App({
  target: document.getElementById('app')!
})

export default app
