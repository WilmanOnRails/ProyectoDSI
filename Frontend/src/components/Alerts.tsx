import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export type TipoAlerta = "exito" | "error" | "advertencia" | "info";

type Alerta = {
  id: number;
  tipo: TipoAlerta;
  mensaje: string;
};

type AlertaContexto = {
  mostrarAlerta: (mensaje: string, tipo?: TipoAlerta) => void;
  mostrarExito: (mensaje: string) => void;
  mostrarError: (mensaje: string) => void;
  mostrarAdvertencia: (mensaje: string) => void;
};

const ContextoAlertas = createContext<AlertaContexto | null>(null);

const ICONOS: Record<TipoAlerta, typeof Info> = {
  exito: CheckCircle2,
  error: AlertCircle,
  advertencia: TriangleAlert,
  info: Info,
};

let siguienteId = 0;

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const cerrar = useCallback((id: number) => {
    setAlertas((actuales) => actuales.filter((alerta) => alerta.id !== id));
  }, []);

  const mostrarAlerta = useCallback(
    (mensaje: string, tipo: TipoAlerta = "info") => {
      const id = ++siguienteId;
      setAlertas((actuales) => [
        ...actuales.slice(-3),
        { id, tipo, mensaje },
      ]);
      window.setTimeout(() => cerrar(id), 5000);
    },
    [cerrar],
  );

  const value = useMemo<AlertaContexto>(
    () => ({
      mostrarAlerta,
      mostrarExito: (mensaje) => mostrarAlerta(mensaje, "exito"),
      mostrarError: (mensaje) => mostrarAlerta(mensaje, "error"),
      mostrarAdvertencia: (mensaje) => mostrarAlerta(mensaje, "advertencia"),
    }),
    [mostrarAlerta],
  );

  return (
    <ContextoAlertas.Provider value={value}>
      {children}
      <div className="alert-stack" aria-live="polite">
        {alertas.map((alerta) => {
          const Icono = ICONOS[alerta.tipo];
          return (
            <div
              key={alerta.id}
              className={`alert-toast alert-${alerta.tipo}`}
              role={alerta.tipo === "error" ? "alert" : "status"}
            >
              <Icono size={18} aria-hidden="true" />
              <span>{alerta.mensaje}</span>
              <button
                type="button"
                aria-label="Cerrar alerta"
                onClick={() => cerrar(alerta.id)}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ContextoAlertas.Provider>
  );
}

export function useAlert(): AlertaContexto {
  const contexto = useContext(ContextoAlertas);
  if (!contexto) {
    throw new Error("useAlert debe usarse dentro de AlertProvider");
  }
  return contexto;
}
