import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity as T, ScrollView, StyleSheet, Alert, Platform, Image, Linking, StatusBar as RNStatusBar } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { supabase as sb } from './supabase';

export const G = '#1DB954', N = '#0B2A3D', O = '#F26B21', B = '#1E6BFF', TEAL = '#0B3D3A';
export const TOP = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;
export const DEF = { latitude: 6.3373, longitude: -75.5579, latitudeDelta: 0.08, longitudeDelta: 0.08 };
export const LBL: any = { awaiting_payment: 'Esperando pago', cancelled: 'Cancelado', pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo para recoger', on_way: 'En camino', delivered: 'Entregado' };
export const CHIP: any = { awaiting_payment: ['#FFF3E0', '#E65100'], cancelled: ['#FDE2E2', '#D32F2F'], pending: ['#FFF3E0', '#E65100'], preparing: ['#FFF3E0', '#E65100'], ready: ['#E3F6EA', '#1B8A47'], on_way: ['#E3EEFF', '#1E6BFF'], delivered: ['#EDEDED', '#555555'] };
export const CATS: any[] = [
  { k: 'restaurantes', t: 'Restaurantes', i: 'silverware-fork-knife', c: '#F26B21' },
  { k: 'supermercados', t: 'Supermercados', i: 'cart', c: '#1DB954' },
  { k: 'farmacias', t: 'Farmacias', i: 'medical-bag', c: '#1E6BFF' },
  { k: 'envios', t: 'Envíos', i: 'package-variant-closed', c: '#F28C28', soon: true },
  { k: 'tiendas', t: 'Tiendas', i: 'storefront-outline', c: '#2D7FF9' },
  { k: 'transporte', t: 'Transporte', i: 'car', c: '#1DB954', soon: true },
  { k: 'mascotas', t: 'Mascotas', i: 'paw', c: '#E8467C' },
  { k: 'mas', t: 'Más', i: 'view-grid', c: '#6C4BD6', soon: true },
];
export const MAS: any[] = [
  { k: 'ropa', t: 'Ropa y moda', i: 'tshirt-crew', c: '#8E44AD' },
  { k: 'calzado', t: 'Calzado', i: 'shoe-sneaker', c: '#2D7FF9' },
  { k: 'belleza', t: 'Belleza y cosméticos', i: 'lipstick', c: '#E8467C' },
  { k: 'peluquerias', t: 'Peluquerías y barberías', i: 'content-cut', c: '#6C4BD6', soon: true },
  { k: 'florerias', t: 'Florerías', i: 'flower', c: '#E8467C' },
  { k: 'regalos', t: 'Regalos y detalles', i: 'gift', c: '#F26B21' },
  { k: 'tecnologia', t: 'Tecnología y celulares', i: 'cellphone', c: '#1E6BFF' },
  { k: 'ferreterias', t: 'Ferreterías', i: 'hammer-wrench', c: '#7A8A94' },
  { k: 'hogar', t: 'Hogar y decoración', i: 'sofa', c: '#B07D3A' },
  { k: 'jugueterias', t: 'Jugueterías', i: 'teddy-bear', c: '#F28C28' },
  { k: 'papelerias', t: 'Papelerías y librerías', i: 'book-open-variant', c: '#2D7FF9' },
  { k: 'panaderias', t: 'Panaderías y reposterías', i: 'bread-slice', c: '#C98A3B' },
  { k: 'heladerias', t: 'Heladerías', i: 'ice-cream', c: '#E8467C' },
  { k: 'cafeterias', t: 'Cafeterías', i: 'coffee', c: '#6D4C41' },
  { k: 'carnicerias', t: 'Carnicerías', i: 'food-steak', c: '#D32F2F' },
  { k: 'pescaderias', t: 'Pescaderías', i: 'fish', c: '#1E88E5' },
  { k: 'viveros', t: 'Viveros y plantas', i: 'sprout', c: '#1DB954' },
  { k: 'limpieza', t: 'Productos de limpieza', i: 'spray-bottle', c: '#26A69A' },
  { k: 'bebes', t: 'Productos para bebés', i: 'baby-bottle-outline', c: '#F48FB1' },
  { k: 'vehiculos', t: 'Accesorios para vehículos', i: 'car-wrench', c: '#455A64' },
  { k: 'deportes', t: 'Deportes y ejercicio', i: 'dumbbell', c: '#E53935' },
  { k: 'videojuegos', t: 'Videojuegos', i: 'controller-classic', c: '#6C4BD6' },
  { k: 'servicios_hogar', t: 'Servicios para el hogar', i: 'tools', c: '#7A8A94', soon: true },
];
export const CT = [{ k: 'inicio', t: 'Inicio', i: 'home' }, { k: 'pedidos', t: 'Pedidos', i: 'shopping-outline' }, { k: 'favoritos', t: 'Favoritos', i: 'heart-outline' }, { k: 'perfil', t: 'Perfil', i: 'account-outline' }];
export const MT = [{ k: 'inicio', t: 'Inicio', i: 'home' }, { k: 'pedidos', t: 'Pedidos', i: 'shopping-outline' }, { k: 'productos', t: 'Productos', i: 'storefront-outline' }, { k: 'stats', t: 'Estadísticas', i: 'chart-bar' }, { k: 'perfil', t: 'Perfil', i: 'account-outline' }];
export const RT = [{ k: 'pedidos', t: 'Pedidos', i: 'shopping-outline' }, { k: 'mapa', t: 'Mapa', i: 'map-outline' }, { k: 'ganancias', t: 'Ganancias', i: 'cash' }, { k: 'perfil', t: 'Perfil', i: 'account-outline' }];

export const AT = [{ k: 'resumen', t: 'Resumen', i: 'view-dashboard-outline' }, { k: 'liquidar', t: 'Liquidar', i: 'cash-multiple' }, { k: 'liquidaciones', t: 'Historial', i: 'file-document-outline' }, { k: 'auditoria', t: 'Auditoría', i: 'shield-check-outline' }, { k: 'reclamos', t: 'Reclamos', i: 'alert-circle-outline' }, { k: 'ajustes', t: 'Ajustes', i: 'cog-outline' }];
export const URL_WEB = 'https://proasechdc-art.github.io/cerquita-web/';
export const TERMS_VERSION = '2026-10';
export const abrirWeb = (p: string) => Linking.openURL(URL_WEB + p);
export const money = (n: number) => '$' + Number(n).toLocaleString('es-CO');
export const say = (e: any) => Alert.alert('Ups', String(e?.message || e));
export const shortId = (id: string) => '#' + id.slice(0, 4).toUpperCase();
export const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
export const ago = (d: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)); return m < 60 ? `Hace ${m} min` : m < 1440 ? `Hace ${Math.round(m / 60)} h` : `Hace ${Math.round(m / 1440)} d`; };
export const catOf = (st: any) => [...CATS, ...MAS].find((c) => c.k === (st?.category || 'restaurantes')) || CATS[0];
export const itemsTxt = (items: any[]) => { const m: any = {}; (items || []).forEach((i: any) => { m[i.name] = (m[i.name] || 0) + (i.qty || 1); }); return Object.entries(m).map(([k, v]) => `${v}x ${k}`).join(', '); };
export const info = (x: any) => { const p: string[] = []; if (x?.rating) p.push(`★ ${x.rating}`); if (x?.avg_minutes) p.push(`~${x.avg_minutes} min`); return p.length ? p.join(' · ') : 'Nuevo'; };
export const km = (a: any, b: any) => {
  const r = (x: number) => (x * Math.PI) / 180, dLa = r(b.latitude - a.latitude), dLo = r(b.longitude - a.longitude);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export async function getPos() {
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

export function useOrders(): [any[], () => Promise<void>] {
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

// Elige una foto de la galería, la sube a Supabase (carpeta propia) y devuelve su dirección pública
export async function subirFoto(uid: string, aspect: [number, number] = [1, 1]): Promise<string | null> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.5, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return null;
    const bytes = Uint8Array.from(atob(r.assets[0].base64), (c) => c.charCodeAt(0));
    const path = `${uid}/${Date.now()}.jpg`;
    const { error } = await sb.storage.from('fotos').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) { say(error); return null; }
    return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  } catch (e) { say(e); return null; }
}
// Abre la cámara, sube la foto del lugar a un almacenamiento privado y devuelve su ruta
export async function tomarFotoLugar(uid: string): Promise<{ path: string; uri: string } | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso necesario', 'Permite el uso de la cámara para tomar la foto del lugar.'); return null; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.4, base64: true });
    if (r.canceled || !r.assets?.[0]?.base64) return null;
    const a = r.assets[0];
    const bytes = Uint8Array.from(atob(a.base64 as string), (c) => c.charCodeAt(0));
    const path = `${uid}/${Date.now()}.jpg`;
    const { error } = await sb.storage.from('entregas').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) { say(error); return null; }
    return { path, uri: a.uri };
  } catch (e) { say(e); return null; }
}
export const Foto = ({ uri, w = 44, h, r = 12, bg = '#E5E9EC', icon = 'storefront-outline', ic = '#fff' }: any) => (
  uri
    ? <Image source={{ uri }} style={{ width: w, height: h || w, borderRadius: r, backgroundColor: '#EEE' }} />
    : <View style={{ width: w, height: h || w, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ico n={icon} c={ic} z={Math.round(w * 0.5)} /></View>
);
export const Ico = ({ n, c = N, z = 24 }: any) => <MCI name={n} size={z} color={c} />;
export const Chip = ({ st }: any) => <View style={{ backgroundColor: CHIP[st][0], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' }}><Text style={{ color: CHIP[st][1], fontWeight: '800', fontSize: 12 }}>{LBL[st]}</Text></View>;
export const Btn = ({ t, on, c = G }: any) => <T style={[s.btn, { backgroundColor: c }]} onPress={on}><Text style={s.btnT}>{t}</Text></T>;
export const Btn2 = ({ t, on, c = G, tc = '#fff' }: any) => <T style={{ flex: 1, backgroundColor: c, borderRadius: 12, padding: 14, alignItems: 'center', marginHorizontal: 4 }} onPress={on}><Text style={{ color: tc, fontWeight: '800', fontSize: 16 }}>{t}</Text></T>;
export const Inp = (p: any) => <TextInput placeholderTextColor="#999" autoCapitalize="none" {...p} style={s.input} />;
export const Vacio = ({ i, t, d }: any) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}><Ico n={i} c="#B8C4CB" z={56} /><Text style={[s.h, { marginTop: 12, marginBottom: 4 }]}>{t}</Text><Text style={{ color: '#666', textAlign: 'center' }}>{d}</Text></View>;
export const Stat = ({ i, c, v, l }: any) => <View style={s.stat}><Ico n={i} c={c} z={26} /><View style={{ marginLeft: 10 }}><Text style={{ fontSize: 20, fontWeight: '900', color: N }}>{v}</Text><Text style={{ color: '#666', fontSize: 12 }}>{l}</Text></View></View>;

export function Logo({ light = false, k = 1 }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 46 * k, height: 46 * k, borderRadius: 23 * k, backgroundColor: G, alignItems: 'center', justifyContent: 'center', marginTop: 8 * k }}>
        <Ico n="moped" c="#fff" z={28 * k} />
        <View style={{ position: 'absolute', top: -14 * k, left: 10 * k }}><Ico n="map-marker" c={O} z={22 * k} /></View>
      </View>
      <View style={{ marginLeft: 6 * k }}>
        <Text style={{ fontSize: 26 * k, fontWeight: '900', fontStyle: 'italic', color: light ? '#fff' : N }}>Cer<Text style={{ color: G }}>quita</Text></Text>
        <Text style={{ fontSize: 9.5 * k, fontStyle: 'italic', color: light ? '#BFE9CF' : '#4B6575', marginTop: -3 }}>Tu antojo, en camino</Text>
      </View>
    </View>
  );
}

