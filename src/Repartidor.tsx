import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Switch, ScrollView, Alert, Image, Linking } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase as sb } from './supabase';
import { s, G, N, O, B, DEF, RT, money, say, ago, shortId, isToday, km, useOrders, Ico, Btn, Btn2, Logo, TabBar, Perfil } from './ui';

export function Repartidor({ me, email }: any) {
  const [orders, reload] = useOrders();
  const [tab, setTab] = useState('pedidos');
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState<any>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [fotoLugar, setFotoLugar] = useState<string | null>(null);
  const [bal, setBal] = useState<any>(null);
  const [movs, setMovs] = useState<any[]>([]);
  const [liqs, setLiqs] = useState<any[]>([]);
  const [rating, setRating] = useState('—');
  const mapRef = useRef<any>(null);
  const centered = useRef(false);
  const activeRef = useRef<any>(null);
  const active = orders.find((o) => o.courier_id === me.id && o.status === 'on_way');
  activeRef.current = active;
  const loadFin = useCallback(async () => {
    const [b, m, l, r] = await Promise.all([
      sb.rpc('my_balance'),
      sb.from('ledger_entries').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('settlements').select('*').order('created_at', { ascending: false }).limit(10),
      sb.from('reviews').select('courier_rating').eq('courier_id', me.id),
    ]);
    setBal(b.data); setMovs(m.data || []); setLiqs(l.data || []);
    const v = (r.data || []).map((x: any) => x.courier_rating).filter(Boolean);
    setRating(v.length ? (v.reduce((a: number, c: number) => a + c, 0) / v.length).toFixed(1) : '—');
  }, []);
  useEffect(() => { loadFin(); }, [tab, orders.length]);
  useEffect(() => {
    if (!online) { centered.current = false; return; }
    let sub: any; let dead = false;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') { Alert.alert('Activa la ubicación', 'Sin ubicación no puedes recibir pedidos.'); setOnline(false); return; }
      try {
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 8 }, (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setPos(c);
          if (!centered.current) { centered.current = true; mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 500); }
          const ac = activeRef.current;
          if (ac) sb.from('orders').update({ courier_lat: c.latitude, courier_lng: c.longitude }).eq('id', ac.id).then(() => {});
        });
        if (dead) sub.remove();
      } catch (e) { say(e); }
    })();
    return () => { dead = true; sub?.remove(); };
  }, [online]);
  async function accept(id: string) {
    const { data, error } = await sb.from('orders').update({ courier_id: me.id, status: 'on_way', courier_lat: pos?.latitude, courier_lng: pos?.longitude })
      .eq('id', id).is('courier_id', null).eq('status', 'ready').select();
    if (error) return say(error);
    if (!data?.length) Alert.alert('Ya no está disponible', 'Otro repartidor lo tomó.');
    reload();
  }
  async function verFoto(path: string) {
    const { data, error } = await sb.storage.from('entregas').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return say(error || 'No se pudo abrir la foto');
    setFotoLugar(data.signedUrl);
  }
  const abrirMapa = (lat: number, lng: number) => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
  async function done(id: string) { const { error } = await sb.from('orders').update({ status: 'delivered' }).eq('id', id); if (error) say(error); reload(); loadFin(); }
  const avail = orders.filter((o) => o.status === 'ready' && !o.courier_id && !hidden.includes(o.id));
  const entregas = orders.filter((o) => o.courier_id === me.id && o.status === 'delivered');
  const entregasHoy = entregas.filter((o) => isToday(o.created_at)).length;
  const gananciasHoy = movs.filter((m) => m.kind === 'courier_earning' && isToday(m.created_at)).reduce((a, m) => a + m.amount, 0);
  const line: any[] = [];
  if (active) {
    if (pos) line.push(pos);
    if (active.stores?.lat != null) line.push({ latitude: active.stores.lat, longitude: active.stores.lng });
    if (active.dest_lat != null) line.push({ latitude: active.dest_lat, longitude: active.dest_lng });
  }
  const pend = bal?.courier_earnings_pending || 0, cash = bal?.cash_pending || 0, neto = pend - cash;
  const KL: any = { courier_earning: 'Ganancia por domicilio', courier_cash_pending: 'Efectivo recibido por conciliar', adjustment: 'Ajuste por reclamo' };
  let body: any;
  if (tab === 'mapa') body = (
    <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={pos ? { ...pos, latitudeDelta: 0.03, longitudeDelta: 0.03 } : DEF} showsUserLocation>
      {avail.map((o) => o.stores?.lat != null && <Marker key={o.id} coordinate={{ latitude: o.stores.lat, longitude: o.stores.lng }} title={o.stores.name} description={`Ganas ${money(o.courier_earnings || 0)}`} pinColor={O} />)}
      {active?.stores?.lat != null && <Marker coordinate={{ latitude: active.stores.lat, longitude: active.stores.lng }} title={active.stores.name} description="Recoger aquí" pinColor={O} />}
      {active?.dest_lat != null && <Marker coordinate={{ latitude: active.dest_lat, longitude: active.dest_lng }} title="Entregar aquí" pinColor={G} />}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={B} strokeWidth={4} />}
    </MapView>
  );
  else if (tab === 'ganancias') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Ganancias</Text>
      <View style={s.card}>
        <View style={s.row}><Text>Ganancias acumuladas</Text><Text style={{ fontWeight: '900', color: G }}>{money(pend)}</Text></View>
        <View style={[s.row, { marginTop: 4 }]}><Text>Efectivo pendiente</Text><Text style={{ fontWeight: '900', color: O }}>- {money(cash)}</Text></View>
        <View style={[s.row, { marginTop: 10 }]}><Text style={{ fontWeight: '900', color: N }}>{neto >= 0 ? 'Pago neto' : 'Debes entregar'}</Text><Text style={{ fontWeight: '900', fontSize: 20, color: neto >= 0 ? G : '#D32F2F' }}>{money(Math.abs(neto))}</Text></View>
      </View>
      <Text style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>El efectivo pendiente es el dinero de los pedidos en efectivo que debes entregar a Cerquita. Se descuenta en tu liquidación.</Text>
      <Text style={s.h}>Movimientos</Text>
      {!movs.length && <Text style={{ marginBottom: 10 }}>Aún no tienes movimientos. Aparecen al entregar pedidos.</Text>}
      {movs.map((m) => (
        <View key={m.id} style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.b}>{KL[m.kind] || m.kind}</Text><Text style={{ color: '#888', fontSize: 11 }}>{ago(m.created_at)}</Text></View>
          <Text style={{ fontWeight: '900', color: m.kind === 'courier_earning' ? G : O }}>{m.kind === 'courier_earning' ? '+' : '-'} {money(Math.abs(m.amount))}</Text>
        </View>))}
      <Text style={[s.h, { marginTop: 8 }]}>Mis liquidaciones</Text>
      {!liqs.length && <Text>Aún no tienes liquidaciones.</Text>}
      {liqs.map((l) => (
        <View key={l.id} style={[s.card, s.row]}>
          <View><Text style={s.b}>Neto {money(l.net_amount)}</Text><Text style={{ color: '#888', fontSize: 11 }}>Ganancias {money(l.gross_amount)} - efectivo {money(l.cash_applied)} · {ago(l.created_at)}</Text></View>
          <Text style={{ fontWeight: '800', color: l.status === 'PAGADA' ? G : O }}>{l.status}</Text>
        </View>))}
    </ScrollView>
  );
  else if (tab === 'perfil') body = <Perfil me={me} email={email} />;
  else body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E9EC' }]}>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>{entregasHoy}</Text><Text style={s.small}>Pedidos hoy</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>{money(gananciasHoy)}</Text><Text style={s.small}>Ganancias hoy</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>{rating === '—' ? '—' : `★ ${rating}`}</Text><Text style={s.small}>Calificación</Text></View>
      </View>
      {cash > 0 && <View style={{ backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, marginBottom: 10 }}><Text style={{ color: '#E65100', fontWeight: '800' }}>Efectivo pendiente por entregar: {money(cash)}</Text></View>}
      {!online && <Text style={{ marginVertical: 12, textAlign: 'center' }}>Estás desconectado. Activa "En línea" arriba para recibir pedidos.</Text>}
      {online && !pos && <Text style={{ marginVertical: 8 }}>Buscando tu ubicación…</Text>}
      {active && (
        <View style={s.card}>
          <View style={s.row}><Text style={s.h}>Entrega en curso</Text><View style={{ alignItems: 'flex-end' }}><Text style={{ color: G, fontWeight: '900', fontSize: 18 }}>{money(active.courier_earnings || 0)}</Text><Text style={s.small}>Tu ganancia</Text></View></View>
          <View style={s.rowc}><Ico n="map-marker" c={O} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>1. Recoge en: {active.stores?.name} — {active.stores?.address}</Text></View>
          <View style={[s.rowc, { marginVertical: 6 }]}><Ico n="home-outline" c={B} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>2. Entrega en: {active.address}</Text></View>
          {active.payment_method === 'cash' && <View style={{ backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginVertical: 6 }}><Text style={{ fontWeight: '800', color: '#E65100' }}>Cobra {money(active.total)} en efectivo al cliente</Text></View>}
          {active.stores?.lat != null && <Btn t="Ir al comercio (Google Maps)" c="#1E6BFF" on={() => abrirMapa(active.stores.lat, active.stores.lng)} />}
          {active.dest_lat != null && <Btn t="Ir al cliente (Google Maps)" c="#1E6BFF" on={() => abrirMapa(active.dest_lat, active.dest_lng)} />}
          {!!active.dest_photo_path && <Btn t="Ver foto del lugar" c="#6C4BD6" on={() => verFoto(active.dest_photo_path)} />}
          {!!fotoLugar && <View><Image source={{ uri: fotoLugar }} style={{ width: '100%', height: 220, borderRadius: 12, marginTop: 8 }} /><Btn t="Cerrar foto" c="#7A8A94" on={() => setFotoLugar(null)} /></View>}
          <Btn t="Marcar como entregado" on={() => done(active.id)} />
        </View>)}
      {online && !active && <>
        <Text style={s.h}>Ofertas de pedidos</Text>
        {avail.map((o) => (
          <View key={o.id} style={s.card}>
            <View style={s.row}>
              <View style={s.rowc}><View style={[s.avatarS, { backgroundColor: O }]}><Ico n="silverware-fork-knife" c="#fff" z={20} /></View><Text style={[s.b, { marginLeft: 10, marginBottom: 0 }]}>Pedido {shortId(o.id)}</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={{ color: G, fontWeight: '900', fontSize: 18 }}>{money(o.courier_earnings || 0)}</Text><Text style={s.small}>Ganas</Text></View>
            </View>
            <View style={[s.rowc, { marginTop: 10 }]}><Ico n="map-marker" c={O} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>{o.stores?.name} · {o.stores?.address}</Text></View>
            <View style={[s.rowc, { marginTop: 6 }]}><Ico n="home-outline" c={B} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>{o.address}</Text></View>
            <Text style={{ color: '#666', marginTop: 4 }}>{o.payment_method === 'cash' ? `Cobrar al cliente: ${money(o.total)} en efectivo` : 'Pago electrónico: no cobras al cliente'}{pos && o.stores?.lat != null ? ` · ${km(pos, { latitude: o.stores.lat, longitude: o.stores.lng }).toFixed(1)} km al comercio` : ''}</Text>
            <View style={{ flexDirection: 'row', marginTop: 10, marginHorizontal: -4 }}>
              <Btn2 t="Rechazar" c="#FDE2E2" tc="#D32F2F" on={() => setHidden([...hidden, o.id])} />
              <Btn2 t="Aceptar" on={() => accept(o.id)} />
            </View>
          </View>))}
        {!avail.length && <Text>Todavía no hay pedidos listos. Aparecen aquí cuando el comercio los marca como "Listo para recoger".</Text>}
      </>}
    </ScrollView>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { padding: 14 }]}>
        <Logo k={0.85} />
        <View style={s.pill}><Switch value={online} onValueChange={setOnline} trackColor={{ true: G }} /><Text style={{ fontWeight: '700' }}>{online ? 'En línea' : 'Desconectado'}</Text></View>
      </View>
      <View style={{ flex: 1 }}>{body}</View>
      <TabBar tabs={RT} tab={tab} go={setTab} />
    </View>
  );
}