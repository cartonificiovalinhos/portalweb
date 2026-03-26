"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [checklistTemplate, setChecklistTemplate] = useState("");
  const [reportHeader, setReportHeader] = useState("");
  
  // SMTP Fields
  const [senderEmail, setSenderEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSsl, setSmtpSsl] = useState(false);
  const [smtpTls, setSmtpTls] = useState(false);

  // ERP
  const [erpUrl, setErpUrl] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.checklistTemplate) setChecklistTemplate(data.checklistTemplate);
        if (data.reportHeader) setReportHeader(data.reportHeader);
        if (data.senderEmail) setSenderEmail(data.senderEmail);
        if (data.smtpHost) setSmtpHost(data.smtpHost);
        if (data.smtpPort) setSmtpPort(data.smtpPort);
        if (data.smtpUser) setSmtpUser(data.smtpUser);
        if (data.smtpPass) setSmtpPass(data.smtpPass);
        if (data.smtpSsl) setSmtpSsl(data.smtpSsl === 'true');
        if (data.smtpTls) setSmtpTls(data.smtpTls === 'true');
        if (data.erpUrl) setErpUrl(data.erpUrl);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    try {
      const payload = {
        checklistTemplate,
        reportHeader,
        senderEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpSsl: String(smtpSsl),
        smtpTls: String(smtpTls),
        erpUrl
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Configurações salvas com sucesso!");
      } else {
        alert("Erro ao salvar configurações.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar configurações.");
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-gray-600">Gerais e Integrações</p>
      </div>

      <div className="bg-white shadow rounded p-4 space-y-4">
        
        {/* SMTP Settings */}
        <div className="border-b pb-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">Configuração de E-mail (SMTP)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail Remetente</label>
              <input 
                type="email"
                className="mt-1 block w-full border rounded px-3 py-2" 
                value={senderEmail} 
                onChange={(e) => setSenderEmail(e.target.value)} 
                placeholder="ex: nao-responda@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Host SMTP</label>
              <input 
                type="text"
                className="mt-1 block w-full border rounded px-3 py-2" 
                value={smtpHost} 
                onChange={(e) => setSmtpHost(e.target.value)} 
                placeholder="ex: smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Porta</label>
              <input 
                type="text"
                className="mt-1 block w-full border rounded px-3 py-2" 
                value={smtpPort} 
                onChange={(e) => setSmtpPort(e.target.value)} 
                placeholder="ex: 587"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Usuário</label>
              <input 
                type="text"
                className="mt-1 block w-full border rounded px-3 py-2" 
                value={smtpUser} 
                onChange={(e) => setSmtpUser(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <input 
                type="password"
                className="mt-1 block w-full border rounded px-3 py-2" 
                value={smtpPass} 
                onChange={(e) => setSmtpPass(e.target.value)} 
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-6">
            <div className="flex items-center">
              <input 
                id="ssl" 
                type="checkbox" 
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                checked={smtpSsl}
                onChange={(e) => setSmtpSsl(e.target.checked)}
              />
              <label htmlFor="ssl" className="ml-2 block text-sm text-gray-900">Usa SSL?</label>
            </div>
            <div className="flex items-center">
              <input 
                id="tls" 
                type="checkbox" 
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                checked={smtpTls}
                onChange={(e) => setSmtpTls(e.target.checked)}
              />
              <label htmlFor="tls" className="ml-2 block text-sm text-gray-900">Usa TLS?</label>
            </div>
          </div>
        </div>

        {/* ERP Settings */}
        <div className="border-b pb-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">Endereço Servidor ERP</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">URL/Portal</label>
            <input 
              type="text"
              className="mt-1 block w-full md:w-1/2 border rounded px-3 py-2" 
              value={erpUrl} 
              onChange={(e) => setErpUrl(e.target.value)} 
              placeholder="ex: http://cvserver13:8484"
            />
          </div>
        </div>

        {/* Other Settings */}
        <div>
          <div className="font-semibold mb-2">Template de checklist</div>
          <textarea className="w-full border rounded p-2 h-32" value={checklistTemplate} onChange={(e) => setChecklistTemplate(e.target.value)} />
        </div>
        <div>
          <div className="font-semibold mb-2">Cabeçalho de relatórios</div>
          <input className="w-full border rounded px-3 py-2" value={reportHeader} onChange={(e) => setReportHeader(e.target.value)} />
        </div>
        
        <div className="pt-4">
          <button className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700" onClick={save}>Salvar Configurações</button>
        </div>
      </div>
    </div>
  );
}
