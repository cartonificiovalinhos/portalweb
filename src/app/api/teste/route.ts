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
    };
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
    };
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
    };
  } finally {
    transport.close();
  }
}

export async function GET() {
  try {
    const [port465, port587, nodemailerVerify] = await Promise.all([
      testTcpPort(SMTP_HOST, 465),
      testTcpPort(SMTP_HOST, 587),
      runNodemailerVerify(),
    ]);

    return NextResponse.json({
      host: SMTP_HOST,
      user: SMTP_USER,
      tests: {
        tcp465: port465,
        tcp587: port587,
        nodemailerVerify,
      },
      commands: [
        "nc -4 -zv -w 5 smtp.kinghost.net 465",
        "nc -4 -zv -w 5 smtp.kinghost.net 587",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || err || "Falha ao executar teste SMTP") },
      { status: 500 },
    );
  }
}
