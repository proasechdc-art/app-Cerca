import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity as T, ScrollView, Alert, Linking, Image } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { supabase as sb } from './supabase';
import { s, G, N, O, CATS, MAS, CT, catOf, Foto, tomarFotoLugar, money, say, ago, shortId, itemsTxt, info, getPos, useOrders, Ico, Btn, Btn2, Inp, Vacio, Logo, Bell, TabBar, Perfil, OrderMap, Stars, Track } from './ui';

export function Cliente({ me, email }: any) {
  const [orders, reload] = useOrders();
  const [tab, setTab] = useState('inicio');
  const [stores, setStores] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [favs, setFavs] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [store, setStore] = useState<any>(null);
  const [prods, setProds] = useState<any[]>([]);
  const [cart, setCart] = useState<any>({});
  const [addr, setAddr] = useState('');
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [here, setHere] = useState('Mi ubicación');
  const [rate, setRate] = useState<any>(null);
  const [rs, setRs] = useState(0);
  const [rc, setRc] = useState(0);
  const [claimFor, setClaimFor] = useState<any>(null);
  const [cReason, setCReason] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [claims, setClaims] = useState<any[]>([]);
  const [fee, setFee] = useState(0);
  const [pay, setPay] = useState('cash');
  const [noAddr, setNoAddr] = useState(false);
  const [pin, setPin] = useState<any>(null);
  const [lugarFoto, setLugarFoto] = useState<any>(null);
  const [masOpen, setMasOpen] = useState(false);

  const loadAll = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      sb.from('stores').select('*'),
      sb.rpc('store_stats'),
      sb.from('favorites').select('store_id').eq('customer_id', me.id),
      sb.from('reviews').select('order_id').eq('customer_id', me.id),
    ]);
    setStores(a.data || []);
    sb.from('finance_settings').select('courier_fee').eq('id', 1).maybeSingle().then(({ data }) => setFee(data?.courier_fee || 0));
    const m: any = {}; (b.data || []).forEach((x: any) => { m[x.store_id] = x; }); setStats(m);
    setFavs((c.data || []).map((x: any) => x.store_id));
    setReviewed((d.data || []).map((x: any) => x.order_id));
    sb.from('claims').select('order_id, status, refund_amount').then(({ data }) => setClaims(data || []));
  }, []);
  useEffect(() => { loadAll(); }, [tab]);
  useEffect(() => {
    (async () => {
      const c = await getPos(); if (!c) return;
      try {
        const r = await Location.reverseGeocodeAsync(c); const a: any = r[0];
        const t = a ? ([a.street, a.streetNumber].filter(Boolean).join(' ') || a.name || '') : '';
        if (t) setHere(t);
      } catch {}
    })();
  }, []);

  const go = (k: string) => { setStore(null); setTab(k); };
  async function toggleFav(st: any) {
    const on = favs.includes(st.id);
    setFavs(on ? favs.filter((x) => x !== st.id) : [...favs, st.id]);
    const { error } = on
      ? await sb.from('favorites').delete().eq('customer_id', me.id).eq('store_id', st.id)
      : await sb.from('favorites').insert({ customer_id: me.id, store_id: st.id });
    if (error) { say(error); loadAll(); }
  }
  async function open(st: any) {
    if (st.is_open === false) return Alert.alert('Comercio cerrado', 'Este comercio no recibe pedidos por ahora.');
    setStore(st); setCart({}); setPay('cash'); setNoAddr(false); setPin(null); setLugarFoto(null);
    const { data } = await sb.from('products').select('*').eq('store_id', st.id);
    setProds(data || []);
  }
  const setQty = (id: string, d: number) => setCart({ ...cart, [id]: Math.max(0, (cart[id] || 0) + d) });
  const lines = prods.filter((p) => cart[p.id] > 0).map((p) => ({ id: p.id, name: p.name, price: p.price, qty: cart[p.id] }));
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const total = subtotal + (lines.length ? fee : 0);

  async function payOrder(orderId: string) {
    const { data, error } = await sb.functions.invoke('wompi-create-payment', { body: { order_id: orderId } });
    if (error || !data?.checkout_url) {
      let msg = error?.message || 'Intenta de nuevo desde Pedidos.';
      try { const j = await (error as any).context.json(); msg = j.error || msg; } catch {}
      Alert.alert('No se pudo abrir el pago', msg);
      return;
    }
    Linking.openURL(data.checkout_url);
  }
  async function order() {
    if (!lines.length) return Alert.alert('Elige al menos un producto', 'Toca el + de un producto para agregarlo.');
    if (!addr.trim()) return Alert.alert(noAddr ? 'Falta la referencia' : 'Falta tu dirección', noAddr ? 'Describe cómo llegar a tu ubicación (por ejemplo: casa azul, frente a la cancha).' : 'Escribe la dirección de entrega, o marca que tu lugar no tiene dirección.');
    setSending(true);
    try {
      const c = await getPos();
      if (!c) { Alert.alert('No pude ubicarte', 'Activa el GPS, da permiso de ubicación a Cerquita y vuelve a intentar.'); return; }
      const dest = (noAddr && pin) ? pin : c;
      const { data: nuevo, error } = await sb.from('orders').insert({ store_id: store.id, customer_id: me.id, items: lines, total, address: (noAddr ? 'Sin dirección: ' : '') + addr.trim(), dest_lat: dest.latitude, dest_lng: dest.longitude, payment_method: pay, dest_photo_path: lugarFoto?.path || null }).select('id').single();
      if (error) { say(error); return; }
      setStore(null); setCart({}); setAddr(''); setNoAddr(false); setPin(null); setLugarFoto(null); reload(); setTab('pedidos');
      if (pay === 'electronic' && nuevo) payOrder(nuevo.id); else Alert.alert('Pedido enviado', 'El comercio ya lo recibió.');
    } catch (e) { say(e); } finally { setSending(false); }
  }
  function cancelOrder(o: any) {
    Alert.alert('Cancelar pedido', '¿Seguro que quieres cancelarlo?', [{ text: 'No' }, { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
      const { error } = await sb.rpc('cancel_order', { p_order: o.id, p_reason: 'Cancelado por el cliente' });
      if (error) say(error); else Alert.alert('Pedido cancelado', o.payment_method === 'electronic' && o.status === 'pending' ? 'Tu pago será reembolsado.' : 'Listo.');
      reload();
    } }]);
  }
  async function sendClaim() {
    if (!cReason) return Alert.alert('Elige el problema', 'Selecciona qué pasó con tu pedido.');
    const { error } = await sb.rpc('create_claim', { p_order: claimFor.id, p_reason: cReason, p_description: cDesc.trim() || null });
    if (error) return say(error);
    setClaimFor(null); setCReason(''); setCDesc('');
    Alert.alert('Reclamo enviado', 'Lo revisaremos y verás aquí la respuesta.');
    loadAll();
  }
  async function sendReview() {
    if (!rs) return Alert.alert('Elige las estrellas', 'Califica el comercio de 1 a 5 estrellas.');
    const { error } = await sb.from('reviews').insert({ order_id: rate.id, customer_id: me.id, store_id: rate.store_id, courier_id: rate.courier_id, store_rating: rs, courier_rating: rc || null });
    if (error) return say(error);
    setRate(null); setRs(0); setRc(0);
    Alert.alert('¡Gracias!', 'Tu calificación quedó guardada.');
    loadAll();
  }

  const mine = orders.filter((o) => o.customer_id === me.id);
  const activos = mine.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const lista = stores.filter((st) => (!cat || catOf(st).k === cat) && (!q.trim() || (st.name + ' ' + (st.address || '')).toLowerCase().includes(q.trim().toLowerCase())));
  const favList = stores.filter((st) => favs.includes(st.id));
  const card = (st: any) => (
    <T key={st.id} style={[s.card, s.rowc]} onPress={() => open(st)}>
      <Foto uri={st.image_url} w={44} r={12} bg={catOf(st).c} icon={catOf(st).i} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.b}>{st.name}</Text>
        <Text numberOfLines={1} style={{ color: '#666' }}>{st.address}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: st.is_open === false ? '#D32F2F' : G }}>{st.is_open === false ? 'Cerrado' : 'Abierto'}  <Text style={{ color: '#666', fontWeight: '600' }}>{info(stats[st.id])}</Text></Text>
      </View>
      <T onPress={() => toggleFav(st)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ico n={favs.includes(st.id) ? 'heart' : 'heart-outline'} c={favs.includes(st.id) ? '#E8467C' : '#9AA7AF'} z={26} /></T>
    </T>
  );

  let body: any;
  if (store) body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <T onPress={() => setStore(null)} style={s.rowc}><Ico n="chevron-left" c={O} z={26} /><Text style={{ color: O, fontWeight: '700' }}>Volver</Text></T>
      <View style={[s.card, s.rowc, { marginTop: 8 }]}>
        <Foto uri={store.image_url} w={56} r={12} bg={catOf(store).c} icon={catOf(store).i} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.h, { marginBottom: 2 }]}>{store.name}</Text>
          <Text numberOfLines={1} style={{ color: '#666' }}>{catOf(store).t} • {store.address}</Text>
          <Text style={{ color: G, fontWeight: '700', fontSize: 12 }}>Abierto  <Text style={{ color: '#666', fontWeight: '600' }}>{info(stats[store.id])}</Text></Text>
        </View>
        <T onPress={() => toggleFav(store)}><Ico n={favs.includes(store.id) ? 'heart' : 'heart-outline'} c={favs.includes(store.id) ? '#E8467C' : '#9AA7AF'} z={28} /></T>
      </View>
      <Text style={s.h}>Productos</Text>
      {prods.map((p) => (
        <View key={p.id} style={[s.card, s.row]}>
          {!!p.image_url && <Foto uri={p.image_url} w={56} r={10} />}<View style={{ flex: 1, marginLeft: p.image_url ? 10 : 0 }}><Text style={s.b}>{p.name}</Text><Text style={{ color: G, fontWeight: '800' }}>{money(p.price)}</Text></View>
          {cart[p.id] > 0 ? (
            <View style={s.rowc}>
              <T onPress={() => setQty(p.id, -1)} style={s.qbtn}><Ico n="minus" c="#fff" z={20} /></T>
              <Text style={{ marginHorizontal: 10, fontWeight: '800', fontSize: 16 }}>{cart[p.id]}</Text>
              <T onPress={() => setQty(p.id, 1)} style={s.qbtn}><Ico n="plus" c="#fff" z={20} /></T>
            </View>
          ) : (
            <T onPress={() => setQty(p.id, 1)} style={s.qbtn}><Ico n="plus" c="#fff" z={20} /></T>
          )}
        </View>))}
      {!prods.length && <Text>Este comercio aún no tiene productos.</Text>}
      <View style={[s.card, { backgroundColor: '#E8F7EE', marginTop: 6 }]}>
        <Text style={s.b}>Tu pedido</Text>
        {lines.map((l) => <View key={l.id} style={s.row}><Text>{l.qty}x {l.name}</Text><Text>{money(l.price * l.qty)}</Text></View>)}
        {!lines.length && <Text>Aún no has elegido productos.</Text>}
        <View style={[s.row, { marginTop: 6 }]}><Text>Subtotal</Text><Text>{money(subtotal)}</Text></View>
        <View style={s.row}><Text>Domicilio</Text><Text>{money(lines.length ? fee : 0)}</Text></View>
        <View style={[s.row, { marginTop: 4 }]}><Text style={{ fontWeight: '900', color: N }}>Total a pagar</Text><Text style={{ fontWeight: '900', color: G, fontSize: 18 }}>{money(total)}</Text></View>
      </View>
      <Text style={[s.h, { marginTop: 4 }]}>Método de pago</Text>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        <T onPress={() => setPay('cash')} style={[s.chip2, { paddingVertical: 12, paddingHorizontal: 16 }, pay === 'cash' && { backgroundColor: G, borderColor: G }]}>
          <Text style={{ color: pay === 'cash' ? '#fff' : N, fontWeight: '800' }}>Efectivo</Text></T>
        <T onPress={() => setPay('electronic')} style={[s.chip2, { paddingVertical: 12, paddingHorizontal: 16 }, pay === 'electronic' && { backgroundColor: G, borderColor: G }]}>
          <Text style={{ color: pay === 'electronic' ? '#fff' : N, fontWeight: '800' }}>Pago electrónico</Text></T>
      </View>
      <Text style={{ color: '#666', fontSize: 12, marginBottom: 10 }}>{pay === 'electronic' ? 'Se abrirá la página segura de Wompi para pagar con tarjeta, PSE o Nequi.' : 'Pagas en efectivo al recibir tu pedido.'}</Text>
      <T onPress={() => { const v = !noAddr; setNoAddr(v); if (v && !pin) getPos().then((c) => c && setPin(c)); }} style={[s.rowc, { marginBottom: 8 }]}>
        <Ico n={noAddr ? 'checkbox-marked' : 'checkbox-blank-outline'} c={noAddr ? G : '#7A8A94'} z={24} />
        <Text style={{ marginLeft: 8, flex: 1 }}>Mi lugar no tiene dirección (sin nomenclatura)</Text>
      </T>
      <Inp placeholder={noAddr ? 'Cómo llegar (ej: casa azul, frente a la cancha)' : 'Tu dirección de entrega'} value={addr} onChangeText={setAddr} />
      {noAddr && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Toca el mapa o arrastra el pin hasta tu puerta. El repartidor verá este punto exacto.</Text>
          {!!pin && <Text style={{ color: '#888', fontSize: 11 }}>Punto marcado: {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</Text>}
          <T onPress={() => getPos().then((c) => c && setPin(c))} style={{ marginBottom: 6 }}><Text style={{ color: '#1E6BFF', fontWeight: '700' }}>Usar mi ubicación actual</Text></T>
          {pin ? (
            <MapView style={{ height: 220, borderRadius: 12 }} initialRegion={{ ...pin, latitudeDelta: 0.004, longitudeDelta: 0.004 }} onPress={(e: any) => setPin(e.nativeEvent.coordinate)}>
              <Marker draggable coordinate={pin} onDragEnd={(e: any) => setPin(e.nativeEvent.coordinate)} pinColor={G} title="Aquí entregamos" />
            </MapView>
          ) : <Text>Buscando tu ubicación…</Text>}
        </View>)}
      <View style={{ marginBottom: 10 }}>
        <T onPress={async () => { const f = await tomarFotoLugar(me.id); if (f) setLugarFoto(f); }} style={[s.chip2, { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }]}>
          <Ico n="camera-outline" c={N} z={18} /><Text style={{ marginLeft: 6, fontWeight: '700', color: N }}>{lugarFoto ? 'Cambiar foto del lugar' : (noAddr ? 'Tomar foto del lugar (recomendado)' : 'Agregar foto del lugar (opcional)')}</Text>
        </T>
        {!!lugarFoto && <Image source={{ uri: lugarFoto.uri }} style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 6 }} />}
        <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>La foto solo la ve el repartidor que lleva tu pedido. Ayuda a encontrar tu puerta.</Text>
      </View>
      <Btn t={sending ? 'Enviando…' : pay === 'electronic' ? 'Hacer pedido y pagar' : 'Hacer pedido'} on={sending ? () => {} : order} />
    </ScrollView>
  );
  else if (tab === 'inicio') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <View style={s.row}>
        <Logo k={0.8} />
        <View style={s.rowc}>
          <View style={{ marginRight: 8, maxWidth: 110 }}>
            <View style={s.rowc}><Ico n="map-marker" c={G} z={16} /><Text style={{ fontSize: 10, color: '#666', marginLeft: 2 }}>Mi ubicación</Text></View>
            <Text numberOfLines={1} style={{ fontWeight: '800', color: N, fontSize: 12 }}>{here}</Text>
          </View>
          <Bell n={activos} on={() => go('pedidos')} />
        </View>
      </View>
      <View style={s.search}>
        <Ico n="magnify" c="#7A8A94" z={22} />
        <TextInput style={{ flex: 1, marginLeft: 8 }} placeholder="¿Qué quieres pedir hoy?" placeholderTextColor="#8A98A1" value={q} onChangeText={setQ} />
      </View>
      <View style={s.grid}>
        {CATS.map((c) => (
          <T key={c.k} style={s.cat} onPress={() => c.k === 'mas' ? setMasOpen(!masOpen) : c.soon ? Alert.alert('Próximamente', `${c.t} llegará pronto a Cerquita.`) : setCat(cat === c.k ? '' : c.k)}>
            <View style={[s.catI, { backgroundColor: c.c }, cat === c.k && { borderWidth: 3, borderColor: N }]}><Ico n={c.i} c="#fff" z={28} /></View>
            <Text style={s.catT}>{c.t}</Text>
          </T>))}
      </View>
      {masOpen && (
        <View style={{ backgroundColor: '#F7F9FA', borderRadius: 16, padding: 12, marginBottom: 12 }}>
          <Text style={[s.b, { marginBottom: 8 }]}>Más categorías</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MAS.map((m) => (
              <T key={m.k} onPress={() => m.soon ? Alert.alert('Próximamente', `${m.t} llegará pronto a Cerquita.`) : (setCat(m.k), setMasOpen(false))} style={[s.chip2, { flexDirection: 'row', alignItems: 'center' }, cat === m.k && { backgroundColor: G, borderColor: G }]}>
                <Ico n={m.i} c={cat === m.k ? '#fff' : m.c} z={18} /><Text style={{ marginLeft: 6, color: cat === m.k ? '#fff' : N, fontWeight: '700', fontSize: 12 }}>{m.t}</Text>
              </T>))}
          </View>
        </View>)}
      <View style={{ backgroundColor: N, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Todo lo que necesitas</Text>
          <Text style={{ color: G, fontSize: 18, fontWeight: '900' }}>en un solo lugar</Text>
          <Text style={{ color: '#BFD3DD', fontSize: 11, marginTop: 6 }}>Rápido • Seguro • Cerca de ti</Text>
        </View>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: G, alignItems: 'center', justifyContent: 'center' }}><Ico n="moped" c="#fff" z={52} /></View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, marginHorizontal: 3, backgroundColor: i === 0 ? G : '#CBD5DA' }} />)}
      </View>
      {!!favList.length && <>
        <Text style={s.h}>Tus favoritos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {favList.map((st) => (
            <T key={st.id} onPress={() => open(st)} style={{ width: 140, marginRight: 10, backgroundColor: '#F7F9FA', borderRadius: 14, overflow: 'hidden' }}>
              <Foto uri={st.image_url} w={140} h={70} r={0} bg={catOf(st).c} icon={catOf(st).i} />
              <View style={{ padding: 10 }}>
                <Text numberOfLines={1} style={s.b}>{st.name}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>{info(stats[st.id])}</Text>
                <Text style={{ color: '#666', fontSize: 11 }}>{catOf(st).t}</Text>
              </View>
            </T>))}
        </ScrollView>
      </>}
      <Text style={s.h}>{cat ? catOf({ category: cat }).t : 'Comercios cerca de ti'}</Text>
      {!!cat && <T onPress={() => setCat('')}><Text style={{ color: O, fontWeight: '700', marginBottom: 8 }}>Quitar filtro ✕</Text></T>}
      {lista.map(card)}
      {!lista.length && <Text>No encontramos comercios con esa búsqueda.</Text>}
    </ScrollView>
  );
  else if (tab === 'pedidos') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Mis pedidos</Text>
      {rate && (
        <View style={[s.card, { backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: O }]}>
          <Text style={s.h}>Califica tu pedido</Text>
          <Text style={s.b}>{rate.stores?.name}</Text>
          <Stars v={rs} set={setRs} />
          {!!rate.courier_id && <><Text style={[s.b, { marginTop: 8 }]}>Tu repartidor</Text><Stars v={rc} set={setRc} /></>}
          <View style={{ flexDirection: 'row', marginTop: 10, marginHorizontal: -4 }}>
            <Btn2 t="Cancelar" c="#EDEDED" tc="#555" on={() => setRate(null)} />
            <Btn2 t="Enviar" on={sendReview} />
          </View>
        </View>)}
      {claimFor && (
        <View style={[s.card, { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#D32F2F' }]}>
          <Text style={s.h}>Reportar un problema</Text>
          <Text style={s.b}>{claimFor.stores?.name} · {shortId(claimFor.id)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {[['missing_item', 'Falta un producto'], ['bad_condition', 'Mal estado'], ['wrong_order', 'Pedido equivocado'], ['not_received', 'No me llegó'], ['other', 'Otro']].map(([k, t]) => (
              <T key={k} onPress={() => setCReason(k)} style={[s.chip2, cReason === k && { backgroundColor: '#D32F2F', borderColor: '#D32F2F' }]}><Text style={{ color: cReason === k ? '#fff' : N, fontWeight: '700' }}>{t}</Text></T>))}
          </View>
          <Inp placeholder="Cuéntanos qué pasó" value={cDesc} onChangeText={setCDesc} />
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <Btn2 t="Cancelar" c="#EDEDED" tc="#555" on={() => setClaimFor(null)} />
            <Btn2 t="Enviar" c="#D32F2F" on={sendClaim} />
          </View>
        </View>)}
      {!mine.length && <Text>Todavía no has hecho pedidos.</Text>}
      {mine.map((o) => (
        <View key={o.id} style={s.card}>
          <View style={s.row}><Text style={s.b}>{o.stores?.name}</Text><Text style={{ color: G, fontWeight: '900' }}>{money(o.total)}</Text></View>
          <Text style={{ color: '#555' }}>{itemsTxt(o.items)}</Text>
          <Text style={{ color: '#888', fontSize: 11 }}>{shortId(o.id)} · {ago(o.created_at)}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>Subtotal {money(o.subtotal ?? o.total)} + Domicilio {money(o.delivery_fee || 0)} · {o.payment_method === 'cash' ? 'Efectivo' : 'Pago electrónico'}</Text>
          <Track st={o.status} />
          {o.status === 'awaiting_payment' && <><Text style={{ color: '#E65100', fontWeight: '700', marginBottom: 4 }}>Esperando la confirmación de tu pago</Text><Btn t="Pagar ahora" on={() => payOrder(o.id)} /></>}
          {o.status === 'cancelled' && <Text style={{ color: '#D32F2F', fontWeight: '700' }}>Pedido cancelado{o.cancel_reason ? `: ${o.cancel_reason}` : ''}</Text>}
          {o.status === 'cancelled' && o.payment_method === 'electronic' && <Text style={{ color: '#666', fontSize: 12 }}>Si ya habías pagado, tu dinero se reembolsa. Cerquita procesa el reembolso.</Text>}
          {['awaiting_payment', 'pending'].includes(o.status) && <T onPress={() => cancelOrder(o)}><Text style={{ color: '#D32F2F', fontWeight: '700', marginTop: 6 }}>Cancelar pedido</Text></T>}
          {['preparing', 'ready', 'on_way'].includes(o.status) && <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Ya no se puede cancelar desde la app porque el comercio ya aceptó tu pedido.</Text>}
          {!['delivered', 'cancelled', 'awaiting_payment'].includes(o.status) && <OrderMap o={o} />}
          {o.status === 'delivered' && !reviewed.includes(o.id) && <Btn t="Calificar mi pedido" on={() => { setRate(o); setRs(0); setRc(0); }} />}
          {o.status === 'delivered' && (() => {
            const cl = claims.find((x) => x.order_id === o.id);
            if (cl) return <Text style={{ color: cl.status === 'OPEN' ? '#E65100' : cl.status === 'APPROVED' ? G : '#666', fontWeight: '700', marginTop: 4 }}>Reclamo: {cl.status === 'OPEN' ? 'en revisión' : cl.status === 'APPROVED' ? `aprobado, reembolso ${money(cl.refund_amount)}` : 'no aprobado'}</Text>;
            if (o.delivered_at && Date.now() - new Date(o.delivered_at).getTime() < 24 * 3600 * 1000) return <T onPress={() => { setClaimFor(o); setCReason(''); setCDesc(''); }}><Text style={{ color: '#D32F2F', fontWeight: '700', marginTop: 6 }}>Reportar un problema</Text></T>;
            return null;
          })()}
          {o.status === 'delivered' && reviewed.includes(o.id) && <Text style={{ color: G, fontWeight: '700', marginTop: 4 }}>✓ Ya calificaste este pedido</Text>}
        </View>))}
    </ScrollView>
  );
  else if (tab === 'favoritos') body = favList.length ? (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Tus favoritos</Text>
      {favList.map(card)}
    </ScrollView>
  ) : <Vacio i="heart-outline" t="Favoritos" d="Toca el corazón de un comercio para guardarlo aquí." />;
  else body = <Perfil me={me} email={email} />;
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}>{body}</View><TabBar tabs={CT} tab={tab} go={go} /></View>;
}