function proximoDia(dias: string[], dayMap: string[], now: Date): string {
  for (let i = 1; i <= 7; i++) {
    const d = dayMap[(now.getDay() + i) % 7];
    if (dias.includes(d)) {
      const labels: Record<string, string> = { seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado", dom: "domingo" };
      return labels[d] ?? d;
    }
  }
  return "";
}

export function verificarAberto(empresa: any): { aberto: boolean; label: string } {
  if (empresa.aberto === false) return { aberto: false, label: "Fechado agora" };
  const { horario_abertura, horario_fechamento, dias_semana } = empresa;
  if (!horario_abertura || !horario_fechamento) return { aberto: true, label: "Aberto" };

  const now    = new Date();
  const dayMap = ["dom","seg","ter","qua","qui","sex","sab"];
  const hoje   = dayMap[now.getDay()];
  const dias   = (dias_semana ?? "seg,ter,qua,qui,sex,sab,dom").split(",").map((d: string) => d.trim());

  if (!dias.includes(hoje)) {
    return { aberto: false, label: `Fechado hoje · Abre ${proximoDia(dias, dayMap, now)} às ${horario_abertura}` };
  }

  const agora = now.getHours() * 60 + now.getMinutes();
  const [aH, aM] = horario_abertura.split(":").map(Number);
  const [fH, fM] = horario_fechamento.split(":").map(Number);
  const abre  = aH * 60 + aM;
  const fecha = fH * 60 + fM;

  const estaAberto = fecha < abre
    ? agora >= abre || agora <= fecha
    : agora >= abre && agora <= fecha;

  if (estaAberto) return { aberto: true, label: `Aberto · Fecha às ${horario_fechamento}` };
  return { aberto: false, label: `Fechado · Abre às ${horario_abertura}` };
}
