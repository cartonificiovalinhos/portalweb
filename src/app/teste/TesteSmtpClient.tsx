"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type TestResult = {
  host: string;
  user: string;
  commands: string[];
  tests: {
    tcp465: {
      ok: boolean;
      status: string;
      message: string;
      elapsedMs: number;
      port: number;
    };
    tcp587: {
      ok: boolean;
      status: string;
      message: string;
      elapsedMs: number;
      port: number;
    };
    nodemailerVerify: {
      ok: boolean;
      skipped?: boolean;
      source: string;
      elapsedMs?: number;
      message: string;
      config?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        connectionTimeout: number;
      };
      error?: {
        message: string;
        code: string | null;
        responseCode: number | null;
        command: string | null;
      };
    };
  };
};

function ResultCard({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className={`mb-2 text-sm font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>{title}</div>
      <div className="space-y-1 text-sm text-gray-800">{children}</div>
    </div>
  );
}

export default function TesteSmtpClient() {
  const [data, setData] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teste", { cache: "no-store" });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`);
      setData(body);
    } catch (err: any) {
      setError(err?.message || String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Teste SMTP KingHost</h1>
              <p className="mt-1 text-sm text-gray-600">
                Esta página executa os testes diretamente no servidor do aplicativo, equivalentes aos comandos de conectividade IPv4 e ao verify do Nodemailer.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Executar novamente
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded border bg-gray-50 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-700">Comandos equivalentes no Linux</div>
              <div className="space-y-2">
                {(data?.commands || [
                  "nc -4 -zv -w 5 smtp.kinghost.net 465",
                  "nc -4 -zv -w 5 smtp.kinghost.net 587",
                ]).map((command) => (
                  <pre key={command} className="overflow-x-auto rounded bg-gray-900 px-3 py-2 text-xs text-gray-100">
                    {command}
                  </pre>
                ))}
              </div>
            </div>

            <div className="rounded border bg-gray-50 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-700">Configuração do teste Nodemailer</div>
              <pre className="overflow-x-auto rounded bg-gray-900 px-3 py-2 text-xs text-gray-100">{`const transporter = nodemailer.createTransport({
  host: "smtp.kinghost.net",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@cartonificiovalinhos.com.br",
    pass: process.env.SMTP_PASSWORD
  },
  connectionTimeout: 10000
});`}</pre>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="rounded border bg-white px-4 py-8 text-center text-sm text-gray-600 shadow-sm">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Executando testes no servidor...
            </span>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="rounded border bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Host</div>
                  <div className="text-sm text-gray-900">{data.host}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Usuário</div>
                  <div className="text-sm text-gray-900">{data.user}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard title="Teste TCP 465" ok={data.tests.tcp465.ok}>
                <div>Status: {data.tests.tcp465.status}</div>
                <div>Tempo: {data.tests.tcp465.elapsedMs} ms</div>
                <div>{data.tests.tcp465.message}</div>
              </ResultCard>

              <ResultCard title="Teste TCP 587" ok={data.tests.tcp587.ok}>
                <div>Status: {data.tests.tcp587.status}</div>
                <div>Tempo: {data.tests.tcp587.elapsedMs} ms</div>
                <div>{data.tests.tcp587.message}</div>
              </ResultCard>
            </div>

            <ResultCard
              title="Nodemailer verify (465 / secure)"
              ok={Boolean(data.tests.nodemailerVerify.ok)}
            >
              <div>Status da senha: {data.tests.nodemailerVerify.source}</div>
              {typeof data.tests.nodemailerVerify.elapsedMs === "number" && (
                <div>Tempo: {data.tests.nodemailerVerify.elapsedMs} ms</div>
              )}
              <div>{data.tests.nodemailerVerify.message}</div>
              {data.tests.nodemailerVerify.config && (
                <div>
                  Configuração: {data.tests.nodemailerVerify.config.host}:{data.tests.nodemailerVerify.config.port} | secure:{" "}
                  {data.tests.nodemailerVerify.config.secure ? "true" : "false"} | timeout:{" "}
                  {data.tests.nodemailerVerify.config.connectionTimeout}ms
                </div>
              )}
              {data.tests.nodemailerVerify.error && (
                <>
                  <div>Erro: {data.tests.nodemailerVerify.error.message}</div>
                  {data.tests.nodemailerVerify.error.code && <div>Code: {data.tests.nodemailerVerify.error.code}</div>}
                  {data.tests.nodemailerVerify.error.command && <div>Command: {data.tests.nodemailerVerify.error.command}</div>}
                  {typeof data.tests.nodemailerVerify.error.responseCode === "number" && (
                    <div>ResponseCode: {data.tests.nodemailerVerify.error.responseCode}</div>
                  )}
                </>
              )}
            </ResultCard>
          </div>
        )}
      </div>
    </main>
  );
}
