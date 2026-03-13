import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: true,

            setUser: (user) => set({ user }),

            setTokens: (accessToken, refreshToken) => set({
                accessToken,
                ...(refreshToken ? { refreshToken } : {}),
            }),

            login: (accessToken, refreshToken) => {
                set({ accessToken, refreshToken, isLoading: true });
                // Fetch user info
                return api.get('/auth/me')
                    .then((res) => {
                        set({ user: res.data.user, isLoading: false });
                        return res.data.user;
                    })
                    .catch(() => {
                        set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
                        return null;
                    });
            },

            logout: async () => {
                const refreshToken = get().refreshToken;
                try {
                    if (refreshToken) {
                        await api.post('/auth/logout', { refreshToken });
                    }
                } catch (e) {
                    // ignore
                }
                set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
            },

            checkAuth: async () => {
                const token = get().accessToken;
                if (!token) {
                    set({ isLoading: false });
                    return;
                }
                try {
                    const res = await api.get('/auth/me');
                    set({ user: res.data.user, isLoading: false });
                } catch {
                    set({ user: null, isLoading: false });
                }
            },

            isAdmin: () => get().user?.role === 'admin',
        }),
        {
            name: 'jukebox-auth',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }),
            onRehydrateStorage: () => (state) => {
                // After restoring from localStorage, stop loading immediately
                if (state) {
                    state.isLoading = false;
                }
            },
        }
    )
);
