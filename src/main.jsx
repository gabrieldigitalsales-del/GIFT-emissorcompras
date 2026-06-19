import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Plus, Trash2, FileDown, Save, LogOut, Pencil, X, Search, ClipboardList,
  Upload, CheckCircle2, XCircle, RefreshCw, Link as LinkIcon, Download,
  Archive, RotateCcw, Copy, BarChart3, ShieldAlert, Filter, Eraser
} from 'lucide-react'
import JSZip from 'jszip'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { formatCurrency, generatePurchasePdf } from './pdf'
import './style.css'

const PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'asd123'
const RECEIPT_BUCKET = 'gift-pedido-comprovantes'

const emptyItem = {
  name: '',
  link: '',
  quantity_text: '',
  package_count: 1,
  unit_value: ''
}

function onlyNumber(value) {
  if (typeof value === 'number') return value
  if (!value) return 0
  return Number(String(value).replace(/\./g, '').replace(',', '.')) || 0
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('aprov')) return 'approved'
  if (s.includes('recus')) return 'rejected'
  if (s.includes('compr')) return 'bought'
  return 'pending'
}

function csvEscape(value) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('pt-BR')
}

function App() {
  const [logged, setLogged] = useState(() => localStorage.getItem('gift_pc_logged') === 'yes')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [order, setOrder] = useState({
    requester: '',
    company: 'GIFT EXCELLENCE',
    date: todayInput(),
    notes: '',
    status: 'Pendente'
  })
  const [items, setItems] = useState([])
  const [currentItem, setCurrentItem] = useState(emptyItem)
  const [editingIndex, setEditingIndex] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [message, setMessage] = useState('')

  const total = useMemo(() => items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0), [items])
  const currentSubtotal = useMemo(() => onlyNumber(currentItem.unit_value) * onlyNumber(currentItem.package_count || 1), [currentItem])

  const summary = useMemo(() => {
    const all = history || []
    const pending = all.filter((h) => statusClass(h.status) === 'pending')
    const approved = all.filter((h) => statusClass(h.status) === 'approved')
    const rejected = all.filter((h) => statusClass(h.status) === 'rejected')
    return {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      pendingTotal: pending.reduce((acc, h) => acc + Number(h.total || 0), 0),
      approvedTotal: approved.reduce((acc, h) => acc + Number(h.total || 0), 0)
    }
  }, [history])

  useEffect(() => {
    if (logged) loadHistory()
  }, [logged])

  function handleLogin(e) {
    e.preventDefault()
    if (password === PASSWORD) {
      localStorage.setItem('gift_pc_logged', 'yes')
      setLogged(true)
      setLoginError('')
      return
    }
    setLoginError('Senha incorreta. Tente novamente.')
  }

  function logout() {
    localStorage.removeItem('gift_pc_logged')
    setLogged(false)
  }

  function showMessage(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 4200)
  }

  function addOrUpdateItem(e) {
    e.preventDefault()
    if (!currentItem.name.trim()) return showMessage('Informe o nome do item.')
    if (!currentItem.quantity_text.trim()) return showMessage('Informe a quantidade/descritivo.')
    if (!currentItem.unit_value) return showMessage('Informe o valor do kit/produto.')

    const item = {
      ...currentItem,
      unit_value: onlyNumber(currentItem.unit_value),
      package_count: onlyNumber(currentItem.package_count || 1),
      subtotal: currentSubtotal
    }

    if (editingIndex !== null) {
      setItems((prev) => prev.map((it, index) => index === editingIndex ? item : it))
      setEditingIndex(null)
    } else {
      setItems((prev) => [...prev, item])
    }
    setCurrentItem(emptyItem)
  }

  function editItem(index) {
    setCurrentItem(items[index])
    setEditingIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
      setCurrentItem(emptyItem)
    }
  }

  function cleanOrder() {
    setOrder({ requester: '', company: 'GIFT EXCELLENCE', date: todayInput(), notes: '', status: 'Pendente' })
    setItems([])
    setCurrentItem(emptyItem)
    setEditingIndex(null)
  }

  async function loadHistory() {
    if (!isSupabaseConfigured) return
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('gift_pc_orders')
      .select('*, gift_pc_items(*)')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error(error)
      showMessage('Não consegui carregar o histórico. Confira o Supabase e o SQL atualizado.')
    } else {
      setHistory(data || [])
    }
    setLoadingHistory(false)
  }

  async function saveOrder() {
    if (!items.length) {
      showMessage('Adicione pelo menos um item antes de salvar.')
      return null
    }
    if (!isSupabaseConfigured) {
      showMessage('Configure o Supabase no arquivo .env para salvar histórico.')
      return null
    }

    setSaving(true)
    const { data: orderData, error: orderError } = await supabase
      .from('gift_pc_orders')
      .insert({
        requester: order.requester || null,
        company: order.company || 'GIFT EXCELLENCE',
        order_date: order.date || todayInput(),
        notes: order.notes || null,
        status: 'Pendente',
        total
      })
      .select()
      .single()

    if (orderError) {
      console.error(orderError)
      setSaving(false)
      showMessage('Erro ao salvar o pedido. Confira o Supabase.')
      return null
    }

    const rows = items.map((item) => ({
      order_id: orderData.id,
      name: item.name,
      link: item.link || null,
      quantity_text: item.quantity_text,
      package_count: Number(item.package_count || 1),
      unit_value: Number(item.unit_value || 0),
      subtotal: Number(item.subtotal || 0)
    }))

    const { error: itemsError } = await supabase.from('gift_pc_items').insert(rows)
    setSaving(false)
    if (itemsError) {
      console.error(itemsError)
      showMessage('Pedido criado, mas houve erro ao salvar os itens.')
      return orderData
    }

    showMessage(`Pedido ${orderData.order_number} salvo como Pendente.`)
    await loadHistory()
    return orderData
  }

  async function saveAndPdf() {
    if (!items.length) return showMessage('Adicione pelo menos um item antes de gerar o PDF.')
    const savedOrder = isSupabaseConfigured ? await saveOrder() : null
    await generatePurchasePdf(savedOrder || { ...order, order_number: 'pedido-compra' }, items)
  }

  async function pdfOnly() {
    if (!items.length) return showMessage('Adicione pelo menos um item antes de gerar o PDF.')
    await generatePurchasePdf({ ...order, order_number: 'pedido-compra' }, items)
  }

  function loadFromHistory(h) {
    setOrder({
      requester: h.requester || '',
      company: h.company || 'GIFT EXCELLENCE',
      date: h.order_date || todayInput(),
      notes: h.notes || '',
      status: h.status || 'Pendente'
    })
    setItems((h.gift_pc_items || []).map((item) => ({
      name: item.name,
      link: item.link || '',
      quantity_text: item.quantity_text,
      package_count: item.package_count || item.quantity_multiplier || 1,
      unit_value: item.unit_value || 0,
      subtotal: item.subtotal || 0
    })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function duplicateOrder(h) {
    setOrder({
      requester: h.requester || '',
      company: h.company || 'GIFT EXCELLENCE',
      date: todayInput(),
      notes: h.notes ? `Duplicado de ${h.order_number} - ${h.notes}` : `Duplicado de ${h.order_number}`,
      status: 'Pendente'
    })
    setItems((h.gift_pc_items || []).map((item) => ({
      name: item.name,
      link: item.link || '',
      quantity_text: item.quantity_text,
      package_count: item.package_count || 1,
      unit_value: item.unit_value || 0,
      subtotal: item.subtotal || 0
    })))
    showMessage(`Pedido ${h.order_number} duplicado para edição.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function generateHistoryPdf(h) {
    const historyItems = (h.gift_pc_items || []).map((item) => ({
      name: item.name,
      link: item.link || '',
      quantity_text: item.quantity_text,
      unit_value: item.unit_value,
      subtotal: item.subtotal
    }))
    await generatePurchasePdf({ ...h, date: h.order_date }, historyItems)
  }

  async function updateOrderStatus(h, status) {
    if (!isSupabaseConfigured) return showMessage('Configure o Supabase para atualizar status.')

    let extra = {}
    if (status === 'Aprovado') {
      extra = { approved_at: new Date().toISOString(), rejected_at: null, rejection_reason: null }
    }
    if (status === 'Recusado') {
      const reason = window.prompt('Motivo da recusa? Ex: link errado, valor divergente, compra não autorizada.')
      if (reason === null) return
      extra = { rejected_at: new Date().toISOString(), approved_at: null, rejection_reason: reason || 'Sem motivo informado' }
    }
    if (status === 'Pendente') {
      extra = { approved_at: null, rejected_at: null, rejection_reason: null }
    }

    const { error } = await supabase
      .from('gift_pc_orders')
      .update({ status, ...extra })
      .eq('id', h.id)

    if (error) {
      console.error(error)
      showMessage('Não consegui atualizar o status. Rode o SQL atualizado.')
      return
    }
    showMessage(`Pedido ${h.order_number} marcado como ${status}.`)
    await loadHistory()
  }

  async function uploadReceipt(h, file) {
    if (!file) return
    if (!isSupabaseConfigured) return showMessage('Configure o Supabase para enviar comprovante.')

    const paymentDate = window.prompt('Data do pagamento? Use o formato AAAA-MM-DD.', todayInput())
    if (paymentDate === null) return
    const paymentMethod = window.prompt('Forma de pagamento? Ex: Pix, boleto, cartão, transferência.', 'Pix')
    if (paymentMethod === null) return
    const paymentResponsible = window.prompt('Responsável pelo pagamento?', 'Financeiro')
    if (paymentResponsible === null) return

    const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_.-]/g, '-')
    const path = `${h.id}/${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error(uploadError)
      showMessage('Erro ao enviar comprovante. Confira o bucket/policies do Supabase.')
      return
    }

    const { data: publicData } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
    const { error: updateError } = await supabase
      .from('gift_pc_orders')
      .update({
        status: 'Aprovado',
        proof_path: path,
        proof_url: publicData?.publicUrl || null,
        proof_name: file.name,
        proof_uploaded_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
        payment_date: paymentDate || todayInput(),
        payment_method: paymentMethod || null,
        payment_responsible: paymentResponsible || null
      })
      .eq('id', h.id)

    if (updateError) {
      console.error(updateError)
      showMessage('Comprovante enviado, mas não consegui vincular ao pedido. Rode o SQL atualizado.')
      return
    }

    showMessage('Comprovante anexado e pedido aprovado.')
    await loadHistory()
  }

  function buildOrdersCsv(rows = history) {
    const header = [
      'pedido', 'data_pedido', 'criado_em', 'solicitante', 'empresa', 'status', 'total',
      'observacao', 'motivo_recusa', 'data_pagamento', 'forma_pagamento',
      'responsavel_pagamento', 'comprovante_nome', 'comprovante_url'
    ]
    const lines = rows.map((h) => [
      h.order_number,
      h.order_date,
      formatDateTime(h.created_at),
      h.requester,
      h.company,
      h.status,
      Number(h.total || 0).toFixed(2).replace('.', ','),
      h.notes,
      h.rejection_reason,
      h.payment_date,
      h.payment_method,
      h.payment_responsible,
      h.proof_name,
      h.proof_url
    ].map(csvEscape).join(';'))
    return [header.map(csvEscape).join(';'), ...lines].join('\n')
  }

  function buildItemsCsv(rows = history) {
    const header = ['pedido', 'item', 'link', 'quantidade_pdf', 'qtd_calculo', 'valor_unitario', 'subtotal']
    const lines = rows.flatMap((h) => (h.gift_pc_items || []).map((item) => [
      h.order_number,
      item.name,
      item.link,
      item.quantity_text,
      item.package_count,
      Number(item.unit_value || 0).toFixed(2).replace('.', ','),
      Number(item.subtotal || 0).toFixed(2).replace('.', ',')
    ].map(csvEscape).join(';')))
    return [header.map(csvEscape).join(';'), ...lines].join('\n')
  }

  function downloadHistoryCsv(rows = history, name = 'historico_pedidos_gift.csv') {
    if (!rows.length) return showMessage('Nenhum pedido para exportar.')
    const csv = buildOrdersCsv(rows)
    downloadBlob(name, new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  }

  async function downloadHistoryZip() {
    if (!history.length) return showMessage('Nenhum pedido para baixar.')
    const zip = new JSZip()
    zip.file('historico_pedidos.csv', '\ufeff' + buildOrdersCsv(history))
    zip.file('itens_dos_pedidos.csv', '\ufeff' + buildItemsCsv(history))
    zip.file('historico_completo.json', JSON.stringify(history, null, 2))

    const receiptFolder = zip.folder('comprovantes')
    let attached = 0

    for (const h of history) {
      if (!h.proof_url) continue
      try {
        const response = await fetch(h.proof_url)
        if (!response.ok) continue
        const blob = await response.blob()
        const ext = (h.proof_name || 'comprovante').split('.').pop()
        const filename = `${h.order_number || h.id}-${(h.proof_name || `comprovante.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '-')}`
        receiptFolder.file(filename, blob)
        attached += 1
      } catch (err) {
        console.warn('Falha ao baixar comprovante:', h.order_number, err)
      }
    }

    const content = await zip.generateAsync({ type: 'blob' })
    downloadBlob(`historico_gift_comprovantes_${todayInput()}.zip`, content)
    showMessage(`Histórico baixado. Comprovantes incluídos: ${attached}.`)
  }

  async function clearHistory() {
    if (!isSupabaseConfigured) return showMessage('Configure o Supabase para limpar histórico.')
    const confirmText = window.prompt('Essa ação apaga todos os pedidos do histórico. Digite LIMPAR para confirmar.')
    if (confirmText !== 'LIMPAR') return showMessage('Limpeza cancelada.')

    const paths = history.map((h) => h.proof_path).filter(Boolean)
    if (paths.length) {
      await supabase.storage.from(RECEIPT_BUCKET).remove(paths)
    }

    const { error: itemsError } = await supabase.from('gift_pc_items').delete().not('id', 'is', null)
    if (itemsError) {
      console.error(itemsError)
      return showMessage('Não consegui apagar os itens. Confira as permissões do Supabase.')
    }

    const { error: ordersError } = await supabase.from('gift_pc_orders').delete().not('id', 'is', null)
    if (ordersError) {
      console.error(ordersError)
      return showMessage('Não consegui apagar os pedidos. Confira as permissões do Supabase.')
    }

    setHistory([])
    showMessage('Histórico limpo com sucesso.')
  }

  const filteredHistory = history.filter((h) => {
    const text = `${h.order_number} ${h.requester || ''} ${h.status || ''} ${h.proof_name || ''} ${h.rejection_reason || ''} ${h.payment_method || ''}`.toLowerCase()
    const searchOk = text.includes(search.toLowerCase())
    const statusOk = statusFilter === 'Todos'
      || (statusFilter === 'Com comprovante' ? Boolean(h.proof_url) : false)
      || (statusFilter === 'Sem comprovante' ? !h.proof_url : false)
      || String(h.status || 'Pendente') === statusFilter
    return searchOk && statusOk
  })

  const pendingHistory = history.filter((h) => statusClass(h.status) === 'pending')

  if (!logged) {
    return (
      <main className="loginPage">
        <form className="loginCard" onSubmit={handleLogin}>
          <img src="/logo-gift.png" alt="GIFT Excellence" className="loginLogo" />
          <h1>GIFT Emissor de Pedido de Compra</h1>
          <p>Acesso interno para compras e financeiro acompanharem pedidos.</p>
          <input type="password" placeholder="Digite a senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError && <span className="error">{loginError}</span>}
          <button type="submit">Entrar</button>
        </form>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-gift.png" alt="GIFT Excellence" />
          <div>
            <h1>GIFT Emissor de Pedido de Compra</h1>
            <p>Compras cria o pedido, financeiro aprova/recusa e anexa o comprovante.</p>
          </div>
        </div>
        <button className="ghostBtn" onClick={logout}><LogOut size={18} /> Sair</button>
      </header>

      {message && <div className="toast">{message}</div>}

      <section className="workflow">
        <div><strong>1. Compras</strong><span>Monta orçamento e gera PDF</span></div>
        <div><strong>2. Financeiro</strong><span>Confere, aprova ou recusa</span></div>
        <div><strong>3. Comprovante</strong><span>Anexa pagamento no histórico</span></div>
      </section>

      <section className="dashboard">
        <div><BarChart3 size={18} /><span>Pendentes</span><strong>{summary.pending}</strong><small>{formatCurrency(summary.pendingTotal)}</small></div>
        <div><CheckCircle2 size={18} /><span>Aprovados</span><strong>{summary.approved}</strong><small>{formatCurrency(summary.approvedTotal)}</small></div>
        <div><XCircle size={18} /><span>Recusados</span><strong>{summary.rejected}</strong><small>com motivo registrado</small></div>
      </section>

      <section className="grid">
        <div className="panel mainPanel">
          <div className="panelTitle">
            <ClipboardList size={20} />
            <div>
              <h2>Novo pedido de compra</h2>
              <p>Preencha os itens como aparecem no Mercado Livre ou fornecedor.</p>
            </div>
          </div>

          <div className="orderFields">
            <label>Solicitante / setor
              <input value={order.requester} onChange={(e) => setOrder({ ...order, requester: e.target.value })} placeholder="Ex: Setor de Compras" />
            </label>
            <label>Data do pedido
              <input type="date" value={order.date} onChange={(e) => setOrder({ ...order, date: e.target.value })} />
            </label>
            <label>Empresa
              <input value={order.company} onChange={(e) => setOrder({ ...order, company: e.target.value })} placeholder="GIFT EXCELLENCE" />
            </label>
            <label>Observação interna
              <input value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} placeholder="Opcional" />
            </label>
          </div>

          <form className="itemForm" onSubmit={addOrUpdateItem}>
            <label>Item
              <input value={currentItem.name} onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })} placeholder="Ex: Disco de corte" />
            </label>
            <label>Link de compra
              <input value={currentItem.link} onChange={(e) => setCurrentItem({ ...currentItem, link: e.target.value })} placeholder="https://..." />
            </label>
            <label>Quantidade que vai aparecer no PDF
              <input value={currentItem.quantity_text} onChange={(e) => setCurrentItem({ ...currentItem, quantity_text: e.target.value })} placeholder="Ex: 2 kits com 10 un cada" />
            </label>
            <label>Qtd. de kits/produtos
              <input type="number" min="0" step="0.01" value={currentItem.package_count} onChange={(e) => setCurrentItem({ ...currentItem, package_count: e.target.value })} />
              <small>Usado só para calcular. Ex: 2 kits = coloque 2.</small>
            </label>
            <label>Valor do kit/produto
              <input value={currentItem.unit_value} onChange={(e) => setCurrentItem({ ...currentItem, unit_value: e.target.value })} placeholder="Ex: 39,99" />
              <small>Preço do anúncio/kit. Ex: kit com 10 un custa R$20.</small>
            </label>
            <div className="subtotalBox">
              <span>Subtotal</span>
              <strong>{formatCurrency(currentSubtotal)}</strong>
            </div>
            <button type="submit" className="primaryBtn"><Plus size={18} /> {editingIndex !== null ? 'Atualizar item' : 'Adicionar item'}</button>
            {editingIndex !== null && <button type="button" className="cancelBtn" onClick={() => { setEditingIndex(null); setCurrentItem(emptyItem) }}><X size={18} /> Cancelar</button>}
          </form>

          <div className="hintBox">
            Exemplo: se no Mercado Livre aparece <b>kit com 10 unidades por R$ 20,00</b> e você vai comprar 3 kits, coloque: quantidade no PDF <b>3 kits com 10 un cada</b>, qtd. de kits/produtos <b>3</b> e valor do kit/produto <b>20,00</b>.
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Link</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                  <th>Subtotal</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan="6" className="empty">Nenhum item adicionado ainda.</td></tr>}
                {items.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td>{item.name}</td>
                    <td>{item.link ? <a href={item.link} target="_blank" rel="noreferrer">Abrir link</a> : '-'}</td>
                    <td>{item.quantity_text}</td>
                    <td>{formatCurrency(item.unit_value)}</td>
                    <td>{formatCurrency(item.subtotal)}</td>
                    <td className="actions">
                      <button onClick={() => editItem(index)} title="Editar"><Pencil size={15} /></button>
                      <button onClick={() => removeItem(index)} title="Apagar"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totalBox">
            <span>Total estimado</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div className="footerActions">
            <button className="secondaryBtn" onClick={cleanOrder}>Limpar pedido</button>
            <button className="darkBtn" onClick={saveOrder} disabled={saving}><Save size={18} /> {saving ? 'Salvando...' : 'Salvar como pendente'}</button>
            <button className="primaryBtn" onClick={pdfOnly}><FileDown size={18} /> Gerar PDF</button>
            <button className="primaryBtn wide" onClick={saveAndPdf}><Save size={18} /> Salvar e gerar PDF</button>
          </div>
        </div>

        <aside className="panel historyPanel">
          <div className="panelTitle">
            <Search size={20} />
            <div>
              <h2>Histórico / Financeiro</h2>
              <p>Pedidos ficam pendentes até aprovação ou recusa.</p>
            </div>
          </div>

          {!isSupabaseConfigured && (
            <div className="warning">
              Supabase ainda não configurado. O sistema gera PDF, mas só salva histórico e comprovantes após preencher o .env e rodar o SQL atualizado.
            </div>
          )}

          <div className="adminBox">
            <div className="adminTitle"><ShieldAlert size={16} /><strong>Ações administrativas</strong></div>
            <button className="secondaryBtn full" onClick={() => downloadHistoryCsv(history)}>Baixar histórico CSV</button>
            <button className="secondaryBtn full" onClick={downloadHistoryZip}><Archive size={16} /> Baixar histórico com comprovantes</button>
            <button className="secondaryBtn full" onClick={() => downloadHistoryCsv(pendingHistory, 'pedidos_pendentes_gift.csv')}><Download size={16} /> Exportar pendentes</button>
            <button className="dangerBtn full" onClick={clearHistory}><Eraser size={16} /> Limpar histórico</button>
          </div>

          <div className="filterRow">
            <label><Filter size={14} /> Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>Todos</option>
                <option>Pendente</option>
                <option>Aprovado</option>
                <option>Recusado</option>
                <option>Com comprovante</option>
                <option>Sem comprovante</option>
              </select>
            </label>
          </div>

          <input className="search" placeholder="Buscar pedido, status, motivo ou comprovante..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="secondaryBtn full" onClick={loadHistory}><RefreshCw size={16} /> Atualizar histórico</button>

          <div className="historyList">
            {loadingHistory && <p className="muted">Carregando...</p>}
            {!loadingHistory && filteredHistory.length === 0 && <p className="muted">Nenhum pedido encontrado.</p>}
            {filteredHistory.map((h) => (
              <div className="historyCard" key={h.id}>
                <div className="historyHead">
                  <strong>{h.order_number}</strong>
                  <span className={`badge ${statusClass(h.status)}`}>{h.status || 'Pendente'}</span>
                </div>
                <span>{new Date(h.created_at).toLocaleDateString('pt-BR')} - {formatCurrency(h.total)}</span>
                <p>{h.requester || 'Sem solicitante'}</p>

                {h.rejection_reason && <small><b>Motivo da recusa:</b> {h.rejection_reason}</small>}
                {h.payment_date && <small><b>Pagamento:</b> {h.payment_date} | {h.payment_method || '-'} | {h.payment_responsible || '-'}</small>}

                {h.proof_url && (
                  <a className="receiptLink" href={h.proof_url} target="_blank" rel="noreferrer"><LinkIcon size={15} /> Abrir comprovante</a>
                )}
                {h.proof_name && <small className="receiptName">Arquivo: {h.proof_name}</small>}

                <label className="uploadBtn">
                  <Upload size={16} /> Anexar comprovante e aprovar
                  <input type="file" accept="image/*,.pdf" onChange={(e) => uploadReceipt(h, e.target.files?.[0])} />
                </label>

                <div className="historyActions">
                  <button onClick={() => updateOrderStatus(h, 'Aprovado')}><CheckCircle2 size={15} /> Aprovar</button>
                  <button onClick={() => updateOrderStatus(h, 'Recusado')}><XCircle size={15} /> Recusar</button>
                  <button onClick={() => updateOrderStatus(h, 'Pendente')}><RotateCcw size={15} /> Reabrir</button>
                  <button onClick={() => duplicateOrder(h)}><Copy size={15} /> Duplicar</button>
                  <button onClick={() => loadFromHistory(h)}>Carregar</button>
                  <button onClick={() => generateHistoryPdf(h)}>PDF</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
