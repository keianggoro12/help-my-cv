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

import type { AiConfig, AiLogEntry, AiProviderId } from "@helpmycv/shared";
import { Loader2 } from "lucide-react";
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
import { ApiError, api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const PROVIDERS: AiProviderId[] = ["openai", "anthropic", "gemini"];

/**
 * Starting values, so a fresh Config screen already says something plausible
 * for each provider rather than showing an empty box the admin has to guess at.
 */
const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.5-flash",
};

/** Save-form failures: 422 codes from the config route plus engine codes. */
const ERROR_KEYS: Record<string, string> = {
  ai_provider_unknown: "admin.aiProviderLabel",
  ai_model_required: "admin.aiModelRequired",
  not_configured: "admin.aiKeyRequired",
  invalid_key: "autoResume.invalidKey",
  rate_limited: "autoResume.rateLimited",
  network_error: "autoResume.networkError",
};

export function AdminConfigPage() {
  const { t, locale } = useSession();
  const { toast } = useToast();

  const [config, setConfig] = React.useState<AiConfig | null>(null);
  const [logs, setLogs] = React.useState<AiLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [provider, setProvider] = React.useState<AiProviderId>("openai");
  const [model, setModel] = React.useState<string>(DEFAULT_MODELS.openai);
  const [modelTouched, setModelTouched] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [configRes, logsRes] = await Promise.all([api.aiConfig(), api.aiLogs()]);
        if (cancelled) return;
        setConfig(configRes.config);
        setLogs(logsRes.logs ?? []);
        if (configRes.config) {
          setProvider(configRes.config.provider);
          setModel(configRes.config.model);
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

  const hasStoredKey = config?.hasApiKey ?? false;

  function handleProviderChange(next: AiProviderId) {
    setProvider(next);
    // Only swap the model when it still holds a default the admin never typed
    // over; a hand-written model id must survive a provider experiment.
    if (!modelTouched) {
      setModel(DEFAULT_MODELS[next]);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (model.trim() === "") {
      toast({ type: "error", title: t("admin.aiModelRequired") });
      return;
    }
    if (!hasStoredKey && apiKey.trim() === "") {
      toast({ type: "error", title: t("admin.aiKeyRequired") });
      return;
    }

    setSaving(true);
    try {
      const res = await api.saveAiConfig({
        provider,
        model: model.trim(),
        // A blank field means "keep the key that is already stored", which is
        // how the form saves a model change without re-typing the secret.
        ...(apiKey.trim() === "" ? {} : { apiKey: apiKey.trim() }),
      });
      setConfig(res.config);
      setApiKey("");
      toast({ type: "success", title: t("admin.aiSaved") });
      const logsRes = await api.aiLogs();
      setLogs(logsRes.logs ?? []);
    } catch (error) {
      console.error("ai config save failed", error);
      const code = error instanceof ApiError ? error.code : "";
      toast({ type: "error", title: t((ERROR_KEYS[code] ?? "admin.aiLoadFailed") as never) });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck() {
    if (checking || saving) return;
    setChecking(true);
    try {
      const res = await api.checkAiConfig();
      toast({
        type: res.ok ? "success" : "error",
        title: t(res.ok ? "admin.aiCheckOk" : "admin.aiCheckFailed"),
      });
    } catch (error) {
      console.error("ai config check failed", error);
      toast({ type: "error", title: t("admin.aiCheckFailed") });
    } finally {
      setChecking(false);
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

      <form onSubmit={handleSave} className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="ai-provider">{t("admin.aiProviderLabel")}</FieldLabel>
            <Select
              id="ai-provider"
              value={provider}
              onChange={(event) => handleProviderChange(event.target.value as AiProviderId)}
              disabled={saving}
            >
              {PROVIDERS.map((item) => (
                <option key={item} value={item}>
                  {item === "openai" ? "OpenAI" : item === "anthropic" ? "Anthropic" : "Google Gemini"}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="ai-model">{t("admin.aiModelLabel")}</FieldLabel>
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setModelTouched(true);
              }}
              placeholder={DEFAULT_MODELS[provider]}
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="ai-api-key" required={!hasStoredKey}>
            {t("admin.aiApiKeyLabel")}
          </FieldLabel>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              hasStoredKey ? t("admin.aiKeyStored") : t("admin.aiApiKeyPlaceholder")
            }
            autoComplete="off"
            disabled={saving}
          />
          <p className="text-xs text-muted-foreground">
            {hasStoredKey ? t("admin.aiKeyStored") : t("admin.aiApiKeyPlaceholder")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCheck}
            disabled={checking || saving}
          >
            {checking ? t("admin.aiChecking") : t("admin.aiCheck")}
          </Button>
          <Button type="submit" disabled={saving || checking}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("admin.aiSave")}
          </Button>
        </div>
      </form>

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
