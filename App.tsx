import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity as T, Switch, ScrollView, StyleSheet, Alert, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase as sb } from './src/supabase';

const G = '#1DB954', N = '#0B2A3D', O = '#F26B21';
const TOP = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;
const LBL: any = { pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo para recoger', on_way: 'En camino', delivered: 'Entregado' };
const money = (n: number) => '$' + Number(n).toLocaleString('es-CO');
const say = (e: any) => Alert.alert('Ups', String(e?.message || e));

function useOrders() {
  const [rows, set] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await sb.from('orders').select('*, stores(name,address,lat,lng)').order('created_at', { ascending: false });
    set(data || []);
  }, []);
  useEffect(() => {
    load();
    const ch = sb.channel('o' + Math.random()).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p: any) => {
      if (p.new?.status && p.new.status !== p.old?.status)
        Alert.alert('Cerquita', `Pedido ${LBL[p.new.status]}`);
      load();
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);
  return rows;
}

const Btn = ({ t, on, c = G }: any) => <T style={[s.btn, { backgroundColor: c }]} onPress={on}><Text style={s.btnT}>{t}</Text></T>;
const Inp = (p: any) => <TextInput placeholderTextColor="#999" autoCapitalize="none" {...p} style={s.input} />;

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
  const orders = useOrders();
  const [stores, setStores] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [addr, setAddr] = useState('');
  useEffect(() => { sb.from('stores').select('*').then(({ data }) => setStores(data || [])); }, []);
  async function open(st: any) { setStore(st); setCart([]); const { data } = await sb.from('products').select('*').eq('store_id', st.id); setProds(data || []); }
  async function order() {
    if (!cart.length || !addr) return Alert.alert('Agrega productos y tu dirección');
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') return Alert.alert('Activa la ubicación para pedir');
    const l = await Location.getCurrentPositionAsync({});
    const { error } = await sb.from('orders').insert({ store_id: store.id, customer_id: me.id, items: cart, total: cart.reduce((a, c) => a + c.price, 0), address: addr, dest_lat: l.coords.latitude, dest_lng: l.coords.longitude });
    if (error) return say(error);
    setStore(null); setCart([]);
  }
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      {!store ? <>
        <Text style={s.h}>Comercios</Text>
        {stores.map((st) => <T key={st.id} style={s.card} onPress={() => open(st)}><Text style={s.b}>{st.name}</Text><Text>{st.address}</Text></T>)}
        {!stores.length && <Text>Aún no hay comercios. Crea una cuenta "comercio" primero.</Text>}
        <Text style={[s.h, { marginTop: 20 }]}>Mis pedidos</Text>
        {orders.map((o) => (
          <View key={o.id} style={s.card}>
            <Text style={s.b}>{o.stores?.name} · {money(o.total)}</Text>
            <Text style={{ color: O, fontWeight: '800' }}>{LBL[o.status]}</Text>
            {o.status === 'on_way' && o.courier_lat != null && (
              <MapView style={{ height: 200, marginTop: 8 }} region={{ latitude: o.courier_lat, longitude: o.courier_lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
                <Marker coordinate={{ latitude: o.courier_lat, longitude: o.courier_lng }} title="Tu repartidor" pinColor={G} />
                <Marker coordinate={{ latitude: o.dest_lat, longitude: o.dest_lng }} title="Tu ubicación" />
              </MapView>)}
          </View>))}
      </> : <>
        <T onPress={() => setStore(null)}><Text style={{ color: O, fontWeight: '700' }}>← Volver</Text></T>
        <Text style={s.h}>{store.name}</Text>
        {prods.map((p) => <T key={p.id} style={s.card} onPress={() => setCart([...cart, p])}><Text style={s.b}>{p.name} — {money(p.price)}</Text><Text style={{ color: G }}>+ Agregar</Text></T>)}
        <Text style={s.b}>Carrito: {cart.length} · {money(cart.reduce((a, c) => a + c.price, 0))}</Text>
        <Inp placeholder="Tu dirección de entrega" value={addr} onChangeText={setAddr} />
        <Btn t="Hacer pedido" on={order} />
      </>}
    </ScrollView>
  );
}

