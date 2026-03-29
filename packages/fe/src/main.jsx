import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'

import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Home from './pages/Home'
import ProtectedRoute from './components/ProtectedRoute'
import FeedbackButton from './components/FeedbackButton'
import ErrorBoundary from './components/ErrorBoundary'
import ApiWarmup from './components/ApiWarmup'
import { ThemeProvider } from './components/ThemeProvider'

// Lazy-loaded routes — split into separate chunks for faster initial load
const Room = React.lazy(() => import('./pages/Room'))
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'))
const Explore = React.lazy(() => import('./pages/Explore'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Gamification = React.lazy(() => import('./pages/Gamification'))
const NotFound = React.lazy(() => import('./pages/NotFound'))

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-text-muted text-sm font-body">Loading...</p>
        </div>
    </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <ApiWarmup>
                <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Home />
                        </ProtectedRoute>
                    } />
                    <Route path="/room/:slug" element={<Room />} />
                    <Route path="/admin" element={
                        <ProtectedRoute requireAdmin>
                            <AdminPanel />
                        </ProtectedRoute>
                    } />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/profile/:userId" element={<Profile />} />
                    <Route path="/gamification" element={
                        <ProtectedRoute>
                            <Gamification />
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                <FeedbackButton />
            </BrowserRouter>
            </ApiWarmup>
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
        </ErrorBoundary>
    </React.StrictMode>,
)

