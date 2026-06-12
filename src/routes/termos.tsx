import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — Delivery Hub" }] }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-orange-500 hover:underline mb-8 block">← Voltar ao início</Link>

        <h1 className="text-3xl font-black text-zinc-900 mb-2">Termos de Uso</h1>
        <p className="text-sm text-zinc-400 mb-10">Última atualização: junho de 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8 text-sm leading-relaxed text-zinc-700">

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">1. Aceitação dos termos</h2>
            <p>Ao criar uma conta ou usar a plataforma Delivery Hub, você concorda com estes Termos de Uso. Caso não concorde, não utilize o serviço.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">2. Descrição do serviço</h2>
            <p>O Delivery Hub é uma plataforma SaaS que oferece cardápio digital, caixa PDV e gestão de entregadores para estabelecimentos de alimentação. O acesso é fornecido mediante assinatura mensal.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">3. Cadastro e responsabilidades</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você é responsável por manter a confidencialidade da sua senha.</li>
              <li>As informações do estabelecimento cadastradas devem ser verdadeiras e atualizadas.</li>
              <li>É proibido usar a plataforma para atividades ilegais ou que violem direitos de terceiros.</li>
              <li>Cada conta corresponde a um único estabelecimento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">4. Planos e pagamentos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Os planos disponíveis (Básico, Profissional e Premium) têm preços e recursos descritos na página de planos.</li>
              <li>O período de teste gratuito é de 7 (sete) dias a partir do cadastro.</li>
              <li>Após o trial, o acesso pode ser suspenso caso não haja renovação.</li>
              <li>Os pagamentos são processados pelo Mercado Pago e renovam 30 dias a partir da data do pagamento.</li>
              <li>Não há contrato de fidelidade — você pode cancelar a qualquer momento sem multa.</li>
              <li>Não realizamos reembolsos por período não utilizado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">5. Disponibilidade do serviço</h2>
            <p>Nos esforçamos para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência sempre que possível.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">6. Propriedade intelectual</h2>
            <p>Todo o código, design e conteúdo da plataforma são de propriedade da SOS Sistemas. O cliente mantém a propriedade dos dados do seu estabelecimento e dos seus clientes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">7. Limitação de responsabilidade</h2>
            <p>A SOS Sistemas não se responsabiliza por perdas de receita decorrentes de indisponibilidade do serviço, erros do usuário ou fatores externos. Nossa responsabilidade máxima limita-se ao valor pago pelo plano no mês em questão.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">8. Suspensão e encerramento</h2>
            <p>Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, mediante aviso prévio quando possível.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">9. Contato</h2>
            <p>Dúvidas sobre estes termos: <a href="mailto:contato@sossistemas.com.br" className="text-orange-500 hover:underline">contato@sossistemas.com.br</a> ou via WhatsApp no rodapé da página inicial.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">10. Legislação aplicável</h2>
            <p>Estes termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de Cuiabá/MT para dirimir quaisquer controvérsias.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
