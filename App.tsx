import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity as T, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase as sb } from './src/supabase';
import { s, G, N, O, TOP, say, Logo, Btn, Inp, Ico, TERMS_VERSION, abrirWeb } from './src/ui';
import { Cliente } from './src/Cliente';
import { Comercio } from './src/Comercio';
import { RepartidorConPermiso as Repartidor } from './src/DocumentosRepartidor';
import { Admin } from './src/Admin';

function Auth() {
  const [signup, setSignup] = useState(false);
  const [role, setRole] = useState('cliente');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false);
  async function go() {
    if (signup && !ok) return say('Debes aceptar los términos y la política de privacidad para crear tu cuenta.');
    const r = signup ? await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { role, name, terms_version: TERMS_VERSION } } })
                     : await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (r.error) say(r.error);
  }
  return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <StatusBar style="light" />
      <View style={{ marginBottom: 28 }}><Logo light k={1.5} /></View>
      {signup && <>
        <Inp placeholder="Nombre" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {['cliente', 'comercio', 'repartidor'].map((r) => (
            <T key={r} onPress={() => setRole(r)} style={[s.chip, role === r && { backgroundColor: G }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{r}</Text></T>))}
        </View></>}
      <Inp placeholder="Correo" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Inp placeholder="Contraseña" secureTextEntry value={pw} onChangeText={setPw} />
      {signup && (
        <View style={{ width: '100%', marginBottom: 10 }}>
          <T onPress={() => setOk(!ok)} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ico n={ok ? 'checkbox-marked' : 'checkbox-blank-outline'} c={ok ? G : '#9FB3BF'} z={24} />
            <Text style={{ color: '#fff', marginLeft: 8, flex: 1, fontSize: 12 }}>Soy mayor de 18 años y acepto los términos y condiciones y la política de privacidad y tratamiento de datos.</Text>
          </T>
          <View style={{ flexDirection: 'row', marginLeft: 32, marginTop: 4 }}>
            <T onPress={() => abrirWeb('terminos.html')}><Text style={{ color: '#7FD6A3', fontSize: 12, textDecorationLine: 'underline', marginRight: 14 }}>Ver términos</Text></T>
            <T onPress={() => abrirWeb('privacidad.html')}><Text style={{ color: '#7FD6A3', fontSize: 12, textDecorationLine: 'underline' }}>Ver política de privacidad</Text></T>
          </View>
        </View>)}
      <Btn t={signup ? 'Crear cuenta' : 'Entrar'} on={go} />
      <T onPress={() => setSignup(!signup)}><Text style={{ color: '#fff', marginTop: 16 }}>{signup ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}</Text></T>
    </SafeAreaView>
  );
}

function Consent({ onOk }: any) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function aceptar() {
    setBusy(true);
    const { error } = await sb.rpc('accept_terms', { p_version: TERMS_VERSION });
    setBusy(false);
    if (error) return say(error);
    onOk();
  }
  return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <Logo light k={1.3} />
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 24, textAlign: 'center' }}>Antes de continuar</Text>
      <Text style={{ color: '#D5E6EE', textAlign: 'center', marginVertical: 10 }}>Para usar Cerquita necesitamos que aceptes los términos y condiciones y la política de privacidad y tratamiento de datos.</Text>
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <T onPress={() => abrirWeb('terminos.html')}><Text style={{ color: '#7FD6A3', textDecorationLine: 'underline', marginRight: 16 }}>Ver términos</Text></T>
        <T onPress={() => abrirWeb('privacidad.html')}><Text style={{ color: '#7FD6A3', textDecorationLine: 'underline' }}>Ver política de privacidad</Text></T>
      </View>
      <T onPress={() => setOk(!ok)} style={{ flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginBottom: 12 }}>
        <Ico n={ok ? 'checkbox-marked' : 'checkbox-blank-outline'} c={ok ? G : '#9FB3BF'} z={24} />
        <Text style={{ color: '#fff', marginLeft: 8, flex: 1 }}>Soy mayor de 18 años y acepto los términos y la política.</Text>
      </T>
      <Btn t={busy ? 'Guardando…' : 'Aceptar y continuar'} on={() => (ok ? aceptar() : say('Marca la casilla para continuar.'))} />
      <T onPress={() => sb.auth.signOut()}><Text style={{ color: '#fff', marginTop: 16 }}>Cerrar sesión</Text></T>
    </SafeAreaView>
  );
}

function Root() {
  const [session, setSession] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const ins = useSafeAreaInsets();
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
  if (!ready) return <View style={[s.center, { backgroundColor: N }]}><Logo light k={1.5} /></View>;
  if (!session) return <Auth />;
  if (!me) return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <Logo light k={1.5} />
      <Text style={{ color: '#fff', marginVertical: 16, textAlign: 'center' }}>{perr || 'Cargando tu perfil…'}</Text>
      {!!perr && <Btn t="Salir" on={() => sb.auth.signOut()} c={O} />}
    </SafeAreaView>
  );
  if (me.terms_version !== TERMS_VERSION) return <Consent onOk={() => setMe({ ...me, terms_version: TERMS_VERSION })} />;
  const View_ = me.role === 'cliente' ? Cliente : me.role === 'comercio' ? Comercio : me.role === 'admin' ? Admin : Repartidor;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: Math.max(TOP, ins.top), paddingBottom: ins.bottom }}>
      <StatusBar style="dark" />
      <View_ me={me} email={session.user.email} />
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component<any, { err: any }> {
  state = { err: null as any };
  static getDerivedStateFromError(err: any) { return { err }; }
  render() {
    if (this.state.err) return (
      <SafeAreaView style={[s.center, { backgroundColor: N }]}>
        <Logo light k={1.5} />
        <Text style={{ color: '#fff', marginVertical: 16, textAlign: 'center' }}>Ocurrió un error: {String(this.state.err?.message || this.state.err)}</Text>
        <Btn t="Reintentar" on={() => this.setState({ err: null })} />
      </SafeAreaView>
    );
    return this.props.children;
  }
}

export default function App() { return <SafeAreaProvider><ErrorBoundary><Root /></ErrorBoundary></SafeAreaProvider>; }