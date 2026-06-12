import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/landing/Landing";

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Delivery Hub",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Sistema completo de delivery para restaurantes: cardápio digital, pedidos via WhatsApp, PDV, cupons e relatórios.",
  "url": "https://delivery-hub.vercel.app",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "BRL",
    "lowPrice": "99",
    "highPrice": "345",
    "offerCount": "3",
  },
  "provider": {
    "@type": "Organization",
    "name": "SOS Sistemas",
    "url": "https://delivery-hub.vercel.app",
  },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Delivery Hub — Sistema de Delivery para Restaurantes | Cardápio Digital" },
      { name: "description", content: "Crie seu cardápio digital grátis e receba pedidos pelo WhatsApp. Sistema completo para pizzarias, hamburguerias, açaíterias e restaurantes. Sem taxas por pedido." },
      { property: "og:title", content: "Delivery Hub — Sistema de Delivery para Restaurantes" },
      { property: "og:description", content: "Cardápio digital + pedidos pelo WhatsApp + PDV + relatórios. Tudo por R$99/mês. Sem taxas por pedido." },
      { property: "og:url", content: "https://delivery-hub.vercel.app" },
      { name: "script:ld+json", content: JSON.stringify(JSONLD) },
    ],
  }),
  component: Landing,
});
