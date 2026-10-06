import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase as sb } from './supabase';
import { s, G, O, B, DEF, RT, money, say, shortId, isToday, km, useOrders, Ico, Btn, Btn2, Vacio, Logo, TabBar, Perfil } from './ui';

export function Repartidor({ me, email }: any) {
  const [orders, reload] = useOrders();
  const [tab, setTab] = useState('pedidos');
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState<any>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const mapRef = useRef<any>(null);
  const centered = useRef(false);
  const activeRef = useRef<any>(null);
  const active = orders.find((o) => o.courier_id === me.id && o.status === 'on_way');
  activeRef.current = active;
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
  async function done(id: string) { const { error } = await sb.from('orders').update({ status: 'delivered' }).eq('id', id); if (error) say(error); reload(); }
  const avail = orders.filter((o) => o.status === 'ready' && !o.courier_id && !hidden.includes(o.id));
  const entregas = orders.filter((o) => o.courier_id === me.id && o.status === 'delivered');
  const entregasHoy = entregas.filter((o) => isToday(o.created_at)).length;
  const line: any[] = [];
  if (active) {
    if (pos) line.push(pos);
    if (active.stores?.lat != null) line.push({ latitude: active.stores.lat, longitude: active.stores.lng });
    if (active.dest_lat != null) line.push({ latitude: active.dest_lat, longitude: active.dest_lng });
  }
  let body: any;
  if (tab === 'mapa') body = (
    <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={pos ? { ...pos, latitudeDelta: 0.03, longitudeDelta: 0.03 } : DEF} showsUserLocation>
      {avail.map((o) => o.stores?.lat != null && <Marker key={o.id} coordinate={{ latitude: o.stores.lat, longitude: o.stores.lng }} title={o.stores.name} description={money(o.total)} pinColor={O} />)}
      {active?.stores?.lat != null && <Marker coordinate={{ latitude: active.stores.lat, longitude: active.stores.lng }} title={active.stores.name} description="Recoger aquí" pinColor={O} />}
      {active?.dest_lat != null && <Marker coordinate={{ latitude: active.dest_lat, longitude: active.dest_lng }} title="Entregar aquí" pinColor={G} />}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={B} strokeWidth={4} />}
    </MapView>
  );
  else if (tab === 'ganancias') body = <Vacio i="cash" t="Ganancias" d={`Entregas completadas: ${entregas.length}. El valor de cada domicilio y tus ganancias se activan cuando definamos las tarifas.`} />;
  else if (tab === 'perfil') body = <Perfil me={me} email={email} />;
  else body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E9EC' }]}>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>{entregasHoy}</Text><Text style={s.small}>Pedidos hoy</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>$0</Text><Text style={s.small}>Ganancias</Text></View>
        <View style={{ alignItems: 'center' }}><Text style={s.big}>—</Text><Text style={s.small}>Calificación</Text></View>
      </View>
      {!online && <Text style={{ marginVertical: 12, textAlign: 'center' }}>Estás desconectado. Activa "En línea" arriba para recibir pedidos.</Text>}
      {online && !pos && <Text style={{ marginVertical: 8 }}>Buscando tu ubicación…</Text>}
      {active && (
        <View style={s.card}>
          <View style={s.row}><Text style={s.h}>Entrega en curso</Text><Text style={{ color: G, fontWeight: '900', fontSize: 18 }}>{money(active.total)}</Text></View>
          <View style={s.rowc}><Ico n="map-marker" c={O} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>1. Recoge en: {active.stores?.name} — {active.stores?.address}</Text></View>
          <View style={[s.rowc, { marginVertical: 6 }]}><Ico n="home-outline" c={B} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>2. Entrega en: {active.address}</Text></View>
          <Btn t="Marcar como entregado" on={() => done(active.id)} />
        </View>)}
      {online && !active && <>
        <Text style={s.h}>Ofertas de pedidos</Text>
        {avail.map((o) => (
          <View key={o.id} style={s.card}>
            <View style={s.row}>
              <View style={s.rowc}><View style={[s.avatarS, { backgroundColor: O }]}><Ico n="silverware-fork-knife" c="#fff" z={20} /></View><Text style={[s.b, { marginLeft: 10, marginBottom: 0 }]}>Pedido {shortId(o.id)}</Text></View>
              <Text style={{ color: G, fontWeight: '900', fontSize: 18 }}>{money(o.total)}</Text>
            </View>
            <View style={[s.rowc, { marginTop: 10 }]}><Ico n="map-marker" c={O} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>{o.stores?.name} · {o.stores?.address}</Text></View>
            <View style={[s.rowc, { marginTop: 6 }]}><Ico n="home-outline" c={B} z={20} /><Text style={{ marginLeft: 8, flex: 1 }}>{o.address}</Text></View>
            {pos && o.stores?.lat != null && <Text style={{ color: '#666', marginTop: 4 }}>{km(pos, { latitude: o.stores.lat, longitude: o.stores.lng }).toFixed(1)} km al comercio</Text>}
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