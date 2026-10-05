import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity as T, Switch, ScrollView, StyleSheet, Alert, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase as sb } from './src/supabase';

const G = '#1DB954', N = '#0B2A3D', O = '#F26B21', B = '#1E6BFF';
const TOP = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;
const DEF = { latitude: 6.3373, longitude: -75.5579, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const LBL: any = { pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo para recoger', on_way: 'En camino', delivered: 'Entregado' };
const money = (n: number) => '$' + Number(n).toLocaleString('es-CO');
const say = (e: any) => Alert.alert('Ups', String(e?.message || e));
const km = (a: any, b: any) => {
  const r = (x: number) => (x * Math.PI) / 180, dLa = r(b.latitude - a.latitude), dLo = r(b.longitude - a.longitude);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

async function getPos() {
  const p = await Location.requestForegroundPermissionsAsync();
  if (p.status !== 'granted') return null;
  try {
    const l: any = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000)),
    ]);
    return { latitude: l.coords.latitude, longitude: l.coords.longitude };
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync();
      return last ? { latitude: last.coords.latitude, longitude: last.coords.longitude } : null;
    } catch { return null; }
  }
}

function useOrders(): [any[], () => Promise<void>] {
  const [rows, set] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await sb.from('orders').select('*, stores(name,address,lat,lng)').order('created_at', { ascending: false });
    set(data || []);
  }, []);
  useEffect(() => {
    load();
    const ch = sb.channel('o' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p: any) => {
      if (p.new?.status && p.new.status !== p.old?.status) Alert.alert('Cerquita', `Pedido ${LBL[p.new.status]}`);
      load();
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);
  return [rows, load];
}

const Btn = ({ t, on, c = G }: any) => <T style={[s.btn, { backgroundColor: c }]} onPress={on}><Text style={s.btnT}>{t}</Text></T>;
const Inp = (p: any) => <TextInput placeholderTextColor="#999" autoCapitalize="none" {...p} style={s.input} />;

function OrderMap({ o }: any) {
  const st = o.stores;
  const pts: any[] = [];
  if (st?.lat != null) pts.push({ latitude: st.lat, longitude: st.lng });
  if (o.dest_lat != null) pts.push({ latitude: o.dest_lat, longitude: o.dest_lng });
  if (o.courier_lat != null) pts.push({ latitude: o.courier_lat, longitude: o.courier_lng });
  if (!pts.length) return null;
  const la = pts.map((p) => p.latitude), lo = pts.map((p) => p.longitude);
  const region = {
    latitude: (Math.max(...la) + Math.min(...la)) / 2, longitude: (Math.max(...lo) + Math.min(...lo)) / 2,
    latitudeDelta: Math.max(0.012, (Math.max(...la) - Math.min(...la)) * 2.2), longitudeDelta: Math.max(0.012, (Math.max(...lo) - Math.min(...lo)) * 2.2),
  };
  return (
    <MapView key={o.courier_lat != null ? 'c' : 'n'} style={{ height: 220, marginTop: 8 }} initialRegion={region}>
      {st?.lat != null && <Marker coordinate={{ latitude: st.lat, longitude: st.lng }} title={st.name} description="Comercio" pinColor={O} />}
      {o.dest_lat != null && <Marker coordinate={{ latitude: o.dest_lat, longitude: o.dest_lng }} title="Tu entrega" pinColor={G} />}
      {o.courier_lat != null && <Marker coordinate={{ latitude: o.courier_lat, longitude: o.courier_lng }} title="Repartidor" pinColor={B} />}
    </MapView>
  );
}

function Auth() {
  const [signup, setSignup] = useState(false);
  const [role, setRole] = useState('cliente');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  async function go() {
    const r = signup ? await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { role, name } } })
                     : await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (r.error) say(r.error);
  }
  return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <StatusBar style="light" />
      <Text style={s.logo}>Cerquita</Text><Text style={s.sub}>Tu pedido, cerquita</Text>
      {signup && <>
        <Inp placeholder="Nombre" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {['cliente', 'comercio', 'repartidor'].map((r) => (
            <T key={r} onPress={() => setRole(r)} style={[s.chip, role === r && { backgroundColor: G }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{r}</Text></T>))}
        </View></>}
      <Inp placeholder="Correo" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Inp placeholder="Contraseña" secureTextEntry value={pw} onChangeText={setPw} />
      <Btn t={signup ? 'Crear cuenta' : 'Entrar'} on={go} />
      <T onPress={() => setSignup(!signup)}><Text style={{ color: '#fff', marginTop: 16 }}>{signup ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}</Text></T>
    </SafeAreaView>
  );
}

