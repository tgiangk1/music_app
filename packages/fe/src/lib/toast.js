import toast from 'react-hot-toast';

/**
 * Themed toast helpers — consistent styling across the app.
 */
export const showToast = {
    success: (msg) => toast.success(msg, { duration: 3000 }),
    error: (msg) => toast.error(msg || 'Đã xảy ra lỗi', { duration: 4000 }),
    info: (msg, icon = 'ℹ️') => toast(msg, { icon, duration: 3000 }),
    warn: (msg) => toast(msg, { icon: '⚠️', duration: 4000 }),
    promise: (promise, { loading, success, error }) =>
        toast.promise(promise, {
            loading: loading || 'Đang xử lý...',
            success: success || 'Thành công!',
            error: (err) => (typeof error === 'function' ? error(err) : error || 'Thất bại'),
        }),
};
