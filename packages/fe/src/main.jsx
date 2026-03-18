import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'

import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import Room from './pages/Room'
import AdminPanel from './pages/AdminPanel'
import Explore from './pages/Explore'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { ThemeProvider } from './components/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Home />
                        </ProtectedRoute>
                    } />
                    <Route path="/room/:slug" element={
                        <Room />
                    } />
                    <Route path="/admin" element={
                        <ProtectedRoute requireAdmin>
                            <AdminPanel />
                        </ProtectedRoute>
                    } />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/profile/:userId" element={<Profile />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: '#1a1a24',
                        color: '#f5f3ff',
                        border: '1px solid #2a2a3d',
                        borderRadius: '12px',
                        fontFamily: 'DM Sans, sans-serif',
                    },
                    success: {
                        iconTheme: { primary: '#10b981', secondary: '#f5f3ff' },
                    },
                    error: {
                        iconTheme: { primary: '#ef4444', secondary: '#f5f3ff' },
                    },
                }}
            />
        </ThemeProvider>
    </React.StrictMode>,
)
