import React, { useState } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import UpdateScreen from './pages/UpdateScreen'
import HomeScreen from './pages/HomeScreen'
import SettingsScreen from './pages/SettingsScreen'

export default function App() {
    const [updateDone, setUpdateDone] = useState(false)

    return (
        <HashRouter>
            {!updateDone ? (
                <UpdateScreen onFinish={() => setUpdateDone(true)} />
            ) : (
                <div className="shell">
                    <aside className="sidebar">
                        <div className="brand">
                            <div className="logo" />
                            <div className="brand-text">
                                <strong>Shindo</strong>
                                <span>Launcher</span>
                            </div>
                        </div>

                        <nav className="menu">
                            <NavLink to="/home" className="menu-link">Home</NavLink>
                            <NavLink to="/settings" className="menu-link">Configurações</NavLink>
                        </nav>

                        <div className="sidebar-footer">
                            <span className="muted">v1.5.0</span>
                        </div>
                    </aside>

                    <main className="main">
                        <header className="topbar">
                            <div className="topbar-title">Shindo Launcher</div>
                            <div className="topbar-right">
                                <span className="status-dot ok" />
                                <span className="muted">Tudo certo</span>
                            </div>
                        </header>

                        <section className="content">
                            <Routes>
                                <Route path="/home" element={<HomeScreen />} />
                                <Route path="/settings" element={<SettingsScreen />} />
                            </Routes>
                        </section>
                    </main>
                </div>
            )}
        </HashRouter>
    )
}
