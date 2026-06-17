export function normalizarChavePix(chave: string, tipo: string): string {
  const c = chave.trim();
  if (tipo === "telefone") {
    const d = c.replace(/\D/g, "");
    return d.startsWith("55") ? `+${d}` : `+55${d}`;
  }
  if (tipo === "cpf" || tipo === "cnpj") return c.replace(/\D/g, "");
  if (tipo === "email") return c.toLowerCase();
  return c;
}

function crc16(str: string): number {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
    }
    crc &= 0xFFFF;
  }
  return crc;
}

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

export function gerarPixPayload(chave: string, nome: string, cidade: string, valor: number): string {
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  const adf = tlv("05", "PEDIDO");
  const payload = [
    tlv("00", "01"),
    tlv("26", mai),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", valor.toFixed(2)),
    tlv("58", "BR"),
    tlv("59", nome),
    tlv("60", cidade),
    tlv("62", adf),
    "6304",
  ].join("");
  const crc = crc16(payload).toString(16).toUpperCase().padStart(4, "0");
  return payload + crc;
}

export function normalizarTexto(str: string, max: number): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}
