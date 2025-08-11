import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function HomeScreen() {
    const [status, setStatus] = useState('Pronto para iniciar')
    const [version, setVersion] = useState<string>('')

    useEffect(() => {(async () => {
        try { setVersion(await invoke<string>('app_version')) } catch {}
    })()}, [])

    return (
        <div className="row">
            <div className="card" style={{flex:'1 1 420px'}}>
                <h3>Status</h3>
                <div className="muted" style={{margin:'8px 0 14px'}}>{status}</div>
                <div className="row">
                    <button onClick={async ()=>{
                        setStatus('Iniciando cliente...')
                        try { await invoke('start_client'); setStatus('Cliente iniciado!') }
                        catch (e:any){ setStatus('Falha ao iniciar: '+String(e)) }
                    }}>Iniciar o Cliente</button>
                    <button className="ghost" onClick={()=>window.location.hash='#/settings'}>Abrir Configurações</button>
                </div>
            </div>

            <div className="card" style={{flex:'1 1 320px'}}>
                <h3>Informações</h3>
                <div className="muted">Versão do launcher: <strong style={{color:'var(--text)'}}>{version || '—'}</strong></div>
                <div className="muted">Canal: latest</div>
            </div>
        </div>
    )
}
