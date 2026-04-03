"use client";
import { useRef, useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import QRCode from 'qrcode';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA States
  const [step, setStep] = useState<'credentials' | '2fa' | 'setup'>('credentials');
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempSecret, setTempSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  // Forgot Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDigits, setForgotDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'setup' && otpauth) {
      QRCode.toDataURL(otpauth)
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error(err));
    }
  }, [step, otpauth]);

  const performSignIn = async (creds: any) => {
    const res = await signIn("credentials", {
      ...creds,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      if (res.error === '2FA_REQUIRED') {
         setError("Autenticação de dois fatores necessária.");
      } else if (res.error === 'Código 2FA inválido') {
         setError("Código 2FA inválido.");
      } else {
         setError("Credenciais inválidas");
      }
      return;
    }
    if (res?.ok) {
      // Após login, garantir que a entidade ativa esteja definida
      try {
        const r = await fetch('/api/permissions', { cache: 'no-store' });
        const j = await r.json();
        if (!j?.activeEntityId && Array.isArray(j?.entities) && j.entities.length > 0) {
          await fetch('/api/session/entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityId: Number(j.entities[0].id) })
          });
        }
      } catch {}
      window.location.href = res.url ?? "/";
    }
  };

  const formatIdentifier = (value: string) => {
    // Se conter @ ou letras, não formata (trata como email)
    if (value.includes('@') || /[a-zA-Z]/.test(value)) {
        return value;
    }

    // Remove tudo que não for número
    const numeric = value.replace(/\D/g, '');

    // Limita a 14 dígitos (CNPJ)
    const truncated = numeric.slice(0, 14);

    if (truncated.length === 0) return '';

    // Formatação CPF (até 11 dígitos)
    if (truncated.length <= 11) {
        return truncated
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    // Formatação CNPJ (12 a 14 dígitos)
    return truncated
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatIdentifier(e.target.value);
      setIdentifier(formatted);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (step === 'credentials') {
        const checkRes = await fetch('/api/auth/check-2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: identifier, password })
        });
        const checkData = await checkRes.json();
        
        if (!checkRes.ok) {
            setLoading(false);
            setError(checkData.error || 'Erro ao verificar credenciais');
            return;
        }

        if (checkData.required) {
            if (checkData.setup) {
                setTempSecret(checkData.secret);
                setOtpauth(checkData.otpauth);
                setStep('setup');
                setLoading(false);
            } else {
                setStep('2fa');
                setLoading(false);
            }
        } else {
            await performSignIn({ email: identifier, password });
        }
      } else if (step === '2fa') {
        await performSignIn({ email: identifier, password, twoFactorCode });
      } else if (step === 'setup') {
        // Verify setup first
        const verifyRes = await fetch('/api/auth/verify-2fa-setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: identifier, password, secret: tempSecret, token: twoFactorCode })
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
            setLoading(false);
            setError(verifyData.error || 'Erro ao verificar código');
            return;
        }
        // If verified, proceed to login
        await performSignIn({ email: identifier, password, twoFactorCode });
      }
    } catch (err: any) {
        setLoading(false);
        setError(err.message || "Ocorreu um erro inesperado");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white shadow rounded p-6">
        <div className="flex flex-col items-center mb-4">
          <Image src="/icons/logo cartonificio.png" alt="Cartonifício Valinhos" width={96} height={80} className="w-24 max-h-20 object-contain mb-2" priority />
          <h1 className="text-xl font-semibold">
            {step === 'credentials' && "Seja bem vindo"}
            {step === '2fa' && "Verificação em Duas Etapas"}
            {step === 'setup' && "Configurar 2FA"}
          </h1>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-3">
          {step === 'credentials' && (
            <>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">E-mail, CPF ou CNPJ</label>
                    <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={identifier}
                    onChange={handleIdentifierChange}
                    required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Senha</label>
                    <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    />
                </div>
            </>
          )}

          {step === '2fa' && (
             <div>
                <p className="text-sm text-gray-600 mb-2">
                    Insira o código gerado pelo seu aplicativo autenticador.
                </p>
                <label className="block text-sm text-gray-600 mb-1">Código de Verificação</label>
                <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-center text-lg tracking-widest"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="000000"
                    required
                />
             </div>
          )}

          {step === 'setup' && (
              <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-600 mb-2 text-center">
                      Escaneie o QR Code abaixo com o Google Authenticator ou outro app compatível.
                  </p>
                  {qrCodeUrl ? (
                      <Image src={qrCodeUrl} alt="QR Code 2FA" width={192} height={192} className="w-48 h-48 mb-4 border rounded" unoptimized loader={({ src }) => src} />
                  ) : (
                      <div className="w-48 h-48 mb-4 border rounded flex items-center justify-center bg-gray-100 text-gray-400">
                          Carregando...
                      </div>
                  )}
                  <p className="text-xs text-gray-500 mb-4 break-all text-center">
                      Chave: {tempSecret}
                  </p>
                  <div className="w-full">
                    <label className="block text-sm text-gray-600 mb-1">Código de Verificação</label>
                    <input
                        type="text"
                        className="w-full border rounded px-3 py-2 text-center text-lg tracking-widest"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        placeholder="000000"
                        required
                    />
                  </div>
              </div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          
          <button
            type="submit"
            className="w-full px-3 py-2 bg-gray-800 text-white rounded"
            disabled={loading}
          >
            {loading ? "Processando..." : (step === 'credentials' ? "Entrar" : (step === 'setup' ? "Validar e Ativar" : "Verificar"))}
          </button>

          {step !== 'credentials' && (
              <button
                type="button"
                className="w-full mt-2 text-sm text-gray-600 hover:underline"
                onClick={() => {
                    setStep('credentials');
                    setError(null);
                    setTwoFactorCode("");
                }}
              >
                  Voltar para login
              </button>
          )}

          {step === 'credentials' && (
            <div className="flex justify-end mt-2">
                <button
                type="button"
                className="text-sm text-blue-700 hover:underline"
                onClick={() => {
                    setShowForgot(true);
                    setForgotStep(1);
                    setForgotEmail("");
                    setForgotDigits(["", "", "", "", "", ""]);
                    setForgotMsg(null);
                    setForgotError(null);
                }}
                >
                Esqueci Minha Senha
                </button>
            </div>
          )}
        </form>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-full max-w-sm bg-white shadow rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Recuperar Senha</div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setShowForgot(false);
                  setForgotStep(1);
                  setForgotMsg(null);
                  setForgotError(null);
                  setForgotDigits(["", "", "", "", "", ""]);
                }}
              >
                ✕
              </button>
            </div>

            {forgotStep === 1 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setForgotLoading(true);
                  setForgotMsg(null);
                  setForgotError(null);
                  try {
                    const res = await fetch('/api/auth/forgot', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setForgotError(data?.message || 'Falha ao enviar código');
                    } else {
                      setForgotMsg('Código enviado para o seu e-mail.');
                      setForgotStep(2);
                    }
                  } catch {
                    setForgotError('Erro de rede. Tente novamente.');
                  } finally {
                    setForgotLoading(false);
                  }
                }}
                className="space-y-2"
              >
                <label className="block text-sm text-gray-600">Informe seu e-mail</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                {forgotError && <div className="text-sm text-red-600">{forgotError}</div>}
                {forgotMsg && <div className="text-sm text-green-700">{forgotMsg}</div>}
                <button
                  type="submit"
                  className="w-full px-3 py-2 bg-blue-700 text-white rounded"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Enviando...' : 'Enviar código'}
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setForgotLoading(true);
                  setForgotMsg(null);
                  setForgotError(null);
                  const code = forgotDigits.join("");
                  if (code.length !== 6) {
                    setForgotError('Informe os 6 dígitos.');
                    setForgotLoading(false);
                    return;
                  }
                  try {
                    const res = await fetch('/api/auth/forgot/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail, code })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setForgotError(data?.message || 'Código inválido ou expirado');
                    } else {
                      setForgotMsg('Código verificado com sucesso.');
                      setTimeout(() => {
                        setForgotStep(3);
                        setForgotMsg(null);
                      }, 1000);
                    }
                  } catch {
                    setForgotError('Erro de rede. Tente novamente.');
                  } finally {
                    setForgotLoading(false);
                  }
                }}
                className="space-y-2"
              >
                <label className="block text-sm text-gray-600">Digite o código de 6 dígitos</label>
                <div className="grid grid-cols-6 gap-2">
                  {[0,1,2,3,4,5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="border rounded px-0 text-center py-2 text-lg tracking-widest"
                      value={forgotDigits[i]}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '').slice(0,1);
                        const next = [...forgotDigits];
                        next[i] = v;
                        setForgotDigits(next);
                        if (v && i < 5) inputsRef.current[i+1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !forgotDigits[i] && i > 0) {
                          inputsRef.current[i-1]?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0,6);
                        if (!text) return;
                        e.preventDefault();
                        const next = [...forgotDigits];
                        for (let j = 0; j < text.length && j < 6; j++) next[j] = text[j];
                        setForgotDigits(next);
                        const lastIndex = Math.min(text.length, 6) - 1;
                        inputsRef.current[lastIndex]?.focus();
                      }}
                      required
                    />
                  ))}
                </div>
                {forgotError && <div className="text-sm text-red-600">{forgotError}</div>}
                {forgotMsg && <div className="text-sm text-green-700">{forgotMsg}</div>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border rounded"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotDigits(["", "", "", "", "", ""]);
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-blue-700 text-white rounded"
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Verificando...' : 'Verificar código'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPassword !== confirmPassword) {
                    setForgotError("As senhas não conferem");
                    return;
                  }
                  if (newPassword.length < 6) {
                    setForgotError("A senha deve ter pelo menos 6 caracteres");
                    return;
                  }
                  
                  setForgotLoading(true);
                  setForgotMsg(null);
                  setForgotError(null);
                  const code = forgotDigits.join("");
                  
                  try {
                    const res = await fetch('/api/auth/forgot/reset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: forgotEmail, code, password: newPassword })
                    });
                    const data = await res.json();
                    
                    if (!res.ok) {
                      setForgotError(data?.message || 'Erro ao redefinir senha');
                    } else {
                      setForgotMsg('Senha alterada com sucesso! Você já pode fazer login.');
                      setTimeout(() => {
                        setShowForgot(false);
                        setForgotStep(1);
                        setForgotDigits(["", "", "", "", "", ""]);
                        setNewPassword("");
                        setConfirmPassword("");
                        setForgotMsg(null);
                      }, 2000);
                    }
                  } catch {
                    setForgotError('Erro de rede. Tente novamente.');
                  } finally {
                    setForgotLoading(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nova Senha</label>
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {forgotError && <div className="text-sm text-red-600">{forgotError}</div>}
                {forgotMsg && <div className="text-sm text-green-700">{forgotMsg}</div>}
                
                <button
                  type="submit"
                  className="w-full px-3 py-2 bg-blue-700 text-white rounded"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
