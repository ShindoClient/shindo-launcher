// src/components/Progress.tsx
import React from 'react'
export default function Progress({ value, label }: { value: number; label?: string }) {
    return (
        <div>
            {label && <div className="muted" style={{marginBottom:6}}>{label}</div>}
            <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
        </div>
    )
}
