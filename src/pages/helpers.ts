import { invoke } from '@tauri-apps/api/core'

export async function checkClientAndJava(setStatus:(s:string)=>void, setProgress:(n:number)=>void) {
  try {
    setStatus('Checando updates do launcher...')
    await invoke('run_updater')

    setStatus('Checando/baixando Java (Azul Zulu)...')
    await invoke('ensure_java')

    setStatus('Baixando cliente (Shindo-Client latest)...')
    await invoke('ensure_client', { zipUrl: 'https://raw.githubusercontent.com/ShindoClient/Shindo-Client/latest/ShindoClient.zip' })

    setStatus('Baixando assets e libraries...')
    await invoke('ensure_assets_and_libs')

  } catch (e: any) {
    setStatus('Erro: ' + e?.toString())
    throw e
  }
}
