"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CollapsibleSection from "@/components/CollapsibleSection";
import { SkeletonPageHeader, SkeletonBlock, SkeletonLine } from "@/components/LoadingSkeleton";
import { apiFetch } from "@/lib/api";
import { useWATemplates, renderTemplate } from "@/hooks/useWATemplates";

interface StudioSettings {
  id: number;
  name: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
  workLatitude: number | null;
  workLongitude: number | null;
  workLocationName: string | null;
  workRadius: number | null;
}

interface RowError {
  row: string;
  error: string;
}

interface TableProgress {
  deleted?: number;
  total?: number;
  inserted?: number;
  errors?: RowError[];
  status: "pending" | "deleting" | "inserting" | "done" | "error";
}

interface ImportProgress {
  phase: "parsing" | "importing" | "done" | "error";
  message?: string;
  tables: Record<string, TableProgress>;
  results?: Record<string, { deleted: number; total: number; inserted: number; errors?: number }>;
}

const initialForm: StudioSettings = {
  id: 0,
  name: "Sakura Studio",
  subtitle: "Estudio de Belleza",
  address: "Plaza Las Américas II, El Cafetal, Caracas",
  phone: "Tel: 555-9876",
  email: "Email: info@sakurastudio.com",
  workLatitude: 10.4806,
  workLongitude: -66.8536,
  workLocationName: "Plaza Las Américas II, El Cafetal",
  workRadius: 200,
};

const IMPORT_TABLE_NAMES = [
  "Servicios",
  "Clientes",
  "Empleadas",
  "Productos",
  "WATemplates",
  "StudioSettings",
  "Citas",
  "Ventas",
  "SaleItems",
];