export const Bell = ({ n, on, dark }: any) => (
  <T onPress={on} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: dark ? 'rgba(255,255,255,0.14)' : '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: dark ? 0 : 1, borderColor: '#E5E9EC' }}>
    <Ico n="bell-outline" c={dark ? '#fff' : N} z={22} />
    {n > 0 && <View style={s.badge}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{n}</Text></View>}
  </T>
);

export function TabBar({ tabs, tab, go }: any) {
  return (
    <View style={s.tabbar}>
      {tabs.map((t: any) => (
        <T key={t.k} style={s.tabi} onPress={() => go(t.k)}>
          <Ico n={t.i} c={tab === t.k ? G : '#7A8A94'} z={24} />
          <Text style={{ fontSize: 11, marginTop: 2, fontWeight: tab === t.k ? '800' : '500', color: tab === t.k ? G : '#7A8A94' }}>{t.t}</Text>
        </T>))}
    </View>
  );
}

async function borrarArchivos(uid: string) {
  for (const b of ['fotos', 'entregas']) {
    try {
      const { data } = await sb.storage.from(b).list(uid, { limit: 1000 });
      if (data?.length) await sb.storage.from(b).remove(data.map((f: any) => `${uid}/${f.name}`));
    } catch {}
  }
}
export function Perfil({ me, email }: any) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <View style={s.avatar}><Ico n="account" c="#fff" z={40} /></View>
        <Text style={[s.h, { marginTop: 10, marginBottom: 2 }]}>{me.name || 'Mi cuenta'}</Text>
        <Text style={{ color: '#555' }}>{email}</Text>
        <Text style={{ color: O, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' }}>{me.role}</Text>
      </View>
      <View style={{ marginBottom: 14 }}>
        <T onPress={() => abrirWeb('privacidad.html')} style={{ paddingVertical: 8 }}><Text style={{ color: '#1E6BFF', fontWeight: '700' }}>Política de privacidad</Text></T>
        <T onPress={() => abrirWeb('terminos.html')} style={{ paddingVertical: 8 }}><Text style={{ color: '#1E6BFF', fontWeight: '700' }}>Términos y condiciones</Text></T>
        <T onPress={() => abrirWeb('eliminar-cuenta.html')} style={{ paddingVertical: 8 }}><Text style={{ color: '#1E6BFF', fontWeight: '700' }}>Cómo eliminar mi cuenta</Text></T>
      </View>
      <Btn t="Cerrar sesión" on={() => sb.auth.signOut()} c={O} />
      <T style={{ marginTop: 18, alignItems: 'center' }} onPress={() => Alert.alert('Eliminar mi cuenta', 'Se borrarán tus datos personales y no podrás volver a entrar con esta cuenta. Los registros de pedidos y pagos se conservan sin tu nombre. ¿Quieres continuar?', [
        { text: 'No' },
        { text: 'Sí, eliminar', style: 'destructive', onPress: async () => {
          const { error } = await sb.rpc('delete_my_account');
          if (error) say(error); else { await borrarArchivos(me.id); Alert.alert('Cuenta eliminada', 'Tu cuenta fue eliminada.'); sb.auth.signOut(); }
        } }])}>
        <Text style={{ color: '#D32F2F', fontWeight: '700' }}>Eliminar mi cuenta</Text>
      </T>
    </ScrollView>
  );
}

