import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SMTP_HOST = "smtp.kinghost.net";
const SMTP_USER = "noreply@cartonificiovalinhos.com.br";
const TCP_TIMEOUT_MS = 5000;
const SMTP_CONNECTION_TIMEOUT_MS = 10000;

type TcpTestResult = {
  host: string;
  port: number;
  family: 4;
  ok: boolean;
  status: "succeeded" | "timed out" | "refused" | "error";
  message: string;
  elapsedMs: number;
};

type NodemailerVerifyResult = {
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
  resolvedIpv4?: string | null;
  error?: {
    message: string;
    code: string | null;
    responseCode: number | null;
    command: string | null;
  };
};

async function getSmtpPasswordSource() {
  const envPassword = String(process.env.SMTP_PASSWORD || "").trim();
  if (envPassword) {
    return { password: envPassword, source: "env" as const };
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: "smtpPass" },
    select: { value: true },
  });
  const dbPassword = String(setting?.value || "").trim();
  if (dbPassword) {
    return { password: dbPassword, source: "systemSetting" as const };
  }

  return { password: "", source: "missing" as const };
}

function testTcpPort(host: string, port: number): Promise<TcpTestResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = net.createConnection({
      host,
      port,
      family: 4,
    });

    let finished = false;

    const finish = (result: Omit<TcpTestResult, "elapsedMs" | "host" | "port" | "family">) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({
        host,
        port,
        family: 4,
        elapsedMs: Date.now() - startedAt,
        ...result,
      });
    };

    socket.setTimeout(TCP_TIMEOUT_MS);

    socket.once("connect", () => {
      finish({
        ok: true,
        status: "succeeded",
        message: `Conexão TCP com ${host}:${port} estabelecida via IPv4.`,
      });
    });

    socket.once("timeout", () => {
      finish({
        ok: false,
        status: "timed out",
        message: `Timeout ao conectar em ${host}:${port} via IPv4.`,
      });
    });

    socket.once("error", (err: any) => {
      const code = String(err?.code || "").trim().toUpperCase();
      finish({
        ok: false,
        status: code === "ECONNREFUSED" ? "refused" : code === "ETIMEDOUT" ? "timed out" : "error",
        message: String(err?.message || err || `Falha ao conectar em ${host}:${port}`),
      });
    });
  });
}

async function runNodemailerVerify() {
  const passwordMeta = await getSmtpPasswordSource();
  if (!passwordMeta.password) {
    return {
      ok: false,
      skipped: true,
      source: passwordMeta.source,
      message: "Senha SMTP não encontrada em process.env.SMTP_PASSWORD nem em SystemSetting.smtpPass.",
    } satisfies NodemailerVerifyResult;
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: passwordMeta.password,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  });

  const startedAt = Date.now();

  try {
    await transport.verify();
    return {
      ok: true,
      skipped: false,
      source: passwordMeta.source,
      elapsedMs: Date.now() - startedAt,
      config: {
        host: SMTP_HOST,
        port: 465,
        secure: true,
        user: SMTP_USER,
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      },
      message: "Nodemailer verificou conexão e autenticação com sucesso.",
    } satisfies NodemailerVerifyResult;
  } catch (err: any) {
    return {
      ok: false,
      skipped: false,
      source: passwordMeta.source,
      elapsedMs: Date.now() - startedAt,
      config: {
        host: SMTP_HOST,
        port: 465,
        secure: true,
        user: SMTP_USER,
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      },
      error: {
        message: String(err?.message || err || "Erro ao verificar SMTP"),
        code: err?.code ? String(err.code) : null,
        responseCode: err?.responseCode ?? null,
        command: err?.command ? String(err.command) : null,
      },
      message: "Nodemailer não conseguiu validar a conexão SMTP.",
    } satisfies NodemailerVerifyResult;
  } finally {
    transport.close();
  }
}

