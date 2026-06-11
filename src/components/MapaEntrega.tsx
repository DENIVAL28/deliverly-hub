// Client-only — carregado via React.lazy (Leaflet não funciona no SSR)
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";

const clienteIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#f97316;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -14], className: "",
});

const entregadorIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);animation:pulse 1.5s infinite;"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12], className: "",
});

function AutoBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) { map.setView(positions[0], 16); return; }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)]);
  return null;
}

interface Props {
  clienteLat: number;
  clienteLng: number;
  clienteNome?: string;
  entregadorLat?: number | null;
  entregadorLng?: number | null;
}

export default function MapaEntrega({ clienteLat, clienteLng, clienteNome, entregadorLat, entregadorLng }: Props) {
  const hasDriver = entregadorLat != null && entregadorLng != null;
  const positions: [number, number][] = [[clienteLat, clienteLng]];
  if (hasDriver) positions.push([entregadorLat!, entregadorLng!]);

  return (
    <MapContainer
      center={[clienteLat, clienteLng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "180px", width: "100%", borderRadius: "0.75rem" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoBounds positions={positions} />
      <Marker position={[clienteLat, clienteLng]} icon={clienteIcon}>
        <Popup>{clienteNome ?? "Cliente"}</Popup>
      </Marker>
      {hasDriver && (
        <Marker position={[entregadorLat!, entregadorLng!]} icon={entregadorIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
