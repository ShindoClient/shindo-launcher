import React, { useEffect, useState } from 'react'
import Progress from '../components/Progress'
import { checkClientAndJava } from './helpers'

interface Props {
    onFinish?: () => void
}

export default function UpdateScreen({ onFinish }: Props) {
    const [status, setStatus] = useState('Verificando updates do launcher...')
    const [progress, setProgress] = useState(0)
    const [fadeOut, setFadeOut] = useState(false)

    useEffect(() => {
        let p = 5
        const int = setInterval(() => {
                p = Math.min(95, p + 2)
                setProgress(p)
            }, 250)

        ;(async () => {
            setStatus('Preparando ambiente (Java + Client)...')
            await checkClientAndJava(setStatus, setProgress)
            setProgress(100)
            setStatus('Atualização concluída!')
            setTimeout(() => {
                setFadeOut(true)
                setTimeout(() => {
                    onFinish?.()
                }, 500) // tempo do fade-out
            }, 800) // pausa antes do fade
        })()

        return () => clearInterval(int)
    }, [])

    return (
        <div className={`update-screen ${fadeOut ? 'fade-out' : ''}`}>
            <div className="update-card">
                <h2>Atualizando Launcher</h2>
                <div className="spacer"></div>
                <Progress value={progress} />
                <div className="spacer"></div>
                <div className="status">{status}</div>
            </div>
        </div>
    )
}