function Cliente({ me }: any) {
  const [orders, reload] = useOrders();
  const [stores, setStores] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [addr, setAddr] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { sb.from('stores').select('*').then(({ data }) => setStores(data || [])); }, []);
  async function open(st: any) { setStore(st); setCart([]); const { data } = await sb.from('products').select('*').eq('store_id', st.id); setProds(data || []); }
  const total = cart.reduce((a, c) => a + c.price, 0);
  async function order() {
    if (!cart.length) return Alert.alert('Elige al menos un producto', 'Toca un producto para agregarlo al carrito.');
    if (!addr.trim()) return Alert.alert('Falta tu dirección', 'Escribe la dirección de entrega.');
    setSending(true);
    try {
      const c = await getPos();
      if (!c) { Alert.alert('No pude ubicarte', 'Activa el GPS, da permiso de ubicación a Cerquita y vuelve a intentar.'); return; }
      const { error } = await sb.from('orders').insert({ store_id: store.id, customer_id: me.id, items: cart, total, address: addr.trim(), dest_lat: c.latitude, dest_lng: c.longitude });
      if (error) { say(error); return; }
      Alert.alert('Pedido enviado', 'El comercio ya lo recibió.');
      setStore(null); setCart([]); setAddr(''); reload();
    } catch (e) { say(e); } finally { setSending(false); }
  }
  const mine = orders.filter((o) => o.customer_id === me.id);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {!store ? <>
        <Text style={s.h}>Elige un comercio</Text>
        {stores.map((st) => <T key={st.id} style={s.card} onPress={() => open(st)}><Text style={s.b}>{st.name}</Text><Text>{st.address}</Text></T>)}
        {!stores.length && <Text>Aún no hay comercios. Crea una cuenta "comercio" primero.</Text>}
        <Text style={[s.h, { marginTop: 20 }]}>Mis pedidos</Text>
        {!mine.length && <Text>Todavía no has hecho pedidos.</Text>}
        {mine.map((o) => (
          <View key={o.id} style={s.card}>
            <Text style={s.b}>{o.stores?.name} · {money(o.total)}</Text>
            <Text style={{ color: '#555' }}>{o.items.map((i: any) => i.name).join(', ')}</Text>
            <Text style={{ color: O, fontWeight: '800', marginTop: 4 }}>{LBL[o.status]}</Text>
            {o.status !== 'delivered' && <OrderMap o={o} />}
          </View>))}
      </> : <>
        <T onPress={() => setStore(null)}><Text style={{ color: O, fontWeight: '700' }}>← Volver</Text></T>
        <Text style={s.h}>{store.name}</Text>
        <Text style={{ marginBottom: 8 }}>Toca un producto para agregarlo:</Text>
        {prods.map((p) => <T key={p.id} style={s.card} onPress={() => setCart([...cart, p])}><Text style={s.b}>{p.name} — {money(p.price)}</Text><Text style={{ color: G, fontWeight: '700' }}>+ Agregar</Text></T>)}
        {!prods.length && <Text>Este comercio aún no tiene productos.</Text>}
        <View style={[s.card, { backgroundColor: '#E8F7EE' }]}>
          <Text style={s.b}>Carrito ({cart.length}): {money(total)}</Text>
          <Text>{cart.map((c) => c.name).join(', ') || 'Vacío'}</Text>
          {!!cart.length && <T onPress={() => setCart([])}><Text style={{ color: O, fontWeight: '700', marginTop: 6 }}>Vaciar carrito</Text></T>}
        </View>
        <Inp placeholder="Tu dirección de entrega" value={addr} onChangeText={setAddr} />
        <Btn t={sending ? 'Enviando…' : 'Hacer pedido'} on={sending ? () => {} : order} />
      </>}
    </ScrollView>
  );
}

