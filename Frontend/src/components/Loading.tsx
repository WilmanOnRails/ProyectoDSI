import { LoaderCircle } from "lucide-react";

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle className="spin" size={size} aria-hidden="true" />;
}

export function LoadingOverlay({ mensaje = "Procesando..." }: { mensaje?: string }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <Spinner size={24} />
        <span>{mensaje}</span>
      </div>
    </div>
  );
}