function Comercio({ me }: any) {
  const orders = useOrders();
  const [store, setStore] = useState<any>(undefined);
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [pn, setPn] = useState(''); const [pp, setPp] = useState('');
  useEffect(() => { sb.from('stores').select('*').eq('owner_id', me.id).maybeSingle().then(({ data }) => setStore(data || null)); }, []);
  async function createStore() {
    const p = await Location.requestForegroundPermissionsAsync(); const l = p.status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
    const { data, error } = await sb.from('stores').insert({ owner_id: me.id, name: n, address: a, lat: l?.coords.latitude, lng: l?.coords.longitude }).select().single();
    error ? say(error) : setStore(data);
  }
  async function addProd() { const { error } = await sb.from('products').insert({ store_id: store.id, name: pn, price: parseInt(pp) }); error ? say(error) : (setPn(''), setPp(''), Alert.alert('Producto agregado')); }
  const set = (id: string, status: string) => sb.from('orders').update({ status }).eq('id', id).then(({ error }) => error && say(error));
  if (store === undefined) return <Text style={{ padding: 16 }}>Cargando tu comercio…</Text>;
  if (!store) return <View style={{ padding: 16 }}><Text style={s.h}>Crea tu comercio</Text><Inp placeholder="Nombre del comercio" value={n} onChangeText={setN} /><Inp placeholder="Dirección" value={a} onChangeText={setA} /><Btn t="Crear comercio" on={createStore} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h}>{store.name}</Text>
      <Text style={s.b}>Agregar producto</Text>
      <Inp placeholder="Nombre" value={pn} onChangeText={setPn} /><Inp placeholder="Precio (ej. 12000)" keyboardType="number-pad" value={pp} onChangeText={setPp} />
      <Btn t="Guardar producto" on={addProd} />
      <Text style={[s.h, { marginTop: 20 }]}>Pedidos</Text>
      {orders.filter((o) => o.store_id === store.id).map((o) => (
        <View key={o.id} style={s.card}>
          <Text style={s.b}>{o.items.map((i: any) => i.name).join(', ')} · {money(o.total)}</Text>
          <Text style={{ color: O, fontWeight: '800', marginBottom: 6 }}>{LBL[o.status]}</Text>
          {o.status === 'pending' && <Btn t="Aceptar y preparar" on={() => set(o.id, 'preparing')} />}
          {o.status === 'preparing' && <Btn t="Listo para recoger" on={() => set(o.id, 'ready')} />}
        </View>))}
    </ScrollView>
  );
}

function Repartidor({ me }: any) {
  const orders = useOrders();
  const [online, setOnline] = useState(false);
  const active = orders.find((o) => o.courier_id === me.id && o.status === 'on_way');
  useEffect(() => {
    if (!online || !active) return;
    let sub: Location.LocationSubscription;
    Location.requestForegroundPermissionsAsync().then(async (p) => {
      if (p.status !== 'granted') return Alert.alert('Activa la ubicación');
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 8 },
        (l) => { sb.from('orders').update({ courier_lat: l.coords.latitude, courier_lng: l.coords.longitude }).eq('id', active.id).then(); });
    });
    return () => { sub?.remove(); };
  }, [online, active?.id]);
  const accept = (id: string) => sb.from('orders').update({ courier_id: me.id, status: 'on_way' }).eq('id', id).is('courier_id', null).eq('status', 'ready').then(({ error }) => error && say(error));
  const done = (id: string) => sb.from('orders').update({ status: 'delivered' }).eq('id', id).then(({ error }) => error && say(error));
  const open = orders.filter((o) => o.status === 'ready' && !o.courier_id);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Switch value={online} onValueChange={setOnline} trackColor={{ true: G }} /><Text style={s.b}> {online ? 'En línea' : 'Desconectado'}</Text></View>
      {active && (
        <View style={s.card}>
          <Text style={s.h}>Entrega en curso</Text>
          <Text>Recogido en: {active.stores?.name}</Text><Text>Entregar en: {active.address}</Text>
          <MapView style={{ height: 220, marginVertical: 8 }} region={{ latitude: active.dest_lat, longitude: active.dest_lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }} showsUserLocation>
            <Marker coordinate={{ latitude: active.dest_lat, longitude: active.dest_lng }} title="Cliente" pinColor={G} />
            {active.stores?.lat != null && <Marker coordinate={{ latitude: active.stores.lat, longitude: active.stores.lng }} title="Comercio" pinColor={O} />}
          </MapView>
          <Btn t="Pedido entregado" on={() => done(active.id)} />
        </View>)}
      {online && !active && <>
        <Text style={s.h}>Pedidos disponibles</Text>
        {open.map((o) => <View key={o.id} style={s.card}><Text style={s.b}>{o.stores?.name} → {o.address}</Text><Text>{money(o.total)}</Text><Btn t="Aceptar" on={() => accept(o.id)} /></View>)}
        {!open.length && <Text>Esperando pedidos…</Text>}
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
      <View_ me={me} />
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