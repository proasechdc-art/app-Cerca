import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity as T, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase as sb } from './src/supabase';
import { s, G, N, O, TOP, say, Logo, Btn, Inp } from './src/ui';
import { Cliente } from './src/Cliente';
import { Comercio } from './src/Comercio';
import { Repartidor } from './src/Repartidor';
import { Admin } from './src/Admin';

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
      <View style={{ marginBottom: 28 }}><Logo light k={1.5} /></View>
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
  if (!ready) return <View style={[s.center, { backgroundColor: N }]}><Logo light k={1.5} /></View>;
  if (!session) return <Auth />;
  if (!me) return (
    <SafeAreaView style={[s.center, { backgroundColor: N }]}>
      <Logo light k={1.5} />
      <Text style={{ color: '#fff', marginVertical: 16, textAlign: 'center' }}>{perr || 'Cargando tu perfil…'}</Text>
      {!!perr && <Btn t="Salir" on={() => sb.auth.signOut()} c={O} />}
    </SafeAreaView>
  );
  const View_ = me.role === 'cliente' ? Cliente : me.role === 'comercio' ? Comercio : me.role === 'admin' ? Admin : Repartidor;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: TOP }}>
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

export default function App() { return <ErrorBoundary><Root /></ErrorBoundary>; }