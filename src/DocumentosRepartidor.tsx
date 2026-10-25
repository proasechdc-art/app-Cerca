import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity as T, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase as sb } from './supabase';
import { s, G, N, O, B, say, abrirWeb, Ico, Btn, Inp, Perfil } from './ui';
import { Repartidor } from './Repartidor';

const fmt = (d?: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return new Date(d).toLocaleString(); }
};
// DD/MM/AAAA -> AAAA-MM-DD (o null si la fecha no es válida)
const isoDate = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((t || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1] ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const showDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

// Deja pasar a la pantalla normal solo a los repartidores aprobados
export function RepartidorConPermiso({ me, email }: any) {
  const [app, setApp] = useState<any>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('docs');
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('my_courier_application');
    if (error) setErr(error.message); else { setErr(''); setApp(data); }
  }, []);
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (app?.status !== 'pending_review') return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [app?.status]);

  if (app?.status === 'approved') return <Repartidor me={me} email={email} />;
  if (!app) return (
    <View style={[s.center, { padding: 24 }]}>
      <Text style={{ textAlign: 'center', marginBottom: 16, color: '#444' }}>{err || 'Cargando tu solicitud…'}</Text>
      {!!err && <Btn t="Reintentar" on={load} />}
      {!!err && <View style={{ height: 8 }} />}
      {!!err && <Btn t="Salir" on={() => sb.auth.signOut()} c={O} />}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', padding: 12 }}>
        {[['docs', 'Documentos'], ['cuenta', 'Mi cuenta']].map(([k, t]) => (
          <T key={k} onPress={() => setTab(k)} style={[s.chip, { backgroundColor: tab === k ? G : '#E5E9EC' }]}>
            <Text style={{ color: tab === k ? '#fff' : N, fontWeight: '700' }}>{t}</Text>
          </T>
        ))}
      </View>
      {tab === 'cuenta' ? <Perfil me={me} email={email} /> : <Docs app={app} me={me} reload={load} />}
    </View>
  );
}

function Docs({ app, me, reload }: any) {
  const [busy, setBusy] = useState('');
  const [dates, setDates] = useState<any>({});
  const [ok, setOk] = useState(false);
  const editable = app.status === 'draft' || app.status === 'rejected';

  async function subir(d: any, fuente: 'camara' | 'galeria') {
    try {
      const exp = d.requires_expiry ? isoDate(dates[d.type_id] ?? showDate(d.doc?.expires_on)) : null;
      if (d.requires_expiry && !exp) return Alert.alert('Falta la fecha', 'Escribe la fecha de vencimiento con el formato DD/MM/AAAA.');
      const opts: any = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: false };
      let r: any;
      if (fuente === 'camara') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) return Alert.alert('Permiso necesario', 'Permite el uso de la cámara para tomar la foto.');
        r = await ImagePicker.launchCameraAsync({ ...opts, cameraType: d.kind === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back });
      } else r = await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets?.[0]?.base64) return;
      setBusy(d.type_id);
      const bytes = Uint8Array.from(atob(r.assets[0].base64), (c) => c.charCodeAt(0));
      const path = `${me.id}/${d.code}-${Date.now()}.jpg`;
      const up = await sb.storage.from('documentos').upload(path, bytes, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const sv = await sb.rpc('save_courier_document', { p_type: d.type_id, p_path: path, p_expires: exp });
      if (sv.error) { await sb.storage.from('documentos').remove([path]); throw sv.error; }
      if (d.doc?.path) await sb.storage.from('documentos').remove([d.doc.path]);
      await reload();
    } catch (e) { say(e); } finally { setBusy(''); }
  }

  async function enviar() {
    if (!ok) return Alert.alert('Autorización', 'Debes autorizar el tratamiento de tus datos para continuar.');
    const { error } = await sb.rpc('submit_courier_application', { p_consent: true });
    if (error) return say(error);
    reload();
  }

  const aviso = app.status === 'pending_review'
    ? { c: '#E3EEFF', t: B, m: `Tu solicitud está en revisión. Te responderemos antes de ${fmt(app.due_at)} (máximo 24 horas).` }
    : app.status === 'rejected'
      ? { c: '#FDE2E2', t: '#D32F2F', m: `Tu solicitud fue rechazada: ${app.rejection_reason || 'revisa los documentos marcados'}. Corrígelos y envíala de nuevo.` }
      : { c: '#FFF3E0', t: '#E65100', m: 'Sube tus documentos para empezar a recibir pedidos. Un administrador los revisará en máximo 24 horas.' };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h}>Verificación de repartidor</Text>
      <View style={{ backgroundColor: aviso.c, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <Text style={{ color: aviso.t, fontWeight: '700' }}>{aviso.m}</Text>
      </View>
      {app.documents.map((d: any) => {
        const st = d.doc?.status;
        const [txt, col] = !d.doc ? ['Pendiente', '#E65100'] : st === 'approved' ? ['Aprobado', '#1B8A47'] : st === 'rejected' ? ['Rechazado', '#D32F2F'] : ['Subido', B];
        return (
          <View key={d.type_id} style={[s.card, { marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontWeight: '800', color: N }}>{d.name}{d.required ? ' *' : ''}</Text>
              <Text style={{ color: col, fontWeight: '800' }}>{txt}</Text>
            </View>
            {!!d.description && <Text style={{ color: '#666', marginTop: 4 }}>{d.description}</Text>}
            {st === 'rejected' && !!d.doc?.reject_reason && <Text style={{ color: '#D32F2F', marginTop: 4 }}>Motivo: {d.doc.reject_reason}</Text>}
            {d.requires_expiry && (editable
              ? <Inp placeholder="Vence (DD/MM/AAAA)" keyboardType="numbers-and-punctuation" value={dates[d.type_id] ?? showDate(d.doc?.expires_on)} onChangeText={(v: string) => setDates({ ...dates, [d.type_id]: v })} />
              : !!d.doc?.expires_on && <Text style={{ marginTop: 4, color: '#444' }}>Vence: {showDate(d.doc.expires_on)}</Text>)}
            {editable && (busy === d.type_id
              ? <Text style={{ marginTop: 8, color: '#666' }}>Subiendo…</Text>
              : (
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <T onPress={() => subir(d, 'camara')} style={[s.chip, { backgroundColor: G }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{d.kind === 'selfie' ? 'Tomar selfie' : 'Tomar foto'}</Text></T>
                  <T onPress={() => subir(d, 'galeria')} style={[s.chip, { backgroundColor: N }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Elegir de la galería</Text></T>
                </View>
              ))}
          </View>
        );
      })}
      {editable && (
        <View style={{ marginTop: 6 }}>
          <T onPress={() => setOk(!ok)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ico n={ok ? 'checkbox-marked' : 'checkbox-blank-outline'} c={G} z={26} />
            <Text style={{ flex: 1, marginLeft: 8, color: '#333' }}>Autorizo a Cerquita a tratar mis datos personales y documentos para verificar mi identidad y mi vehículo.</Text>
          </T>
          <T onPress={() => abrirWeb('privacidad.html')} style={{ paddingVertical: 6 }}><Text style={{ color: B, fontWeight: '700' }}>Ver política de privacidad</Text></T>
          <Btn t="Enviar solicitud" on={enviar} />
        </View>
      )}
      {!editable && <Btn t="Actualizar estado" on={reload} />}
    </ScrollView>
  );
}
