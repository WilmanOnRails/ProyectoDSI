import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Settings, UserRound } from "lucide-react";
import api, { apiGet } from "../services/api";
import { updateMyProfile } from "../services/auth";
import {
  canManagePlatformData,
  getAuthSession,
  getRoleLabel,
  updateAuthSessionUser,
} from "../services/authSession";

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
  const canEdit = canManagePlatformData();
  const [profile, setProfile] = useState(() => ({
    nombre: getAuthSession()?.user.nombre ?? "",
    email: getAuthSession()?.user.email ?? "",
    rol: getAuthSession()?.user.rol ?? "",
  }));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
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
    apiGet<Config>("/configuracion")
      .then(setForm)
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

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingProfile) return;
    if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
      setProfileError("La nueva contraseña y su confirmación no coinciden.");
      setProfileMessage("");
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const user = await updateMyProfile({
        nombre: profile.nombre,
        email: profile.email,
        currentPassword,
        ...(newPassword ? { newPassword } : {}),
      });
      setProfile({ nombre: user.nombre, email: user.email, rol: user.rol });
      updateAuthSessionUser(user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileMessage("Tu cuenta fue actualizada correctamente.");
    } catch (error: unknown) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setProfileError(
        typeof message === "string"
          ? message
          : "No se pudo actualizar tu cuenta. Inténtalo de nuevo.",
      );
    } finally {
      setSavingProfile(false);
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
        <h2>
          <UserRound size={18} /> Mi cuenta
        </h2>
        <p className="muted">
          Actualiza tu nombre o correo. Para guardar cambios debes confirmar tu
          contraseña actual; el rol solo puede cambiarlo un administrador.
        </p>
        <form
          className="settings-grid"
          onSubmit={(event) => void saveProfile(event)}
        >
          <label>
            Nombre
            <input
              className="text-input"
              value={profile.nombre}
              onChange={(event) =>
                setProfile({ ...profile, nombre: event.target.value })
              }
              required
              maxLength={120}
            />
          </label>
          <label>
            Correo
            <input
              className="text-input"
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile({ ...profile, email: event.target.value })
              }
              required
              maxLength={254}
            />
          </label>
          <label>
            Rol asignado
            <input
              className="text-input"
              value={getRoleLabel(profile.rol)}
              readOnly
            />
          </label>
          <label>
            Contraseña actual
            <input
              className="text-input"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              minLength={1}
              maxLength={72}
              required
            />
          </label>
          <label>
            Nueva contraseña (opcional)
            <input
              className="text-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
            />
          </label>
          <label>
            Confirmar nueva contraseña
            <input
              className="text-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required={Boolean(newPassword)}
            />
          </label>
          <div>
            <button
              className="primary-button"
              type="submit"
              disabled={savingProfile}
            >
              {savingProfile ? "Guardando..." : "Guardar cambios de cuenta"}
            </button>
          </div>
        </form>
        {profileMessage && <div className="import-success">{profileMessage}</div>}
        {profileError && (
          <div className="import-error" role="alert">
            {profileError}
          </div>
        )}
      </section>

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
                readOnly={!canEdit}
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
                readOnly={!canEdit}
              />
            </label>
          ))}
        </div>

        {canEdit && (
          <button className="primary-button" onClick={() => void save()}>
            Guardar configuración
          </button>
        )}
        {mensaje && <div className="import-success">{mensaje}</div>}
        {error && <div className="import-error">{error}</div>}
      </section>
    </>
  );
}
