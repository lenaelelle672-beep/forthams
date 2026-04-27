/**
 * @component Toaster
 * @description Toast notification component powered by Sonner.
 *              Provides non-blocking notification alerts with auto-dismiss functionality.
 * @since Sprint 4
 * @see https://sonner.dev
 */
export function Toaster() {
  const { toasts, dismiss } = useSonner();
  
  return (
    <ToasterContext.Provider value={{ toasts, dismiss }}>
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-md"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToasterContext.Provider>
  );
}