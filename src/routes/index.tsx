import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOS Sistemas — Sistema de Delivery para o seu estabelecimento" },
      { name: "description", content: "Tenha seu próprio cardápio online, gestão de pedidos em tempo real e checkout via WhatsApp. Sem taxas abusivas." },
      { property: "og:title", content: "SOS Sistemas — Sistema de Delivery" },
      { property: "og:description", content: "Tenha seu próprio sistema de delivery completo." },
    ],
  }),
  component: Landing,
});