function Comercio({ me }: any) {
  const [orders, reload] = useOrders();
  const [store, setStore] = useState<any>(undefined);
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [pn, setPn] = useState(''); const [pp, setPp] = useState('');
  useEffect(() => { sb.from('stores').select('*').eq('owner_id', me.id).maybeSingle().then(({ data }) => setStore(data || null)); }, []);
  async function createStore() {
    const c = await getPos();
    const { data, error } = await sb.from('stores').insert({ owner_id: me.id, name: n, address: a, lat: c?.latitude, lng: c?.longitude }).select().single();
    error ? say(error) : setStore(data);
  }
  async function addProd() { const { error } = await sb.from('products').insert({ store_id: store.id, name: pn, price: parseInt(pp) }); error ? say(error) : (setPn(''), setPp(''), Alert.alert('Producto agregado')); }
  const set = (id: string, status: string) => sb.from('orders').update({ status }).eq('id', id).then(({ error }) => { if (error) say(error); reload(); });
  if (store === undefined) return <Text style={{ padding: 16 }}>Cargando tu comercio…</Text>;
  if (!store) return <View style={{ padding: 16 }}><Text style={s.h}>Crea tu comercio</Text><Text style={{ marginBottom: 10 }}>Esta cuenta aún no tiene comercio. Si ya creaste uno, entra con la cuenta que lo creó.</Text><Inp placeholder="Nombre del comercio" value={n} onChangeText={setN} /><Inp placeholder="Dirección" value={a} onChangeText={setA} /><Btn t="Crear comercio" on={createStore} /></View>;
  const mine = orders.filter((o) => o.store_id === store.id);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>{store.name}</Text>
      <Text style={s.b}>Agregar producto</Text>
      <Inp placeholder="Nombre" value={pn} onChangeText={setPn} /><Inp placeholder="Precio (ej. 12000)" keyboardType="number-pad" value={pp} onChangeText={setPp} />
      <Btn t="Guardar producto" on={addProd} />
      <Text style={[s.h, { marginTop: 20 }]}>Pedidos</Text>
      {!mine.length && <Text>Aún no te han hecho pedidos.</Text>}
      {mine.map((o) => (
        <View key={o.id} style={s.card}>
          <Text style={s.b}>{o.items.map((i: any) => i.name).join(', ')} · {money(o.total)}</Text>
          <Text>Entregar en: {o.address}</Text>
          <Text style={{ color: O, fontWeight: '800', marginBottom: 6 }}>{LBL[o.status]}</Text>
          {o.status === 'pending' && <Btn t="Aceptar y preparar" on={() => set(o.id, 'preparing')} />}
          {o.status === 'preparing' && <Btn t="Listo para recoger" on={() => set(o.id, 'ready')} />}
        </View>))}
    </ScrollView>
  );
}

function Repartidor({ me }: any) {
  const [orders, reload] = useOrders();
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState<any>(null);
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
          const a = activeRef.current;
          if (a) sb.from('orders').update({ courier_lat: c.latitude, courier_lng: c.longitude }).eq('id', a.id).then(() => {});
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
  const avail = orders.filter((o) => o.status === 'ready' && !o.courier_id);
  const line: any[] = [];
  if (active) {
    if (pos) line.push(pos);
    if (active.stores?.lat != null) line.push({ latitude: active.stores.lat, longitude: active.stores.lng });
    if (active.dest_lat != null) line.push({ latitude: active.dest_lat, longitude: active.dest_lng });
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Switch value={online} onValueChange={setOnline} trackColor={{ true: G }} /><Text style={s.b}> {online ? 'En línea' : 'Desconectado'}</Text></View>
      {!online && <Text style={{ marginVertical: 8 }}>Activa "En línea" para ver el mapa y los pedidos disponibles.</Text>}
      {online && (
        <MapView ref={mapRef} style={{ height: 280, marginVertical: 8 }} initialRegion={DEF} showsUserLocation>
          {avail.map((o) => o.stores?.lat != null && <Marker key={o.id} coordinate={{ latitude: o.stores.lat, longitude: o.stores.lng }} title={o.stores.name} description={money(o.total)} pinColor={O} />)}
          {active?.stores?.lat != null && <Marker coordinate={{ latitude: active.stores.lat, longitude: active.stores.lng }} title={active.stores.name} description="Recoger aquí" pinColor={O} />}
          {active?.dest_lat != null && <Marker coordinate={{ latitude: active.dest_lat, longitude: active.dest_lng }} title="Entregar aquí" pinColor={G} />}
          {line.length > 1 && <Polyline coordinates={line} strokeColor={B} strokeWidth={4} />}
        </MapView>)}
      {online && !pos && <Text style={{ marginBottom: 8 }}>Buscando tu ubicación…</Text>}
      {active && (
        <View style={s.card}>
          <Text style={s.h}>Entrega en curso</Text>
          <Text>1. Recoge en: {active.stores?.name} — {active.stores?.address}</Text>
          <Text>2. Entrega en: {active.address}</Text>
          <Text style={{ marginVertical: 4 }}>{money(active.total)}</Text>
          <Btn t="Pedido entregado" on={() => done(active.id)} />
        </View>)}
      {online && !active && <>
        <Text style={s.h}>Pedidos disponibles</Text>
        {avail.map((o) => (
          <View key={o.id} style={s.card}>
            <Text style={s.b}>{o.stores?.name} → {o.address}</Text>
            <Text>{money(o.total)}{pos && o.stores?.lat != null ? ` · ${km(pos, { latitude: o.stores.lat, longitude: o.stores.lng }).toFixed(1)} km al comercio` : ''}</Text>
            <Btn t="Aceptar pedido" on={() => accept(o.id)} />
          </View>))}
        {!avail.length && <Text>Todavía no hay pedidos listos. Aparecen aquí cuando el comercio los marca como "Listo para recoger".</Text>}
      </>}
    </ScrollView>
  );
}