const TABLE_LABELS: Record<string, string> = {
  Servicios: "Servicios",
  Clientes: "Clientes",
  Empleadas: "Empleadas",
  Productos: "Productos",
  WATemplates: "Plantillas WA",
  StudioSettings: "Config. Estudio",
  Citas: "Citas",
  Ventas: "Ventas",
  SaleItems: "Detalle Ventas",
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<StudioSettings>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fixingSequences, setFixingSequences] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: boolean; message: string } | null>(null);

  // WhatsApp templates state
  const { templates, addTemplate, editTemplate, deleteTemplate, resetDefaults } = useWATemplates();
  const [waNewLabel, setWaNewLabel] = useState("");
  const [waNewMessage, setWaNewMessage] = useState("");
  const [waEditing, setWaEditing] = useState<{ id: number; label: string; message: string } | null>(null);
  const [waShowForm, setWaShowForm] = useState(false);

  const handleConfirmImport = async () => {
    const file = pendingImportFile;
    if (!file) return;

    setShowImportModal(false);
    setPendingImportFile(null);

    const formData = new FormData();
    formData.append("file", file);

    // Initialize progress state
    const initTables: Record<string, TableProgress> = {};
    for (const name of IMPORT_TABLE_NAMES) {
      initTables[name] = { status: "pending" };
    }
    setImportProgress({ phase: "parsing", tables: initTables });

    try {
      const res = await fetch("/api/database/import", {
        method: "POST",
        body: formData,
      });

      // Handle non-OK responses (e.g. 400 from file validation)
      if (!res.ok) {
        let errorBody = "";
        try {
          const errJson = await res.json();
          errorBody = errJson.error || JSON.stringify(errJson);
        } catch {
          try {
            errorBody = await res.text();
          } catch {
            errorBody = "No se pudo leer el cuerpo del error";
          }
        }
        console.error("Import API returned error:", {
          status: res.status,
          statusText: res.statusText,
          body: errorBody,
        });
        setImportProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "error",
                message: `Error del servidor (${res.status}): ${errorBody}`,
              }
            : null
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        console.error("Import response body is null despite OK status");
        setImportProgress((prev) =>
          prev ? { ...prev, phase: "error", message: "Error al leer la respuesta" } : null
        );
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            setImportProgress((prev) => {
              if (!prev) return prev;
              const tables = { ...prev.tables };

              switch (event.type) {
                case "status":
                  return {
                    ...prev,
                    phase: prev.phase === "parsing" ? "importing" : prev.phase,
                    message: event.message,
                  };

                case "delete_done":
                  tables[event.table] = {
                    ...tables[event.table],
                    status: "deleting",
                    deleted: event.deleted,
                  };
                  return { ...prev, phase: "importing", tables };

                case "insert_start":
                  tables[event.table] = {
                    ...tables[event.table],
                    status: "inserting",
                    total: event.total,
                    inserted: 0,
                  };
                  return { ...prev, tables };

                case "insert_done":
                  tables[event.table] = {
                    ...tables[event.table],
                    status: "done",
                    total: event.total,
                    inserted: event.inserted,
                  };
                  return { ...prev, tables };

                case "done":
                  return {
                    ...prev,
                    phase: "done",
                    message: event.message,
                    results: event.results,
                  };

                case "insert_error":
                  console.error("Import row error [" + event.table + "]:", event.row, event.error);
                  tables[event.table] = {
                    ...tables[event.table],
                    errors: [
                      ...(tables[event.table]?.errors || []),
                      { row: event.row, error: event.error },
                    ],
                  };
                  return { ...prev, tables };

                case "error":
                  return {
                    ...prev,
                    phase: "error",
                    message: event.message,
                  };

                default:
                  return prev;
              }
            });
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    } catch (err) {
      const errorDetails = {
        name: err instanceof Error ? err.name : "Unknown",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
      console.error("Import fetch failed:", errorDetails);

      let userMessage = "Error de conexión";
      if (err instanceof TypeError) {
        if (err.message === "Failed to fetch" || err.message.includes("fetch")) {
          userMessage = "Error de conexión: no se pudo conectar con el servidor";
        } else {
          userMessage = `Error de red: ${err.message}`;
        }
      } else if (err instanceof DOMException && err.name === "AbortError") {
        userMessage = "La solicitud fue cancelada";
      } else if (err instanceof Error) {
        userMessage = `Error: ${err.message}`;
      }

      setImportProgress((prev) =>
        prev
          ? { ...prev, phase: "error", message: userMessage }
          : { phase: "error", message: userMessage, tables: {} }
      );
    }

    // Safety timeout: if import takes > 90s, show error
    setTimeout(() => {
      setImportProgress((prev) => {
        if (!prev || prev.phase === "done" || prev.phase === "error") return prev;
        return { ...prev, phase: "error", message: "La importación tardó demasiado. Verifica el archivo e intenta de nuevo." };
      });
    }, 90000);
  };

  useEffect(() => {
    apiFetch<StudioSettings>("/api/studio-settings")
      .then(({ data }) => {
        if (data && data.name) {
          setSettings(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof StudioSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError("");

    try {
      const { data, error: apiError } = await apiFetch("/api/studio-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });

      if (data) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(apiError || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-fadeIn">
        <SkeletonPageHeader />
        <SkeletonBlock className="h-10 w-72" />
        <div className="card p-4 sm:p-6 space-y-5">
          {[...Array(5)].map((_, i) => (
            <SkeletonBlock key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center flex-shrink-0 mt-0.5 hidden sm:flex">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-dark break-words">Configuración del Estudio</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Estos datos aparecerán en los encabezados de los reportes PDF
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-5">
        {/* Encabezado del formulario */}
        <CollapsibleSection title="Información del Estudio">
          {/* Nombre del estudio */}
          <div>
            <label htmlFor="studio-name" className="block text-sm font-medium text-dark mb-1.5">
              Nombre del Estudio
            </label>
            <input
              id="studio-name"
              name="studio-name"
              onChange={(e) => handleChange("name", e.target.value)}
              className="input"
              placeholder="Ej: Sakura Studio"
              required
            />
            <p className="text-xs text-muted mt-1">
              Nombre principal que aparece en el encabezado de los PDFs
            </p>
          </div>

          {/* Subtítulo */}
          <div>
            <label htmlFor="studio-subtitle" className="block text-sm font-medium text-dark mb-1.5">
              Subtítulo
            </label>
            <input
              id="studio-subtitle"
              name="studio-subtitle"
              type="text"
              value={settings.subtitle}
              onChange={(e) => handleChange("subtitle", e.target.value)}
              className="input"
              placeholder="Ej: Estudio de Belleza"
              required
            />
          </div>

          {/* Dirección */}
          <div>
            <label htmlFor="studio-address" className="block text-sm font-medium text-dark mb-1.5">
              Dirección
            </label>
            <input
              id="studio-address"
              name="studio-address"
              type="text"
              value={settings.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="input"
              placeholder="Ej: Av. Las Flores #456, Col. Bella Vista"
              required
            />
          </div>

          {/* Teléfono */}
          <div>
            <label htmlFor="studio-phone" className="block text-sm font-medium text-dark mb-1.5">
              Teléfono
            </label>
            <input
              id="studio-phone"
              name="studio-phone"
              type="text"
              value={settings.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="input"
              placeholder="Ej: Tel: 555-9876"
              required
            />
          </div>

          {/* Ubicación GPS para asistencia */}
          <div className="pt-4 border-t border-border mt-2">
            <h3 className="text-sm font-semibold text-dark mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Ubicación del Estudio (para check-in GPS)
            </h3>
            <p className="text-xs text-muted mb-3">
              Las empleadas deben estar cerca de esta ubicación para registrar asistencia.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="studio-latitude" className="block text-sm font-medium text-dark mb-1.5">
                  Latitud
                </label>
                <input
                  id="studio-latitude"
                  name="studio-latitude"
                  type="number"
                  step="any"
                  value={settings.workLatitude ?? ""}
                  onChange={(e) => handleChange("workLatitude", e.target.value)}
                  className="input"
                  placeholder="Ej: 10.4806"
                />
              </div>
              <div>
                <label htmlFor="studio-longitude" className="block text-sm font-medium text-dark mb-1.5">
                  Longitud
                </label>
                <input
                  id="studio-longitude"
                  name="studio-longitude"
                  type="number"
                  step="any"
                  value={settings.workLongitude ?? ""}
                  onChange={(e) => handleChange("workLongitude", e.target.value)}
                  className="input"
                  placeholder="Ej: -66.8536"
                />
              </div>
              <div>
                <label htmlFor="studio-locationName" className="block text-sm font-medium text-dark mb-1.5">
                  Nombre de la ubicación
                </label>
                <input
                  id="studio-locationName"
                  name="studio-locationName"
                  type="text"
                  value={settings.workLocationName ?? ""}
                  onChange={(e) => handleChange("workLocationName", e.target.value)}
                  className="input"
                  placeholder="Ej: Plaza Las Américas II, El Cafetal"
                />
              </div>
              <div>
                <label htmlFor="studio-radius" className="block text-sm font-medium text-dark mb-1.5">
                  Radio de tolerancia (metros)
                </label>
                <input
                  id="studio-radius"
                  name="studio-radius"
                  type="number"
                  min={10}
                  step={10}
                  value={settings.workRadius ?? 200}
                  onChange={(e) => handleChange("workRadius", e.target.value)}
                  className="input"
                  placeholder="Ej: 200"
                />
                <p className="text-xs text-muted mt-1">Distancia máxima desde el estudio para permitir check-in.</p>
              </div>
            </div>
          </div>

          {/* Correo electrónico */}
          <div>
            <label htmlFor="studio-email" className="block text-sm font-medium text-dark mb-1.5">
              Correo Electrónico
            </label>
            <input
              id="studio-email"
              name="studio-email"
              type="text"
              value={settings.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="input"
              placeholder="Ej: info@sakurastudio.com"
              required
            />
          </div>
        </CollapsibleSection>

        {/* Mensajes de feedback */}
        {error && (
          <div className="p-3 rounded-lg bg-danger-bg border border-danger/20 text-sm text-danger font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-lg bg-success-bg border border-success/20 text-sm text-success font-medium space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Datos guardados exitosamente</span>
            </div>
            <button
              type="button"
              onClick={() => router.push("/reportes")}
              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-success text-white text-xs font-medium hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              Ir a Reportes
            </button>
          </div>
        )}

        {/* ═══════════════ Base de Datos ═══════════════ */}
        <div className="pt-6 border-t border-border -mx-4 sm:-mx-6 px-4 sm:px-6">
          <CollapsibleSection title="Base de Datos">

          <p className="text-xs text-muted mb-4">
            Exporta toda la base de datos como archivo Excel para respaldo, o importa un archivo Excel para restaurar los datos.
            <span className="block mt-1 font-medium text-amber-600">
              ⚠ La importación reemplazará todos los datos existentes.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Export button */}
            <a
              href="/api/database/export"
              download
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-primary/40 transition-all duration-200"
            >
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar Base de Datos
            </a>

            {/* Import — file input + button */}
            <button
              type="button"
              onClick={() => document.getElementById("import-file-input")?.click()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-dashed border-emerald-300 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all duration-200 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Importar Base de Datos
            </button>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPendingImportFile(file);
                setShowImportModal(true);
                // Reset file input so re-selecting the same file still triggers onChange
                e.target.value = "";
              }}
            />

            {/* Fix sequences button */}
            <button
              type="button"
              onClick={async () => {
                setFixingSequences(true);
                setFixResult(null);
                try {
                  const res = await fetch("/api/database/fix-sequences", { method: "POST" });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    const details = data.results
                      .filter((r: {success: boolean}) => r.success)
                      .map((r: {label: string; newValue: number}) => `${r.label}: ${r.newValue}`)
                      .join(", ");
                    setFixResult({
                      success: true,
                      message: `✅ Secuencias corregidas (${details})`,
                    });
                  } else {
                    setFixResult({
                      success: false,
                      message: data.error || "Error al corregir secuencias",
                    });
                  }
                } catch {
                  setFixResult({
                    success: false,
                    message: "Error de conexión al corregir secuencias",
                  });
                } finally {
                  setFixingSequences(false);
                }
              }}
              disabled={fixingSequences}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-violet-300 bg-violet-50/40 text-violet-700 hover:bg-violet-50 hover:border-violet-400 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fixingSequences ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Corrigiendo...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M6.75 6.75l3.682 3.682" />
                  </svg>
                  Corregir Secuencias Auto-Increment
                </>
              )}
            </button>

            {/* Fix result feedback */}
            {fixResult && (
              <div className={`mt-2 p-3 rounded-lg text-xs font-medium ${
                fixResult.success
                  ? "bg-violet-50 border border-violet-200 text-violet-700"
                  : "bg-danger-bg border border-danger/20 text-danger"
              }`}>
                <div className="flex items-center gap-2">
                  {fixResult.success ? (
                    <svg className="w-4 h-4 flex-shrink-0 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                  <span>{fixResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFixResult(null)}
                  className="mt-1.5 text-xs font-medium underline hover:no-underline opacity-70 hover:opacity-100 transition-opacity"
                >
                  Descartar
                </button>
              </div>
            )}
          </div>

          {/* Import progress */}
          {importProgress && importProgress.phase !== "done" && (
            <div className="mt-3 rounded-xl border border-border bg-white overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border">
                {importProgress.phase === "error" ? (
                  <div className="w-6 h-6 rounded-full bg-danger-bg flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <svg className="w-5 h-5 text-primary animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-dark">
                    {importProgress.phase === "error"
                      ? "Error al importar"
                      : importProgress.message || "Importando datos..."}
                  </p>
                  {importProgress.phase !== "error" && (
                    <p className="text-xs text-muted mt-0.5">
                      {Object.values(importProgress.tables).filter(
                        (t) => t.status === "done"
                      ).length}{" "}
                      de {IMPORT_TABLE_NAMES.length} tablas completadas
                    </p>
                  )}
                </div>
              </div>

              {/* Per-table progress */}
              <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
                {IMPORT_TABLE_NAMES.map((name) => {
                  const t = importProgress.tables[name] || {
                    status: "pending",
                  };
                  return (
                    <div
                      key={name}
                      className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${
                        t.status === "inserting"
                          ? "bg-primary-bg/40"
                          : t.status === "done"
                          ? "bg-success-bg/30"
                          : ""
                      }`}
                    >
                      {/* Status icon */}
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {t.status === "done" ? (
                          <svg
                            className="w-4 h-4 text-success"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        ) : t.status === "inserting" || t.status === "deleting" ? (
                          <svg
                            className="w-4 h-4 text-primary animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-border" />
                        )}
                      </div>

                      {/* Table name */}
                      <span
                        className={`text-xs font-medium flex-1 min-w-0 ${
                          t.status === "done"
                            ? "text-success"
                            : t.status === "inserting"
                            ? "text-primary"
                            : "text-muted"
                        }`}
                      >
                        {TABLE_LABELS[name] || name}
                      </span>

                      {/* Counts */}
                      <span className="text-xs text-muted flex-shrink-0 whitespace-nowrap">
                        {t.status === "done" && t.total != null
                          ? `${t.inserted} / ${t.total}`
                          : t.status === "inserting" && t.total != null
                          ? `${t.inserted || 0} / ${t.total}`
                          : t.status === "deleting"
                          ? `${t.deleted} eliminados`
                          : ""}
                        {t.errors && t.errors.length > 0 && (
                          <span className="text-danger ml-1" title={t.errors.map(e => `${e.row}: ${e.error}`).join('; ')}>
                            ({t.errors.length} errores)
                          </span>
                        )}
                      </span>

                      {/* Mini progress bar during insert */}
                      {t.status === "inserting" &&
                        t.total != null &&
                        t.total > 0 && (
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                              style={{
                                width: `${Math.min(
                                  ((t.inserted || 0) / t.total) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>

              {/* Error message */}
              {importProgress.phase === "error" && importProgress.message && (
                <div className="px-4 py-2.5 border-t border-border bg-danger-bg/30">
                  <p className="text-xs font-medium text-danger">
                    {importProgress.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Import success */}
          {importProgress && importProgress.phase === "done" && (
            <div className="mt-3 rounded-xl border border-success/30 bg-success-bg/30 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-success/20">
                <div className="w-6 h-6 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-success">
                    {importProgress.message || "Importación exitosa"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {IMPORT_TABLE_NAMES.length} tablas procesadas
                  </p>
                </div>
              </div>

              {/* Summary per table */}
              {importProgress.results && (
                <div className="px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {IMPORT_TABLE_NAMES.map((name) => {
                    const r = importProgress.results?.[name];
                    if (!r) return null;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between py-1 px-2 rounded-lg"
                      >
                        <span className="text-xs font-medium text-dark">
                          {TABLE_LABELS[name] || name}
                        </span>
                        <span className="text-xs text-muted">
                          {r.inserted > 0
                            ? `${r.inserted} insertados`
                            : "Sin cambios"}
                          {r.deleted > 0 && (
                            <span className="text-amber-600 ml-1">
                              ({r.deleted} eliminados)
                            </span>
                          )}
                          {r.errors != null && r.errors > 0 && (
                            <span className="text-danger ml-1">
                              ({r.errors} errores)
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-2.5 border-t border-success/20 bg-white/50">
                <button
                  type="button"
                  onClick={() => setImportProgress(null)}
                  className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
          </CollapsibleSection>
        </div>

        {/* ═══════════════ Plantillas WhatsApp ═══════════════ */}
        <div className="pt-6 border-t border-border -mx-4 sm:-mx-6 px-4 sm:px-6">
          <CollapsibleSection title="Plantillas de WhatsApp">
            <p className="text-xs text-muted mb-4">
              Gestiona las plantillas de mensajes para WhatsApp. Usa <code className="text-[#25D366] bg-[#25D366]/10 px-1 rounded text-[11px]">{"{nombre}"}</code> o <code className="text-[#25D366] bg-[#25D366]/10 px-1 rounded text-[11px]">{"[nombre]"}</code> para el nombre del cliente.
            </p>

            {/* Add new / Edit form */}
            {(waShowForm || waEditing) && (
              <div className="mb-4 p-4 bg-surface rounded-xl border border-border">
                <h4 className="text-sm font-medium text-dark mb-3">
                  {waEditing ? "Editar plantilla" : "Nueva plantilla"}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Etiqueta</label>
                    <input
                      type="text"
                      value={waEditing ? waEditing.label : waNewLabel}
                      onChange={(e) =>
                        waEditing
                          ? setWaEditing({ ...waEditing, label: e.target.value })
                          : setWaNewLabel(e.target.value)
                      }
                      className="input py-2 text-sm"
                      placeholder="Ej: Recordatorio"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Mensaje</label>
                    <textarea
                      value={waEditing ? waEditing.message : waNewMessage}
                      onChange={(e) =>
                        waEditing
                          ? setWaEditing({ ...waEditing, message: e.target.value })
                          : setWaNewMessage(e.target.value)
                      }
                      className="input min-h-[80px] resize-none text-sm"
                      placeholder="Ej: Hola {nombre}, recordatorio..."
                      maxLength={500}
                    />
                    <p className="text-[11px] text-muted mt-1">
                      <code className="text-[#25D366]">{"{nombre}"}</code> se reemplazará con el nombre del cliente
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (waEditing) {
                          editTemplate(waEditing.id, waEditing.label, waEditing.message);
                          setWaEditing(null);
                        } else {
                          addTemplate(waNewLabel, waNewMessage);
                          setWaNewLabel("");
                          setWaNewMessage("");
                        }
                        setWaShowForm(false);
                      }}
                      disabled={
                        waEditing
                          ? !waEditing.label.trim() || !waEditing.message.trim()
                          : !waNewLabel.trim() || !waNewMessage.trim()
                      }
                      className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-medium hover:bg-[#20BD5C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {waEditing ? "Guardar cambios" : "Agregar plantilla"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWaEditing(null);
                        setWaShowForm(false);
                        setWaNewLabel("");
                        setWaNewMessage("");
                      }}
                      className="px-3 py-1.5 btn-secondary text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Template list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p className="text-sm">No hay plantillas. ¡Crea una!</p>
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border group hover:border-primary/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dark">{tpl.label}</p>
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">
                        {renderTemplate(tpl.message, "Cliente")}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setWaEditing({ id: tpl.id, label: tpl.label, message: tpl.message });
                          setWaShowForm(false);
                          setWaNewLabel("");
                          setWaNewMessage("");
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-danger-bg text-muted hover:text-danger transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add template + Restore defaults */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setWaEditing(null);
                  setWaShowForm(true);
                  setWaNewLabel("");
                  setWaNewMessage("");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#25D366] text-white hover:bg-[#20BD5C] transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nueva plantilla
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("¿Restaurar plantillas por defecto? Las personalizadas se perderán.")) {
                    resetDefaults();
                  }
                }}
                className="flex items-center gap-1 text-xs text-muted hover:text-dark transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restaurar defaults
              </button>
            </div>
          </CollapsibleSection>
        </div>

        {/* ═══════════════ Reset App ═══════════════ */}
        <div className="pt-6 border-t border-border -mx-4 sm:-mx-6 px-4 sm:px-6">
          <CollapsibleSection title="Resetear Aplicación">
            <p className="text-xs text-muted mb-4">
              Elimina todos los datos (clientes, servicios, citas, ventas, inventario, empleadas) y
              restaura la aplicación a su estado de fábrica.
              <span className="block mt-1 font-medium text-danger">
                ⚠ Esta acción es irreversible. Se recomienda exportar un respaldo antes.
              </span>
            </p>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-danger/30 bg-danger-bg/50 text-danger hover:bg-danger-bg hover:border-danger/60 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M6.75 6.75l3.682 3.682" />
              </svg>
              Resetear App a Valores de Fábrica
            </button>

            {resetResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
                resetResult.success
                  ? "bg-success-bg border border-success/20 text-success"
                  : "bg-danger-bg border border-danger/20 text-danger"
              }`}>
                <div className="flex items-center gap-2">
                  {resetResult.success ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                  <span>{resetResult.message}</span>
                </div>
                {resetResult.success && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetResult(null);
                      router.refresh();
                    }}
                    className="mt-2 text-xs font-medium underline hover:no-underline transition-colors"
                  >
                    Descartar
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* Botones */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => {
              // Intentar volver atrás, sino ir a reportes
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/reportes");
              }
            }}
            className="btn-secondary justify-center"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Guardando...
              </span>
            ) : (
              "Guardar Cambios"
            )}
          </button>
        </div>
      </form>

      {/* ═══════════════ Modal Reset App ═══════════════ */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!resetting) {
              setShowResetModal(false);
            }
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-danger-bg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-dark">
                  ¿Resetear la aplicación?
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="p-4 rounded-xl bg-danger-bg border border-danger/20">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      ⚠ Se eliminarán TODOS los datos
                    </p>
                    <ul className="mt-2 text-xs text-danger/80 space-y-1">
                      <li>• Clientes, servicios, empleadas y productos</li>
                      <li>• Citas, ventas y detalle de ventas</li>
                      <li>• Plantillas de WhatsApp y configuración del estudio</li>
                      <li>• Registros de auditoría</li>
                    </ul>
                    <p className="mt-2 text-xs font-medium text-danger/90">
                      Solo se conservarán: Admin (0000), Cliente de Paso y plantillas WA.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-amber-700">
                      ¿Exportaste un respaldo?
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Usa el botón "Exportar Base de Datos" arriba si quieres guardar tus datos antes de resetear.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface/50">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetResult(null);
                }}
                disabled={resetting}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-dark hover:bg-border/50 transition-all duration-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setResetting(true);
                  setResetResult(null);
                  try {
                    const res = await fetch("/api/database/reset", { method: "POST" });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      setResetResult({ success: true, message: data.message });
                      setShowResetModal(false);
                    } else {
                      setResetResult({ success: false, message: data.error || "Error al resetear" });
                    }
                  } catch {
                    setResetResult({ success: false, message: "Error de conexión al resetear la app" });
                  } finally {
                    setResetting(false);
                    setShowResetModal(false);
                  }
                }}
                disabled={resetting}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-danger text-white hover:brightness-110 transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Reseteando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M6.75 6.75l3.682 3.682" />
                    </svg>
                    Resetear Ahora
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Modal de Confirmación Importar ═══════════════ */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowImportModal(false);
            setPendingImportFile(null);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-dark">
                  ¿Importar Base de Datos?
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-dark">
                    Archivo seleccionado
                  </p>
                  <p className="text-sm text-muted truncate">
                    {pendingImportFile?.name}
                  </p>
                </div>
                <span className="text-xs text-muted flex-shrink-0 ml-auto">
                  {(pendingImportFile?.size ?? 0) > 1024 * 1024
                    ? `${((pendingImportFile?.size ?? 0) / (1024 * 1024)).toFixed(1)} MB`
                    : `${((pendingImportFile?.size ?? 0) / 1024).toFixed(0)} KB`}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-danger-bg border border-danger/20">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      ⚠ Se reemplazarán TODOS los datos actuales
                    </p>
                    <ul className="mt-2 text-xs text-danger/80 space-y-1">
                      <li>• Clientes, servicios, empleadas y productos</li>
                      <li>• Citas, ventas y detalle de ventas</li>
                      <li>• Plantillas de WhatsApp y configuración del estudio</li>
                    </ul>
                    <p className="mt-2 text-xs font-medium text-danger/90">
                      Se recomienda exportar un respaldo antes de importar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface/50">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setPendingImportFile(null);
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-dark hover:bg-border/50 transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-lg text-sm font-medium bg-danger text-white hover:brightness-110 transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importar Ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
