/**
 * EmptyState — reusable empty/error state display
 */
export default function EmptyState({ icon = '📭', title, message, action }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
            <div className="text-5xl mb-4">{icon}</div>
            <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                {title}
            </h3>
            {message && (
                <p className="text-sm text-text-muted max-w-xs leading-relaxed">
                    {message}
                </p>
            )}
            {action && (
                <div className="mt-4">{action}</div>
            )}
        </div>
    );
}
