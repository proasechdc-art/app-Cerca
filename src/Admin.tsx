import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, Switch, TouchableOpacity as T } from 'react-native';
import { supabase as sb } from './supabase';
import { s, G, N, O, AT, money, say, ago, Btn, Btn2, Inp, Stat, Logo, TabBar } from './ui';

const AUD: any = {
  payment_created: 'Pago creado', payment_approved: 'Pago aprobado (Wompi)', payment_declined: 'Pago rechazado', payment_failed: 'Pago fallido',
  payment_cancelled: 'Pago anulado', payment_amount_mismatch: 'El monto no coincide', payment_event_after_approved: 'Aviso posterior a un pago aprobado',
  order_delivered_ledger: 'Pedido entregado: dinero registrado', settlement_created: 'Liquidación creada', settlement_approved: 'Liquidación aprobada',
  payout_paid: 'Pago al beneficiario confirmado', settlement_closed: 'Liquidación cerrada', settlement_cancelled: 'Liquidación cancelada',
  settings_changed: 'Tarifas cambiadas', order_cancelled: 'Pedido cancelado', refund_confirmed: 'Reembolso confirmado', payment_approved_after_cancel: 'Pago recibido de un pedido cancelado', admin_role_assigned: 'Rol de administrador asignado',
};
const RSN: any = { missing_item: 'Falta un producto', bad_condition: 'Producto en mal estado', wrong_order: 'Pedido equivocado', not_received: 'No le llegó', other: 'Otro problema' };
export function Admin({ me, email }: any) {
  const [tab, setTab] = useState('resumen');
  const [sum, setSum] = useState<any>(null);
  const [pend, setPend] = useState<any[]>([]);
  const [setts, setSetts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [com, setCom] = useState('');
  const [fee, setFee] = useState('');
  const [tAcc, setTAcc] = useState('');
  const [tPay, setTPay] = useState('');
  const [tCou, setTCou] = useState('');
  const [tGra, setTGra] = useState('');
  const [tAfter, setTAfter] = useState(false);
  const [ref, setRef] = useState('');
  const [claims, setClaims] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [cAmt, setCAmt] = useState('');
  const [cFault, setCFault] = useState('merchant');
  const [cNote, setCNote] = useState('');
  const [refs, setRefs] = useState<any[]>([]);
  const load = useCallback(async () => {
    const [a, b, c, d, e] = await Promise.all([
      sb.rpc('admin_summary'), sb.rpc('admin_pending'), sb.rpc('admin_settlements'),
      sb.from('audit_log').select('*').order('id', { ascending: false }).limit(40),
      sb.from('finance_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setSum(a.data); setPend(b.data || []); setSetts(c.data || []); setLogs(d.data || []);
    sb.rpc('admin_refunds').then(({ data }) => setRefs(data || []));
    if (e.data) {
      setCom(String(e.data.commission_pct)); setFee(String(e.data.courier_fee));
      setTAcc(String(e.data.accept_timeout_minutes)); setTPay(String(e.data.payment_timeout_minutes)); setTCou(String(e.data.courier_timeout_minutes));
      setTGra(String(e.data.cancel_grace_minutes)); setTAfter(!!e.data.client_cancel_after_accept);
    }
  }, []);
  useEffect(() => { load(); sb.rpc('admin_claims').then(({ data }) => setClaims(data || [])); }, [tab]);
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
      {!!refs.filter((r) => r.status === 'PENDING').length && <Text style={[s.h, { marginTop: 4 }]}>Reembolsos pendientes</Text>}
      {refs.filter((r) => r.status === 'PENDING').map((r) => (
        <View key={r.id} style={[s.card, { backgroundColor: '#FFF8F1' }]}>
          <Text style={s.b}>{money(r.amount)} · {r.email}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>{r.reason} · {ago(r.created_at)}</Text>
          <Text style={{ color: '#666', fontSize: 11 }}>Referencia Wompi: {r.reference}</Text>
          <Btn t="Ya reembolsé: confirmar" on={() => sure('Confirmar que el dinero ya se devolvió', () => run(sb.rpc('confirm_refund', { p_refund: r.id, p_ref: ref.trim() || 'manual' }), 'Reembolso registrado'))} />
        </View>))}
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
  else if (tab === 'reclamos') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h}>Reclamos</Text>
      {!claims.length && <Text>No hay reclamos.</Text>}
      {claims.map((c) => (
        <View key={c.id} style={[s.card, c.status === 'OPEN' && { backgroundColor: '#FFF8F1' }]}>
          <View style={s.row}><Text style={s.b}>{RSN[c.reason] || c.reason}</Text><Text style={{ fontWeight: '800', color: c.status === 'OPEN' ? O : c.status === 'APPROVED' ? G : '#666' }}>{c.status === 'OPEN' ? 'ABIERTO' : c.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'}</Text></View>
          <Text>{c.store_name} · {c.email} · pedido {money(c.order_total)}</Text>
          {!!c.description && <Text style={{ color: '#444', marginVertical: 4 }}>"{c.description}"</Text>}
          <Text style={{ color: '#888', fontSize: 11 }}>{ago(c.created_at)}{c.courier_email ? ` · repartidor ${c.courier_email}` : ''}</Text>
          {c.status !== 'OPEN' && <Text style={{ color: '#666', marginTop: 4 }}>Reembolso {money(c.refund_amount || 0)} · asume: {c.fault}{c.admin_note ? ` · ${c.admin_note}` : ''}</Text>}
          {c.status === 'OPEN' && sel !== c.id && <Btn t="Resolver" on={() => { setSel(c.id); setCAmt(String(c.order_total)); setCFault('merchant'); setCNote(''); }} />}
          {c.status === 'OPEN' && sel === c.id && <>
            <Text style={[s.b, { marginTop: 8 }]}>Valor a reembolsar (0 = rechazar el reclamo)</Text>
            <Inp keyboardType="number-pad" value={cAmt} onChangeText={setCAmt} />
            <Text style={s.b}>¿Quién asume el costo?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[['merchant', 'Comercio'], ['courier', 'Repartidor'], ['cerquita', 'Cerquita']].map(([k, t]) => (
                <T key={k} onPress={() => setCFault(k)} style={[s.chip2, cFault === k && { backgroundColor: G, borderColor: G }]}><Text style={{ color: cFault === k ? '#fff' : N, fontWeight: '700' }}>{t}</Text></T>))}
            </View>
            <Inp placeholder="Nota (opcional)" value={cNote} onChangeText={setCNote} />
            <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
              <Btn2 t="Cancelar" c="#EDEDED" tc="#555" on={() => setSel(null)} />
              <Btn2 t="Guardar decisión" on={() => sure('Guardar la decisión', async () => {
                await run(sb.rpc('resolve_claim', { p_claim: c.id, p_refund: parseInt(cAmt) || 0, p_fault: (parseInt(cAmt) || 0) > 0 ? cFault : 'none', p_note: cNote.trim() || null }), 'Decisión guardada');
                setSel(null);
                sb.rpc('admin_claims').then(({ data }) => setClaims(data || []));
              })} />
            </View>
          </>}
        </View>))}
    </ScrollView>
  );
  else if (tab === 'auditoria') body = (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h}>Auditoría</Text>
      {logs.map((l) => (
        <View key={l.id} style={s.card}>
          <View style={s.row}><Text style={s.b}>{AUD[l.action] || l.action}</Text><Text style={{ color: '#888', fontSize: 11 }}>{ago(l.at)}</Text></View>
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
      <Text style={[s.h, { marginTop: 24 }]}>Reglas de cancelación</Text>
      <Text style={s.b}>Minutos para que el comercio acepte el pedido</Text>
      <Inp keyboardType="number-pad" value={tAcc} onChangeText={setTAcc} />
      <Text style={s.b}>Minutos para completar el pago electrónico</Text>
      <Inp keyboardType="number-pad" value={tPay} onChangeText={setTPay} />
      <Text style={s.b}>Minutos para conseguir repartidor (pedido listo)</Text>
      <Inp keyboardType="number-pad" value={tCou} onChangeText={setTCou} />
      <View style={[s.row, { marginVertical: 8 }]}>
        <Text style={{ flex: 1, fontWeight: '700', marginRight: 10 }}>El cliente puede cancelar después de que el comercio acepta</Text>
        <Switch value={tAfter} onValueChange={setTAfter} trackColor={{ true: G }} />
      </View>
      <Text style={s.b}>Minutos de gracia para cancelar después de aceptar</Text>
      <Inp keyboardType="number-pad" value={tGra} onChangeText={setTGra} />
      <Text style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Los cambios aplican de inmediato a los pedidos que están en curso y a los nuevos.</Text>
      <Btn t="Guardar reglas de cancelación" on={() => sure('Cambiar las reglas de cancelación', () => run(sb.rpc('set_cancel_settings', { p_accept: parseInt(tAcc), p_payment: parseInt(tPay), p_courier: parseInt(tCou), p_grace: parseInt(tGra) || 0, p_after: tAfter }), 'Reglas actualizadas'))} />
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
