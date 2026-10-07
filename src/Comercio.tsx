import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity as T, ScrollView, Alert } from 'react-native';
import { supabase as sb } from './supabase';
import { s, G, O, B, TEAL, CATS, MT, money, say, shortId, isToday, ago, catOf, itemsTxt, getPos, useOrders, Ico, Chip, Btn, Inp, Vacio, Stat, Logo, Bell, TabBar, Perfil } from './ui';

export function Comercio({ me, email }: any) {
  const [orders, reload] = useOrders();
  const [tab, setTab] = useState('inicio');
  const [store, setStore] = useState<any>(undefined);
  const [prods, setProds] = useState<any[]>([]);
  const [rt, setRt] = useState<any>(null);
  const [bal, setBal] = useState<any>(null);
  const [liqs, setLiqs] = useState<any[]>([]);
  const [n, setN] = useState(''); const [a, setA] = useState(''); const [cat, setCat] = useState('restaurantes');
  const [pn, setPn] = useState(''); const [pp, setPp] = useState('');
  useEffect(() => { sb.from('stores').select('*').eq('owner_id', me.id).maybeSingle().then(({ data }) => setStore(data || null)); }, []);
  const loadProds = useCallback(async () => {
    if (!store) return;
    const { data } = await sb.from('products').select('*').eq('store_id', store.id).order('name');
    setProds(data || []);
  }, [store?.id]);
  useEffect(() => { loadProds(); }, [loadProds]);
  useEffect(() => {
    if (!store) return;
    sb.rpc('store_stats').then(({ data }) => setRt((data || []).find((x: any) => x.store_id === store.id) || null));
    sb.rpc('my_balance').then(({ data }) => setBal(data));
    sb.from('settlements').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => setLiqs(data || []));
  }, [store?.id, orders.length, tab]);
  async function createStore() {
    if (!n.trim()) return Alert.alert('Falta el nombre', 'Escribe el nombre de tu comercio.');
    const c = await getPos();
    const { data, error } = await sb.from('stores').insert({ owner_id: me.id, name: n.trim(), address: a.trim(), category: cat, lat: c?.latitude, lng: c?.longitude }).select().single();
    error ? say(error) : setStore(data);
  }
  async function addProd() {
    if (!pn.trim() || !parseInt(pp)) return Alert.alert('Faltan datos', 'Escribe el nombre y el precio del producto.');
    const { error } = await sb.from('products').insert({ store_id: store.id, name: pn.trim(), price: parseInt(pp) });
    if (error) return say(error);
    setPn(''); setPp(''); loadProds();
  }
  function delProd(p: any) {
    Alert.alert('Borrar producto', `¿Borrar "${p.name}"?`, [{ text: 'Cancelar' }, { text: 'Borrar', style: 'destructive', onPress: async () => { await sb.from('products').delete().eq('id', p.id); loadProds(); } }]);
  }
  async function toggleOpen() {
    const { data, error } = await sb.from('stores').update({ is_open: !store.is_open }).eq('id', store.id).select().single();
    error ? say(error) : setStore(data);
  }
  const setSt = (id: string, status: string) => sb.from('orders').update({ status }).eq('id', id).then(({ error }) => { if (error) say(error); reload(); });
  if (store === undefined) return <Vacio i="clock-outline" t="Cargando…" d="" />;
  const mine = store ? orders.filter((o) => o.store_id === store.id) : [];
  const hoy = mine.filter((o) => isToday(o.created_at));
  const ventas = hoy.reduce((a2, o) => a2 + (o.subtotal ?? o.total), 0);
  const pendientes = mine.filter((o) => o.status === 'pending').length;
  const Acciones = ({ o }: any) => (<>
    {o.status === 'pending' && <Btn t="Aceptar pedido y empezar a preparar" on={() => setSt(o.id, 'preparing')} />}
    {o.status === 'preparing' && <Btn t="Marcar como listo para recoger" on={() => setSt(o.id, 'ready')} />}
  </>);
  let body: any;
  if (!store) body = tab === 'perfil' ? <Perfil me={me} email={email} /> : (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 16 }}><Logo k={0.9} /></View>
      <Text style={s.h}>Crea tu comercio</Text>
      <Text style={{ marginBottom: 10 }}>Esta cuenta aún no tiene comercio. Si ya creaste uno, entra con la cuenta que lo creó.</Text>
      <Inp placeholder="Nombre del comercio" value={n} onChangeText={setN} />
      <Inp placeholder="Dirección" value={a} onChangeText={setA} />
      <Text style={s.b}>Categoría</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {CATS.filter((c) => !c.soon).map((c) => (
          <T key={c.k} onPress={() => setCat(c.k)} style={[s.chip2, cat === c.k && { backgroundColor: G, borderColor: G }]}><Text style={{ color: cat === c.k ? '#fff' : '#0B2A3D', fontWeight: '700' }}>{c.t}</Text></T>))}
      </View>
      <Btn t="Crear comercio" on={createStore} />
    </ScrollView>
  );
  else if (tab === 'inicio') body = (
    <ScrollView>
      <View style={{ backgroundColor: TEAL, padding: 16, paddingBottom: 22 }}>
        <View style={s.row}><Logo light k={0.85} /><Bell dark n={pendientes} on={() => setTab('pedidos')} /></View>
        <View style={[s.rowc, { marginTop: 14 }]}>
          <View style={[s.avatar, { width: 60, height: 60, borderRadius: 14, backgroundColor: catOf(store).c }]}><Ico n={catOf(store).i} c="#fff" z={32} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={s.rowc}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 20, fontWeight: '900', flexShrink: 1 }}>{store.name}</Text>
              <T onPress={toggleOpen} style={{ backgroundColor: store.is_open ? G : '#D32F2F', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{store.is_open ? 'Abierto' : 'Cerrado'}</Text></T>
            </View>
            <Text numberOfLines={1} style={{ color: '#BFE9CF' }}>{catOf(store).t} • {store.address}</Text>
            <Text style={{ color: '#BFD3DD', fontSize: 11, marginTop: 2 }}>Toca "Abierto" para abrir o cerrar tu comercio</Text>
          </View>
        </View>
      </View>
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -14, padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Stat i="shopping-outline" c={O} v={hoy.length} l="Pedidos hoy" />
          <Stat i="trending-up" c={G} v={money(ventas)} l="Ventas hoy" />
          <Stat i="star" c={O} v={rt?.rating ? `★ ${rt.rating}` : '—'} l="Calificación" />
          <Stat i="clock-outline" c={O} v={rt?.avg_minutes ? `${rt.avg_minutes} min` : '—'} l="Tiempo promedio" />
        </View>
        <View style={[s.row, { marginTop: 6, marginBottom: 8 }]}><Text style={[s.h, { marginBottom: 0 }]}>Pedidos recientes</Text><T onPress={() => setTab('pedidos')}><Text style={{ color: B, fontWeight: '700' }}>Ver todos ›</Text></T></View>
        {!mine.length && <Text style={{ marginBottom: 10 }}>Aún no te han hecho pedidos.</Text>}
        {mine.slice(0, 3).map((o) => (
          <View key={o.id} style={[s.card, s.row]}>
            <View style={[s.rowc, { flex: 1 }]}>
              <View style={[s.avatarS, { backgroundColor: '#FDE3D3' }]}><Ico n="shopping-outline" c={O} z={22} /></View>
              <View style={{ marginLeft: 10, flex: 1 }}><Text style={s.b}>{shortId(o.id)}</Text><Text numberOfLines={1} style={{ color: '#666' }}>{itemsTxt(o.items)}</Text></View>
            </View>
            <View style={{ alignItems: 'flex-end' }}><Chip st={o.status} /><Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{ago(o.created_at)}</Text></View>
          </View>))}
        <Btn t="+  Crear nuevo producto" on={() => setTab('productos')} />
      </View>
    </ScrollView>
  );
  else if (tab === 'pedidos') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Pedidos</Text>
      {!mine.length && <Text>Aún no te han hecho pedidos.</Text>}
      {mine.map((o) => (
        <View key={o.id} style={s.card}>
          <View style={s.row}><Text style={s.b}>{shortId(o.id)} · {money(o.subtotal ?? o.total)}</Text><Text style={{ color: '#888', fontSize: 11 }}>{ago(o.created_at)}</Text></View>
          <Text>{itemsTxt(o.items)}</Text>
          <Text style={{ color: '#666', marginVertical: 4 }}>Entregar en: {o.address}</Text>
          <Text style={{ color: G, fontWeight: '700' }}>Recibes {money(o.merchant_amount ?? o.total)} (comisión {o.commission_pct ?? 0}%: {money(o.commission_amount ?? 0)})</Text>
          <View style={{ marginTop: 6 }}><Chip st={o.status} /></View>
          <View style={{ marginTop: 6 }}><Acciones o={o} /></View>
        </View>))}
    </ScrollView>
  );
  else if (tab === 'productos') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>Productos</Text>
      <Inp placeholder="Nombre del producto" value={pn} onChangeText={setPn} />
      <Inp placeholder="Precio (ej. 12000)" keyboardType="number-pad" value={pp} onChangeText={setPp} />
      <Btn t="+  Guardar producto" on={addProd} />
      <Text style={[s.h, { marginTop: 18 }]}>Mis productos ({prods.length})</Text>
      {prods.map((p) => (
        <View key={p.id} style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.b}>{p.name}</Text><Text style={{ color: G, fontWeight: '800' }}>{money(p.price)}</Text></View>
          <T onPress={() => delProd(p)}><Ico n="trash-can-outline" c="#D32F2F" z={24} /></T>
        </View>))}
      {!prods.length && <Text>Aún no tienes productos.</Text>}
    </ScrollView>
  );
  else if (tab === 'stats') {
    const entregados = mine.filter((o) => o.status === 'delivered');
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <Text style={s.h}>Estadísticas</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Stat i="shopping-outline" c={O} v={mine.length} l="Pedidos totales" />
          <Stat i="check-circle-outline" c={G} v={entregados.length} l="Entregados" />
          <Stat i="cash" c={G} v={money(bal?.merchant_sales || 0)} l="Ventas" />
          <Stat i="percent" c={O} v={money(bal?.merchant_commissions || 0)} l="Comisiones" />
          <Stat i="wallet-outline" c={B} v={money(bal?.merchant_net || 0)} l="Neto" />
          <Stat i="check-decagram" c={G} v={money(bal?.merchant_settled || 0)} l="Liquidado" />
        </View>
        <View style={[s.card, { backgroundColor: '#FFF8F1' }]}>
          <Text style={s.b}>Pendiente por liquidar</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: O }}>{money(bal?.merchant_pending || 0)}</Text>
        </View>
        <Text style={[s.h, { marginTop: 8 }]}>Mis liquidaciones</Text>
        {!liqs.length && <Text>Aún no tienes liquidaciones.</Text>}
        {liqs.map((l) => (
          <View key={l.id} style={[s.card, s.row]}>
            <View><Text style={s.b}>{money(l.net_amount)}</Text><Text style={{ color: '#888', fontSize: 11 }}>{ago(l.created_at)}</Text></View>
            <Text style={{ fontWeight: '800', color: l.status === 'PAGADA' ? G : O }}>{l.status}</Text>
          </View>))}
      </ScrollView>
    );
  } else body = <Perfil me={me} email={email} />;
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}>{body}</View><TabBar tabs={MT} tab={tab} go={setTab} /></View>;
}