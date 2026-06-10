export async function copiarTexto(texto: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch { /* fallback abaixo */ }
  }
  // Fallback para HTTP / origens não-seguras
  const el = document.createElement("textarea");
  el.value = texto;
  el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
}

export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // todos iguais

  const calc = (digits: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const d1 = calc(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (Number(d[12]) !== d1) return false;

  const d2 = calc(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(d[13]) === d2;
}

export function mascaraCNPJ(v: string): string {
  v = v.replace(/\D/g, "").slice(0, 14);
  if (v.length <= 2)  return v;
  if (v.length <= 5)  return `${v.slice(0,2)}.${v.slice(2)}`;
  if (v.length <= 8)  return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`;
  return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
}

export function validarWhatsApp(v: string): boolean {
  const d = v.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}

export function cnpjStatus(cnpj: string): "vazio" | "incompleto" | "invalido" | "valido" {
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 0)  return "vazio";
  if (d.length < 14)   return "incompleto";
  if (!validarCNPJ(cnpj)) return "invalido";
  return "valido";
}
