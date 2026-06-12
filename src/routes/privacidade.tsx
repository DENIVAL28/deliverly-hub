import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Delivery Hub" }] }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-orange-500 hover:underline mb-8 block">← Voltar ao início</Link>

        <h1 className="text-3xl font-black text-zinc-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-zinc-400 mb-10">Última atualização: junho de 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8 text-sm leading-relaxed text-zinc-700">

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">1. Quem somos</h2>
            <p>O Delivery Hub é uma plataforma SaaS de gestão de delivery operada pela <strong>SOS Sistemas</strong>, com sede no Mato Grosso, Brasil. Nosso contato: <a href="mailto:contato@sossistemas.com.br" className="text-orange-500 hover:underline">contato@sossistemas.com.br</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, e-mail e senha dos responsáveis pelo estabelecimento.</li>
              <li><strong>Dados da empresa:</strong> nome fantasia, CNPJ, endereço, telefone, logo e banner.</li>
              <li><strong>Dados de pedidos:</strong> nome, telefone e endereço dos clientes finais informados no checkout.</li>
              <li><strong>Dados de uso:</strong> registros de acesso, navegação e interações com a plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">3. Como usamos os dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prestação e melhoria dos serviços da plataforma.</li>
              <li>Envio de notificações operacionais (pedidos, vencimento de plano).</li>
              <li>Suporte ao cliente.</li>
              <li>Cumprimento de obrigações legais.</li>
            </ul>
            <p className="mt-2">Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">4. Armazenamento e segurança</h2>
            <p>Os dados são armazenados em servidores seguros da <strong>Supabase</strong> (infraestrutura AWS). Utilizamos criptografia em trânsito (TLS) e em repouso. O acesso é restrito a colaboradores autorizados.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">5. Cookies</h2>
            <p>Utilizamos cookies estritamente necessários para autenticação e funcionamento da plataforma. Não utilizamos cookies de rastreamento para publicidade.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">6. Seus direitos (LGPD)</h2>
            <p>Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmar a existência de tratamento de seus dados.</li>
              <li>Acessar, corrigir ou excluir seus dados.</li>
              <li>Revogar o consentimento a qualquer momento.</li>
              <li>Solicitar portabilidade dos dados.</li>
            </ul>
            <p className="mt-2">Para exercer esses direitos, envie um e-mail para <a href="mailto:contato@sossistemas.com.br" className="text-orange-500 hover:underline">contato@sossistemas.com.br</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">7. Alterações nesta política</h2>
            <p>Podemos atualizar esta política periodicamente. Comunicaremos mudanças relevantes por e-mail ou aviso no painel da plataforma.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
