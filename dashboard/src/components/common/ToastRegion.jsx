export default function ToastRegion({ toasts, onDismiss }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.kind || "info"}`} key={toast.id} role="status">
          <span className="toast-indicator" />
          <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
          <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );
}
