import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import api from "../services/api";

type Config = {
  empresa?: string;
  ruc?: string;
  moneda: string;
  telefono?: string;
  direccion?: string;
  correo?: string;
  pctIndirectosDef: number;
  pctAdministracionDef: number;
  pctUtilidadDef: number;
  pctImpuestosDef: number;
  pctImprevistosDef: number;
};

const CAMPOS_PORCENTAJE = [
  ["pctIndirectosDef", "Indirectos %"],
  ["pctAdministracionDef", "Administración %"],
  ["pctUtilidadDef", "Utilidad %"],
  ["pctImprevistosDef", "Imprevistos %"],
  ["pctImpuestosDef", "Impuestos %"],
] as const;

export default function SettingsPage() {
  const [form, setForm] = useState<Config>({
    moneda: "NIO",
    pctIndirectosDef: 5,
    pctAdministracionDef: 8,
    pctUtilidadDef: 10,
    pctImpuestosDef: 15,
    pctImprevistosDef: 0,
  });
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Config>("/configuracion")
      .then((r) => setForm(r.data))
      .catch(() => setError("No se pudo cargar la configuración."));
  }, []);

  const change = (k: keyof Config, v: string) => {
    const esPorcentaje = CAMPOS_PORCENTAJE.some(([campo]) => campo === k);
    setForm({ ...form, [k]: esPorcentaje ? Number(v) : v });
  };

  const save = async () => {
    try {
      await api.patch("/configuracion", form);
      setMensaje("Configuración guardada correctamente.");
      setError("");
    } catch {
      setError("No se pudo guardar la configuración.");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SISTEMA</p>
          <h1>Configuración</h1>
          <p className="muted">
            Datos del emisor y porcentajes que se aplican al resumen de todos
            los presupuestos.
          </p>
        </div>
        <Settings size={28} />
      </div>

      <section className="panel settings-card">
        <h2>Datos del emisor</h2>
        <div className="settings-grid">
          {(
            [
              ["empresa", "Empresa"],
              ["ruc", "RUC"],
              ["telefono", "Teléfono"],
              ["direccion", "Dirección"],
              ["correo", "Correo"],
              ["moneda", "Moneda"],
            ] as const
          ).map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                className="text-input"
                value={form[k] || ""}
                onChange={(e) => change(k, e.target.value)}
              />
            </label>
          ))}
        </div>

        <h2>Porcentajes predeterminados</h2>
        <div className="settings-grid">
          {CAMPOS_PORCENTAJE.map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                className="text-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form[k]}
                onChange={(e) => change(k, e.target.value)}
              />
            </label>
          ))}
        </div>

        <button className="primary-button" onClick={() => void save()}>
          Guardar configuración
        </button>
        {mensaje && <div className="import-success">{mensaje}</div>}
        {error && <div className="import-error">{error}</div>}
      </section>
    </>
  );
}
