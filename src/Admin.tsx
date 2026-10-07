import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { supabase as sb } from './supabase';
import { s, G, N, O, AT, money, say, ago, Btn, Btn2, Inp, Stat, Logo, TabBar } from './ui';

export function Admin({ me, email }: any) {
  const [tab, setTab] = useState('resumen');
  const [sum, setSum] = useState<any>(null);
  const [pend, setPend] = useState<any[]>([]);
  const [setts, setSetts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [com, setCom] = useState('');
  const [fee, setFee] = useState('');
  const [ref, setRef] = useState('');
  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      sb.rpc('admin_summary'), sb.rpc('admin_pending'), sb.rpc('admin_settlements'),
      sb.from('audit_log').select('*').order('id', { ascending: false }).limit(40),
      sb.from('finance_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setSum(a.data); setPend(b.data || []); setSetts(c.data || []); setLogs(d.data || []);
    if (e.data) { setCom(String(e.data.commission_pct)); setFee(String(e.data.courier_fee)); }
  }, []);
  useEffect(() => { load(); }, [tab]);
  const run = async (p: any, ok: string) => { const { error } = await p; if (error) say(error); else Alert.alert('Listo', ok); load(); };
  const sure = (t: string, f: () => void) => Alert.alert(t, '¿Confirmas?', [{ text: 'No' }, { text: 'Sí', onPress: f }]);
  const who = (x: any) => x.name?.trim() || x.email;
  let body: any;
  if (tab === 'resumen') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Resumen financiero</Text>
      {!sum && <Text>Cargando… (si no carga, esta cuenta no es administradora)</Text>}
      {!!sum && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat i="cash-multiple" c={G} v={money(sum.cerquita_revenue)} l="Ingresos Cerquita" />
        <Stat i="shopping-outline" c={O} v={money(sum.sales_total)} l="Ventas totales" />
        <Stat i="check-circle-outline" c={G} v={sum.orders_delivered} l="Pedidos entregados" />
        <Stat i="hand-coin-outline" c={O} v={money(sum.cash_pending)} l="Efectivo en la calle" />
        <Stat i="moped" c={G} v={money(sum.couriers_pending)} l="Por pagar repartidores" />
        <Stat i="storefront-outline" c={G} v={money(sum.merchants_pending)} l="Por pagar comercios" />
      </View>}
      <Text style={{ color: '#666', fontSize: 12 }}>Los pedidos anteriores al módulo financiero no tienen movimientos y no se incluyen en lo pendiente.</Text>
    </ScrollView>
  );
  else if (tab === 'liquidar') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Pendiente por liquidar</Text>
      {!pend.length && <Text>No hay movimientos pendientes.</Text>}
      {pend.map((p) => {
        const rep = p.role === 'repartidor';
        const neto = rep ? Number(p.earnings_pending) - Number(p.cash_pending) : Number(p.merchant_pending);
        return (
          <View key={p.party_id} style={s.card}>
            <Text style={s.b}>{who(p)} · {rep ? 'Repartidor' : 'Comercio'}</Text>
            {rep ? <>
              <View style={s.row}><Text>Ganancias</Text><Text>{money(p.earnings_pending)}</Text></View>
              <View style={s.row}><Text>Efectivo pendiente</Text><Text>- {money(p.cash_pending)}</Text></View>
            </> : <View style={s.row}><Text>Ventas menos comisión</Text><Text>{money(p.merchant_pending)}</Text></View>}
            <View style={[s.row, { marginTop: 4 }]}><Text style={{ fontWeight: '900', color: N }}>{neto >= 0 ? 'Cerquita paga' : 'El repartidor debe'}</Text><Text style={{ fontWeight: '900', color: neto >= 0 ? G : '#D32F2F' }}>{money(Math.abs(neto))}</Text></View>
            <Btn t="Crear liquidación" on={() => sure('Crear liquidación', () => run(sb.rpc('create_settlement', { p_party: p.party_id, p_type: rep ? 'courier' : 'merchant' }), 'Liquidación creada'))} />
          </View>);
      })}
    </ScrollView>
  );
  else if (tab === 'liquidaciones') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>Liquidaciones</Text>
      <Inp placeholder="Referencia del pago (comprobante, opcional)" value={ref} onChangeText={setRef} />
      {!setts.length && <Text>Aún no hay liquidaciones.</Text>}
      {setts.map((x) => (
        <View key={x.id} style={s.card}>
          <View style={s.row}><Text style={s.b}>{who(x)} · {x.party_type === 'courier' ? 'Repartidor' : 'Comercio'}</Text><Text style={{ fontWeight: '800', color: x.status === 'PAGADA' ? G : O }}>{x.status}</Text></View>
          <Text>Ganancias/ventas {money(x.gross_amount)} - efectivo {money(x.cash_applied)} = neto {money(x.net_amount)}</Text>
          <Text style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>{ago(x.created_at)}</Text>
          {x.status === 'CALCULADA' && <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
            <Btn2 t="Cancelar" c="#FDE2E2" tc="#D32F2F" on={() => sure('Cancelar liquidación', () => run(sb.rpc('cancel_settlement', { p_id: x.id }), 'Liquidación cancelada'))} />
            <Btn2 t="Aprobar" on={() => sure('Aprobar liquidación', () => run(sb.rpc('approve_settlement', { p_id: x.id }), 'Liquidación aprobada'))} />
          </View>}
          {x.status === 'APROBADA' && x.payout_status === 'PENDING' && <Btn t="Ya pagué: confirmar pago" on={() => sure('Confirmar que el pago se hizo', () => run(sb.rpc('confirm_payout', { p_payout: x.payout_id, p_ref: ref.trim() || 'manual' }), 'Pago confirmado'))} />}
          {x.status === 'APROBADA' && x.net_amount <= 0 && <Btn t="Efectivo recibido: cerrar" on={() => sure('Cerrar liquidación', () => run(sb.rpc('close_settlement', { p_id: x.id, p_ref: ref.trim() || 'manual' }), 'Liquidación cerrada'))} />}
          {x.status === 'APROBADA' && <Btn t="Cancelar liquidación" c="#D32F2F" on={() => sure('Cancelar liquidación', () => run(sb.rpc('cancel_settlement', { p_id: x.id }), 'Liquidación cancelada'))} />}
        </View>))}
    </ScrollView>
  );
  else if (tab === 'auditoria') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Auditoría</Text>
      {logs.map((l) => (
        <View key={l.id} style={s.card}>
          <View style={s.row}><Text style={s.b}>{l.action}</Text><Text style={{ color: '#888', fontSize: 11 }}>{ago(l.at)}</Text></View>
          <Text style={{ color: '#666', fontSize: 12 }}>{JSON.stringify(l.detail || {}).slice(0, 160)}</Text>
        </View>))}
      {!logs.length && <Text>Sin registros todavía.</Text>}
    </ScrollView>
  );
  else body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>Tarifas</Text>
      <Text style={s.b}>Comisión sobre los productos (%)</Text>
      <Inp keyboardType="decimal-pad" value={com} onChangeText={setCom} />
      <Text style={s.b}>Valor del domicilio (pesos)</Text>
      <Inp keyboardType="number-pad" value={fee} onChangeText={setFee} />
      <Text style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Los cambios solo aplican a pedidos nuevos. Los anteriores conservan su valor.</Text>
      <Btn t="Guardar tarifas" on={() => sure('Cambiar tarifas', () => run(sb.rpc('set_finance_settings', { p_commission: parseFloat(com), p_fee: parseInt(fee) }), 'Tarifas actualizadas'))} />
      <Text style={[s.h, { marginTop: 24 }]}>Mi cuenta</Text>
      <Text style={{ marginBottom: 8 }}>{email} · administrador</Text>
      <Btn t="Cerrar sesión" on={() => sb.auth.signOut()} c={O} />
    </ScrollView>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { padding: 14 }]}><Logo k={0.85} /><Text style={{ color: N, fontWeight: '900' }}>Administrador</Text></View>
      <View style={{ flex: 1 }}>{body}</View>
      <TabBar tabs={AT} tab={tab} go={setTab} />
    </View>
  );
}