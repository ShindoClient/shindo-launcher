import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function SettingsScreen() {
    const [ram, setRam] = useState(2048)
    const [width, setWidth] = useState(1280)
    const [height, setHeight] = useState(720)
    const [fullscreen, setFullscreen] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(()=>{(async ()=>{
        try{
            const s = await invoke<{ram:number,width:number,height:number,fullscreen:boolean}>('load_settings')
            setRam(s.ram); setWidth(s.width); setHeight(s.height); setFullscreen(s.fullscreen)
        }catch{}
    })()}, [])

    const save = async ()=>{
        setSaving(true)
        try{ await invoke('save_settings',{ram,width,height,fullscreen}) } finally{ setSaving(false) }
    }

    return (
        <div className="card">
            <h3>Configurações do Jogo</h3>
            <div className="row" style={{marginTop:12}}>
                <div><label>RAM (MB)</label><br/><input type="number" value={ram} min={512} step={256} onChange={e=>setRam(parseInt(e.target.value||'0'))}/></div>
                <div><label>Largura</label><br/><input type="number" value={width} min={640} step={10} onChange={e=>setWidth(parseInt(e.target.value||'0'))}/></div>
                <div><label>Altura</label><br/><input type="number" value={height} min={480} step={10} onChange={e=>setHeight(parseInt(e.target.value||'0'))}/></div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:22}}>
                    <input id="fs" type="checkbox" checked={fullscreen} onChange={e=>setFullscreen(e.target.checked)} />
                    <label htmlFor="fs">Tela cheia</label>
                </div>
            </div>
            <div style={{marginTop:16,display:'flex',gap:10}}>
                <button disabled={saving} onClick={save}>{saving?'Salvando...':'Salvar'}</button>
                <button className="ghost" onClick={()=>location.reload()}>Descartar</button>
            </div>
        </div>
    )
}