function Root() {
  const [session, setSession] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);
  const [perr, setPerr] = useState('');
  useEffect(() => {
    if (!session) { setMe(null); return; }
    let alive = true;
    (async () => {
      for (let i = 0; i < 4; i++) {
        const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (data) { if (alive) { setMe(data); setPerr(''); } return; }
        if (i === 3 && alive) setPerr(error?.message || 'No se encontró tu perfil');
        await new Promise((r) => setTimeout(r, 800));
      }
    })();
    return () => { alive = false; };
  }, [session]);
  if (!ready) return <View style={[s.center, { backgroundColor: N }]}><Text style={s.logo}>Cerquita</Text></View>;
  if (!session) return <Auth />;
  if (!me) return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <Text style={s.logo}>Cerquita</Text>
      <Text style={{ color: '#fff', marginVertical: 16, textAlign: 'center' }}>{perr || 'Cargando tu perfil…'}</Text>
      {!!perr && <Btn t="Salir" on={() => sb.auth.signOut()} c={O} />}
    </SafeAreaView>
  );
  const View_ = me.role === 'cliente' ? Cliente : me.role === 'comercio' ? Comercio : Repartidor;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: TOP }}>
      <StatusBar style="dark" />
      <View style={s.top}><Text style={{ fontWeight: '900', color: N, fontSize: 18 }}>Cerquita · {me.role}</Text><T onPress={() => sb.auth.signOut()}><Text style={{ color: O, fontWeight: '700' }}>Salir</Text></T></View>
      <Text style={{ color: '#666', fontSize: 12, paddingHorizontal: 16, paddingTop: 6 }}>{session.user.email}</Text><View_ me={me} />
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component<any, { err: any }> {
  state = { err: null as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  render() {
    if (this.state.err) return (
      <SafeAreaView style={[s.center, { backgroundColor: N }]}>
        <Text style={s.logo}>Cerquita</Text>
        <Text style={{ color: '#fff', marginVertical: 16, textAlign: 'center' }}>Ocurrió un error: {String(this.state.err?.message || this.state.err)}</Text>
        <Btn t="Reintentar" on={() => this.setState({ err: null })} />
      </SafeAreaView>
    );
    return this.props.children;
  }
}

export default function App() { return <ErrorBoundary><Root /></ErrorBoundary>; }

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { color: '#fff', fontSize: 42, fontWeight: '900' }, sub: { color: '#9FD8B5', marginBottom: 24 },
  input: { backgroundColor: '#F1F3F4', width: '100%', borderRadius: 12, padding: 14, marginBottom: 10 },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center', width: '100%', marginTop: 6 }, btnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  chip: { backgroundColor: '#3A5568', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  h: { fontSize: 20, fontWeight: '900', color: N, marginBottom: 8 }, b: { fontWeight: '700', marginBottom: 4 },
  card: { backgroundColor: '#F7F9FA', borderRadius: 14, padding: 14, marginBottom: 10 },
});