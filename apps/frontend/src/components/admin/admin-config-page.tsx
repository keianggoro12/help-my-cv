"use client";

/**
 * Config: which model Auto CV calls and with which key, plus the log of what
 * it has been asked to do.
 *
 * The key field is write-only. The backend tells the page whether one exists
 * (`hasApiKey`) and what a saved key's placeholder should say; the value is
 * never read back, so the admin re-pastes it only when rotating. The log below
 * the form is what turns a vague "it didn't work" into "rate limited at 14:02",
 * which is why every save, check and generate lands there.
 */

import type { AiConfig, AiConfigPayload, AiLogEntry, AiProviderId } from "@helpmycv/shared";
import { AI_DEFAULT_MODELS, AI_MODELS } from "@helpmycv/shared";
import { Loader2, Save, CheckCheck } from "lucide-react";
import * as React from "react";

import {
  DataTable,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
} from "@/components/admin/data-table";
import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, type AiConfigs } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const PROVIDERS: AiProviderId[] = ["openai", "anthropic", "gemini"];

/** Save-form failures: 422 codes from the config route plus engine codes. */
const ERROR_KEYS: Record<string, string> = {
  ai_provider_unknown: "admin.aiProviderRequired",
  ai_model_required: "admin.aiModelRequired",
  not_configured: "admin.aiKeyRequired",
  invalid_key: "autoResume.invalidKey",
  rate_limited: "autoResume.rateLimited",
  network_error: "autoResume.networkError",
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

export function AdminConfigPage() {
  const { t, locale } = useSession();
  const { toast } = useToast();

  const [configs, setConfigs] = React.useState<AiConfigs>({
    openai: null,
    anthropic: null,
    gemini: null,
  });
  const [logs, setLogs] = React.useState<AiLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Per-provider form state
  const [models, setModels] = React.useState<Record<AiProviderId, string>>({
    openai: AI_DEFAULT_MODELS.openai,
    anthropic: AI_DEFAULT_MODELS.anthropic,
    gemini: AI_DEFAULT_MODELS.gemini,
  });
  const [modelTouched, setModelTouched] = React.useState<Record<AiProviderId, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const [apiKeys, setApiKeys] = React.useState<Record<AiProviderId, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
  });
  const [saving, setSaving] = React.useState<AiProviderId | null>(null);
  const [checking, setChecking] = React.useState<AiProviderId | null>(null);

  React.useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const [configsRes, logsRes] = await Promise.all([api.aiConfigs(), api.aiLogs()]);
          if (cancelled) return;
          setConfigs(configsRes.configs);
          setLogs(logsRes.logs ?? []);
          // Populate model fields from saved configs
          for (const provider of PROVIDERS) {
            const cfg = configsRes.configs[provider];
            if (cfg) {
              setModels((prev) => ({ ...prev, [provider]: cfg.model }));
            }
          }
        } catch (error) {
          console.error("ai config load failed", error);
          toast({ type: "error", title: t("admin.aiLoadFailed") });
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [t, toast]);

    function handleProviderModelChange(provider: AiProviderId, value: string) {
      setModels((prev) => ({ ...prev, [provider]: value }));
      setModelTouched((prev) => ({ ...prev, [provider]: true }));
    }

    async function handleSave(provider: AiProviderId, event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (saving) return;

      const model = models[provider].trim();
      if (model === "") {
        toast({ type: "error", title: t("admin.aiModelRequired") });
        return;
      }
      const hasStoredKey = configs[provider]?.hasApiKey ?? false;
      if (!hasStoredKey && apiKeys[provider].trim() === "") {
        toast({ type: "error", title: t("admin.aiKeyRequired") });
        return;
      }

      setSaving(provider);
      try {
        const payload: AiConfigPayload = {
          provider,
          model,
          // A blank field means "keep the key that is already stored", which is
          // how the form saves a model change without re-typing the secret.
          ...(apiKeys[provider].trim() === "" ? {} : { apiKey: apiKeys[provider] }),
        };
        const res = await api.saveAiConfig(payload);
        setConfigs((prev) => ({ ...prev, [provider]: res.config }));
        setApiKeys((prev) => ({ ...prev, [provider]: "" }));
        toast({ type: "success", title: t("admin.aiSaved") });
        const logsRes = await api.aiLogs();
        setLogs(logsRes.logs ?? []);
      } catch (error) {
        console.error("ai config save failed", error);
        const code = error instanceof ApiError ? error.code : "";
        toast({ type: "error", title: t((ERROR_KEYS[code] ?? "admin.aiLoadFailed") as never) });
      } finally {
        setSaving(null);
      }
    }

    async function handleCheck(provider: AiProviderId) {
      if (checking || saving) return;
      setChecking(provider);
      try {
        // Temporarily save this provider's config to check it
        const model = models[provider].trim();
        if (model === "") {
          toast({ type: "error", title: t("admin.aiModelRequired") });
          return;
        }
        const hasStoredKey = configs[provider]?.hasApiKey ?? false;
        if (!hasStoredKey && apiKeys[provider].trim() === "") {
          toast({ type: "error", title: t("admin.aiKeyRequired") });
          return;
        }

        // Save first (so the check uses the current model/key), then check
        await api.saveAiConfig({
          provider,
          model,
          ...(apiKeys[provider].trim() === "" ? {} : { apiKey: apiKeys[provider] }),
        });
        const res = await api.checkAiConfig();
        toast({
          type: res.ok ? "success" : "error",
          title: t(res.ok ? "admin.aiCheckOk" : "admin.aiCheckFailed"),
        });
      } catch (error) {
        console.error("ai config check failed", error);
        toast({ type: "error", title: t("admin.aiCheckFailed") });
      } finally {
        setChecking(null);
        try {
          const logsRes = await api.aiLogs();
          setLogs(logsRes.logs ?? []);
        } catch {
          // The result toast already told the admin what happened; a failed log
          // refresh is not worth a second error on top of it.
        }
      }
    }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        {t("admin.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.configTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.configSubtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const cfg = configs[provider];
          const hasStoredKey = cfg?.hasApiKey ?? false;
          const isSaving = saving === provider;
          const isChecking = checking === provider;

          return (
            <form
              key={provider}
              onSubmit={(e) => handleSave(provider, e)}
              className="space-y-4 rounded-2xl border bg-card p-6"
            >
              <div className="space-y-2">
                <FieldLabel htmlFor={`ai-provider-${provider}`}>{t("admin.aiProviderLabel")}</FieldLabel>
                <Select
                  id={`ai-provider-${provider}`}
                  value={provider}
                  onChange={() => {}} // Disabled - one card per provider
                  disabled
                >
                  <option value={provider}>{PROVIDER_LABELS[provider]}</option>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor={`ai-model-${provider}`}>{t("admin.aiModelLabel")}</FieldLabel>
                <Select
                  id={`ai-model-${provider}`}
                  value={models[provider]}
                  onChange={(event) => handleProviderModelChange(provider, event.target.value)}
                  disabled={isSaving}
                >
                  {AI_MODELS[provider].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor={`ai-api-key-${provider}`} required={!hasStoredKey}>
                  {t("admin.aiApiKeyLabel")}
                </FieldLabel>
                <Input
                  id={`ai-api-key-${provider}`}
                  type="password"
                  value={apiKeys[provider]}
                  onChange={(event) => setApiKeys((prev) => ({ ...prev, [provider]: event.target.value }))}
                  placeholder={hasStoredKey ? "••••••••" : t("admin.aiApiKeyPlaceholder")}
                  autoComplete="off"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  {hasStoredKey ? t("admin.aiKeyStored") : t("admin.aiApiKeyPlaceholder")}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCheck(provider)}
                  disabled={isSaving || isChecking}
                >
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <CheckCheck className="mr-2 h-4 w-4" aria-hidden />
                      {t("admin.aiCheck")}
                    </>
                  )}
                </Button>
                <Button type="submit" disabled={isSaving || isChecking}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
                  {t("admin.aiSave")}
                </Button>
              </div>
            </form>
          );
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t("admin.aiLogTitle")}</h2>
        <DataTable minWidth="560px">
          <thead>
            <tr>
              <DataTableHead>{t("admin.aiLogKind")}</DataTableHead>
              <DataTableHead>{t("admin.aiLogStatus")}</DataTableHead>
              <DataTableHead>{t("admin.aiLogMessage")}</DataTableHead>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <DataTableEmptyRow colSpan={3}>{t("admin.aiLogEmpty")}</DataTableEmptyRow>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <DataTableCell>
                    {t((log.kind === "check" ? "admin.aiKindCheck" : "admin.aiKindGenerate") as never)}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={log.status === "ok" ? "default" : "destructive"}>
                      {t((log.status === "ok" ? "admin.aiStatusOk" : "admin.aiStatusError") as never)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-xs">
                    <span className="block break-all">{log.message}</span>
                    <span className="block text-muted-foreground">
                      {[log.provider, log.model].filter(Boolean).join(" / ")}
                      {log.provider || log.model ? " · " : ""}
                      {formatDate(log.createdAt, locale)}
                    </span>
                  </DataTableCell>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}
