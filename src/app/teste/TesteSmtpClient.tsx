"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type TestResult = {
  host: string;
  user: string;
  commands: string[];
  tests: {
    kinghost465: {
      ok: boolean;
      status: string;
      message: string;
      elapsedMs: number;
      port: number;
    };
    kinghost587: {
      ok: boolean;
      status: string;
      message: string;
      elapsedMs: number;
      port: number;
    };
    gmail465: {
      ok: boolean;
      status: string;
      message: string;
      elapsedMs: number;
      port: number;
    };
    office365587: {
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
        servername?: string;
      };
      error?: {
        message: string;
        code: string | null;
        responseCode: number | null;
        command: string | null;
      };
      resolvedIpv4?: string | null;
    };
    nodemailerVerifyIpv4: {
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
        servername?: string;
      };
      error?: {
        message: string;
        code: string | null;
        responseCode: number | null;
        command: string | null;
      };
      resolvedIpv4?: string | null;
    };
    publicIpv4: {
      ok: boolean;
      elapsedMs: number;
      ip: string | null;
      status: number | null;
      message: string;
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
              <div className="mb-2 text-sm font-semibold text-gray-700">Proximos testes recomendados</div>
              <div className="space-y-2">
                {(data?.commands || [
                  "nc -4 -zv -w 5 smtp.kinghost.net 465",
                  "nc -4 -zv -w 5 smtp.kinghost.net 587",
                  "nc -4 -zv -w 5 smtp.gmail.com 465",
                  "nc -4 -zv -w 5 smtp.office365.com 587",
                  "curl -4 -s https://api.ipify.org",
                ]).map((command) => (
                  <pre key={command} className="overflow-x-auto rounded bg-gray-900 px-3 py-2 text-xs text-gray-100">
                    {command}
                  </pre>
                ))}
              </div>
            </div>

            <div className="rounded border bg-gray-50 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-700">Configuracao do teste Nodemailer</div>
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

          <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            A documentacao da KingHost confirma `smtp.kinghost.net:465` com SSL como configuracao valida.
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
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Host</div>
                  <div className="text-sm text-gray-900">{data.host}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Usuário</div>
                  <div className="text-sm text-gray-900">{data.user}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">IP público de saída</div>
                  <div className="text-sm text-gray-900">{data.tests.publicIpv4.ip || "-"}</div>
                  <div className="text-xs text-gray-500">{data.tests.publicIpv4.message}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ResultCard title="KingHost TCP 465" ok={data.tests.kinghost465.ok}>
                <div>Status: {data.tests.kinghost465.status}</div>
                <div>Tempo: {data.tests.kinghost465.elapsedMs} ms</div>
                <div>{data.tests.kinghost465.message}</div>
              </ResultCard>

              <ResultCard title="KingHost TCP 587" ok={data.tests.kinghost587.ok}>
                <div>Status: {data.tests.kinghost587.status}</div>
                <div>Tempo: {data.tests.kinghost587.elapsedMs} ms</div>
                <div>{data.tests.kinghost587.message}</div>
              </ResultCard>

              <ResultCard title="Gmail TCP 465" ok={data.tests.gmail465.ok}>
                <div>Status: {data.tests.gmail465.status}</div>
                <div>Tempo: {data.tests.gmail465.elapsedMs} ms</div>
                <div>{data.tests.gmail465.message}</div>
              </ResultCard>

              <ResultCard title="Office365 TCP 587" ok={data.tests.office365587.ok}>
                <div>Status: {data.tests.office365587.status}</div>
                <div>Tempo: {data.tests.office365587.elapsedMs} ms</div>
                <div>{data.tests.office365587.message}</div>
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

            <ResultCard
              title="Nodemailer verify com IPv4 resolvido"
              ok={Boolean(data.tests.nodemailerVerifyIpv4.ok)}
            >
              <div>Status da senha: {data.tests.nodemailerVerifyIpv4.source}</div>
              <div>IPv4 resolvido: {data.tests.nodemailerVerifyIpv4.resolvedIpv4 || "-"}</div>
              {typeof data.tests.nodemailerVerifyIpv4.elapsedMs === "number" && (
                <div>Tempo: {data.tests.nodemailerVerifyIpv4.elapsedMs} ms</div>
              )}
              <div>{data.tests.nodemailerVerifyIpv4.message}</div>
              {data.tests.nodemailerVerifyIpv4.config && (
                <div>
                  Configuração: {data.tests.nodemailerVerifyIpv4.config.host}:{data.tests.nodemailerVerifyIpv4.config.port} | servername:{" "}
                  {data.tests.nodemailerVerifyIpv4.config.servername || "-"} | timeout:{" "}
                  {data.tests.nodemailerVerifyIpv4.config.connectionTimeout}ms
                </div>
              )}
              {data.tests.nodemailerVerifyIpv4.error && (
                <>
                  <div>Erro: {data.tests.nodemailerVerifyIpv4.error.message}</div>
                  {data.tests.nodemailerVerifyIpv4.error.code && <div>Code: {data.tests.nodemailerVerifyIpv4.error.code}</div>}
                  {data.tests.nodemailerVerifyIpv4.error.command && <div>Command: {data.tests.nodemailerVerifyIpv4.error.command}</div>}
                  {typeof data.tests.nodemailerVerifyIpv4.error.responseCode === "number" && (
                    <div>ResponseCode: {data.tests.nodemailerVerifyIpv4.error.responseCode}</div>
                  )}
                </>
              )}
            </ResultCard>

            <div className="rounded border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Como interpretar os resultados</h2>
              <div className="space-y-3 text-sm text-gray-800">
                <p>
                  Se todos os servidores SMTP apresentarem timeout, provavelmente existe um bloqueio de saída nas portas 465 e 587 no provedor da hospedagem ou na infraestrutura de rede.
                </p>
                <p>
                  Se Gmail e Microsoft conectarem, mas KingHost não, devemos investigar uma restrição entre o IP público do seu servidor e a KingHost.
                </p>
                <p>
                  Se o TCP IPv4 funcionar, mas o Nodemailer continuar falhando, o teste com IPv4 resolvido ajuda a confirmar se a diferença está na resolução de endereço usada pelo aplicativo.
                </p>
              </div>
            </div>

            <div className="rounded border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Exemplo de diagnóstico em IPv4</h2>
              <pre className="overflow-x-auto rounded bg-gray-900 px-3 py-3 text-xs text-gray-100">{`const dns = require("node:dns").promises;
const nodemailer = require("nodemailer");

const host = "smtp.kinghost.net";
const [ip] = await dns.resolve4(host);

const transporter = nodemailer.createTransport({
  host: ip,
  port: 465,
  secure: true,
  tls: {
    servername: host
  },
  auth: {
    user: "noreply@cartonificiovalinhos.com.br",
    pass: process.env.SMTP_PASSWORD
  },
  connectionTimeout: 10000
});

await transporter.verify();`}</pre>
              <p className="mt-3 text-sm text-gray-700">
                Esse exemplo serve para diagnóstico. Ele não resolve um bloqueio de rede em IPv4. O `servername` preserva a validação do certificado TLS do servidor original.
              </p>
            </div>

            <div className="rounded border bg-amber-50 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-amber-900">Minha recomendação</h2>
              <div className="space-y-3 text-sm text-amber-900">
                <p>
                  Antes de qualquer nova alteração na configuração de e-mail, verifique se o servidor consegue estabelecer uma conexão SMTP com outro provedor.
                </p>
                <p>
                  Se ambos falharem, o próximo passo será solicitar à hospedagem a liberação de conexões TCP de saída nas portas 465 e 587.
                </p>
                <p>
                  Se apenas a KingHost falhar, investigaremos com ela o bloqueio do IP de origem. Também vale confirmar o país do IP público efetivamente utilizado pelo aplicativo.
                </p>
                <p>
                  Também é importante confirmar em qual provedor este aplicativo está hospedado para direcionar a checagem de bloqueios SMTP.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