export const Stars = ({ v, set }: any) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((i) => <T key={i} onPress={() => set(i)}><Ico n={i <= v ? 'star' : 'star-outline'} c={O} z={36} /></T>)}
  </View>
);

const STEPS = ['pending', 'preparing', 'ready', 'on_way', 'delivered'];
const STEP_L = ['Recibido', 'Preparando', 'Listo', 'En camino', 'Entregado'];
export const Track = ({ st }: any) => {
  const cur = STEPS.indexOf(st);
  return (
    <View style={{ flexDirection: 'row', marginVertical: 8 }}>
      {STEPS.map((k, i) => (
        <View key={k} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : i <= cur ? G : '#D5DDE2' }} />
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: i <= cur ? G : '#D5DDE2', alignItems: 'center', justifyContent: 'center' }}>{i <= cur && <Ico n="check" c="#fff" z={13} />}</View>
            <View style={{ flex: 1, height: 3, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < cur ? G : '#D5DDE2' }} />
          </View>
          <Text style={{ fontSize: 9.5, marginTop: 3, color: i <= cur ? N : '#8A98A1', fontWeight: i === cur ? '800' : '500' }}>{STEP_L[i]}</Text>
        </View>))}
    </View>
  );
};

export function OrderMap({ o }: any) {
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

export const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowc: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#F1F3F4', width: '100%', borderRadius: 12, padding: 14, marginBottom: 10 },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center', width: '100%', marginTop: 6 }, btnT: { color: '#fff', fontWeight: '800', fontSize: 16 },
  chip: { backgroundColor: '#3A5568', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginHorizontal: 4 },
  chip2: { borderWidth: 1, borderColor: '#CBD5DA', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 6, marginBottom: 6 },
  h: { fontSize: 20, fontWeight: '900', color: N, marginBottom: 8 }, b: { fontWeight: '700', marginBottom: 4 },
  card: { backgroundColor: '#F7F9FA', borderRadius: 14, padding: 14, marginBottom: 10 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F3F4', borderRadius: 14, paddingHorizontal: 14, height: 48, marginVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  cat: { width: '25%', alignItems: 'center', marginBottom: 12 },
  catI: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catT: { fontSize: 11, color: N, marginTop: 5, fontWeight: '600', textAlign: 'center' },
  tabbar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#E5E9EC', paddingTop: 8, paddingBottom: 8 },
  tabi: { flex: 1, alignItems: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: O, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  stat: { width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E9EC', marginBottom: 10 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  avatarS: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 22, paddingLeft: 4, paddingRight: 12, borderWidth: 1, borderColor: '#E5E9EC' },
  big: { fontSize: 22, fontWeight: '900', color: N }, small: { color: '#666', fontSize: 12 },
  qbtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
});