import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuthStore();
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        processedRef.current = true;

        const error = searchParams.get('error');
        if (error === 'banned') {
            toast.error('Your account has been banned');
            navigate('/login');
            return;
        }

        // SEC-2: Exchange one-time code for tokens (tokens no longer in URL)
        const code = searchParams.get('code');
        if (!code) {
            toast.error('Login failed — no authorization code');
            navigate('/login');
            return;
        }

        axios.post(`${API_URL}/auth/exchange`, { code })
            .then(async (res) => {
                const { accessToken, refreshToken } = res.data;
                await login(accessToken, refreshToken);
                navigate('/');
            })
            .catch((err) => {
                console.error('Auth exchange failed:', err);
                toast.error('Login failed — please try again');
                navigate('/login');
            });
    }, [searchParams, login, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-fade-in">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-text-secondary">Signing you in...</p>
            </div>
        </div>
    );
}