async function runNodemailerVerifyIpv4() {
  const passwordMeta = await getSmtpPasswordSource();
  if (!passwordMeta.password) {
    return {
      ok: false,
      skipped: true,
      source: passwordMeta.source,
      message: "Senha SMTP não encontrada em process.env.SMTP_PASSWORD nem em SystemSetting.smtpPass.",
      resolvedIpv4: null,
    } satisfies NodemailerVerifyResult;
  }

  let resolvedIpv4: string | null = null;

  try {
    const ipv4List = await dns.resolve4(SMTP_HOST);
    resolvedIpv4 = ipv4List.find((item) => String(item || "").trim().length > 0) || null;
    if (!resolvedIpv4) {
      return {
        ok: false,
        skipped: true,
        source: passwordMeta.source,
        message: "Nao foi possivel resolver um IPv4 para smtp.kinghost.net.",
        resolvedIpv4: null,
      } satisfies NodemailerVerifyResult;
    }
  } catch (err: any) {
    return {
      ok: false,
      skipped: true,
      source: passwordMeta.source,
      message: `Falha ao resolver IPv4 de ${SMTP_HOST}.`,
      resolvedIpv4: null,
      error: {
        message: String(err?.message || err || "Erro ao resolver IPv4"),
        code: err?.code ? String(err.code) : null,
        responseCode: null,
        command: null,
      },
    } satisfies NodemailerVerifyResult;
  }

  const transport = nodemailer.createTransport({
    host: resolvedIpv4,
    port: 465,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: passwordMeta.password,
    },
    tls: {
      servername: SMTP_HOST,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  });

  const startedAt = Date.now();

  try {
    await transport.verify();
    return {
      ok: true,
      skipped: false,
      source: passwordMeta.source,
      elapsedMs: Date.now() - startedAt,
      resolvedIpv4,
      config: {
        host: resolvedIpv4,
        port: 465,
        secure: true,
        user: SMTP_USER,
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        servername: SMTP_HOST,
      },
      message: "Nodemailer com IPv4 resolvido manualmente verificou conexao e autenticacao com sucesso.",
    } satisfies NodemailerVerifyResult;
  } catch (err: any) {
    return {
      ok: false,
      skipped: false,
      source: passwordMeta.source,
      elapsedMs: Date.now() - startedAt,
      resolvedIpv4,
      config: {
        host: resolvedIpv4,
        port: 465,
        secure: true,
        user: SMTP_USER,
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        servername: SMTP_HOST,
      },
      error: {
        message: String(err?.message || err || "Erro ao verificar SMTP via IPv4"),
        code: err?.code ? String(err.code) : null,
        responseCode: err?.responseCode ?? null,
        command: err?.command ? String(err.command) : null,
      },
      message: "Nodemailer com IPv4 resolvido manualmente nao conseguiu validar a conexao SMTP.",
    } satisfies NodemailerVerifyResult;
  } finally {
    transport.close();
  }
}

async function fetchPublicIpv4() {
  const startedAt = Date.now();

  try {
    const res = await fetch("https://api.ipify.org", {
      cache: "no-store",
      headers: {
        Accept: "text/plain",
      },
    });
    const body = (await res.text()).trim();

    return {
      ok: res.ok && body.length > 0,
      elapsedMs: Date.now() - startedAt,
      ip: body || null,
      status: res.status,
      message: res.ok
        ? `IP publico de saida identificado: ${body}`
        : `Falha ao consultar api.ipify.org. Status ${res.status}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      ip: null,
      status: null,
      message: String(err?.message || err || "Falha ao descobrir IP publico de saida."),
    };
  }
}

export async function GET() {
  try {
    const [
      kinghost465,
      kinghost587,
      gmail465,
      office365587,
      nodemailerVerify,
      nodemailerVerifyIpv4,
      publicIpv4,
    ] = await Promise.all([
      testTcpPort(SMTP_HOST, 465),
      testTcpPort(SMTP_HOST, 587),
      testTcpPort("smtp.gmail.com", 465),
      testTcpPort("smtp.office365.com", 587),
      runNodemailerVerify(),
      runNodemailerVerifyIpv4(),
      fetchPublicIpv4(),
    ]);

    return NextResponse.json({
      host: SMTP_HOST,
      user: SMTP_USER,
      tests: {
        kinghost465,
        kinghost587,
        gmail465,
        office365587,
        nodemailerVerify,
        nodemailerVerifyIpv4,
        publicIpv4,
      },
      commands: [
        "nc -4 -zv -w 5 smtp.kinghost.net 465",
        "nc -4 -zv -w 5 smtp.kinghost.net 587",
        "nc -4 -zv -w 5 smtp.gmail.com 465",
        "nc -4 -zv -w 5 smtp.office365.com 587",
        "curl -4 -s https://api.ipify.org",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Falha ao executar teste SMTP") },
      { status: 500 },
    );
  }
}
