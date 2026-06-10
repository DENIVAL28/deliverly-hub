// Client-only — carregado via React.lazy para evitar erros de SSR com Leaflet
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";

function makeIcon(status: string) {
  const color =
    status === "disponivel" ? "#22c55e" : status === "em_rota" ? "#f59e0b" : "#ef4444";
  return L.divIcon({
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
    className: "",
  });
}

function AutoBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)]);
  return null;
}

interface Props {
  entregadores: any[];
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];

export default function MapaEntregadores({ entregadores }: Props) {
  const comGps = entregadores.filter((e) => e.lat != null && e.lng != null);
  const positions: [number, number][] = comGps.map((e) => [e.lat, e.lng]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.length > 0 && <AutoBounds positions={positions} />}
      {comGps.map((e) => (
        <Marker key={e.id} position={[e.lat, e.lng]} icon={makeIcon(e.status ?? "disponivel")}>
          <Popup>
            <strong>{e.nome}</strong>
            <br />
            {e.status === "disponivel" && "Disponível"}
            {e.status === "em_rota" && "Em rota"}
            {e.status === "indisponivel" && "Indisponível"}
            {e.ultima_localizacao && (
              <>
                <br />
                <small>
                  {new Date(e.ultima_localizacao).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
