import React from 'react';

/**
 * Global ErrorBoundary — catches JS errors and shows a fallback UI
 * instead of a white screen of death.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-base p-6">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="text-6xl">💥</div>
                        <h1 className="text-2xl font-display font-bold text-text-primary">
                            Đã xảy ra lỗi
                        </h1>
                        <p className="text-text-muted text-sm leading-relaxed">
                            Ứng dụng gặp sự cố không mong muốn. Vui lòng tải lại trang để tiếp tục.
                        </p>
                        {this.state.error && (
                            <details className="text-left bg-card rounded-xl p-4 text-xs text-text-muted">
                                <summary className="cursor-pointer font-medium text-text-secondary mb-2">
                                    Chi tiết lỗi
                                </summary>
                                <pre className="overflow-auto whitespace-pre-wrap break-words font-mono">
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={this.handleReload}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                            </svg>
                            Tải lại trang
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
