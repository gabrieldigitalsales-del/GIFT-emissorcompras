import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, hasSupabase, table } from './supabaseClient'
import './index.css'
import { AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, Clock3, Download, Edit3, Eye, FileClock, History, LogOut, MessageSquarePlus, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'

const LOGO = '/logo-gift.jpeg'
const LOGIN_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || 'asd123'

const periods = [
  { key: 'dia', label: 'Dia', hint: 'tarefas para resolver hoje', icon: Clock3 },
  { key: 'semana', label: 'Semana', hint: 'atividades da semana', icon: CalendarDays },
  { key: 'mes', label: 'Mês', hint: 'planejamento mensal', icon: CalendarRange },
  { key: 'ano', label: 'Ano', hint: 'metas e projetos do ano', icon: Sparkles }
]

const columns = [
  { key: 'ideias', label: 'Ideias / Entrada', tone: 'bg-slate-100 border-slate-200' },
  { key: 'fazer', label: 'A fazer', tone: 'bg-blue-50 border-blue-100' },
  { key: 'andamento', label: 'Em andamento', tone: 'bg-amber-50 border-amber-100' },
  { key: 'aguardando', label: 'Aguardando', tone: 'bg-purple-50 border-purple-100' },
  { key: 'concluido', label: 'Concluído', tone: 'bg-emerald-50 border-emerald-100' }
]

const priorities = ['baixa', 'média', 'alta', 'urgente']
const recurrences = ['única', 'diária', 'semanal', 'quinzenal', 'mensal', 'trimestral', 'semestral', 'anual']
const cardColors = [
  { key: 'red', label: 'Vermelho', cls: 'bg-red-100 border-red-300' },
  { key: 'orange', label: 'Laranja', cls: 'bg-orange-100 border-orange-300' },
  { key: 'yellow', label: 'Amarelo', cls: 'bg-yellow-100 border-yellow-300' },
  { key: 'green', label: 'Verde', cls: 'bg-green-100 border-green-300' },
  { key: 'blue', label: 'Azul', cls: 'bg-blue-100 border-blue-300' },
  { key: 'purple', label: 'Roxo', cls: 'bg-purple-100 border-purple-300' },
  { key: 'gray', label: 'Cinza', cls: 'bg-gray-100 border-gray-300' }
]

const today = () => new Date().toISOString().slice(0, 10)
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const blankTask = {
  title: '',
  description: '',
  period: 'dia',
  column_key: 'ideias',
  priority: 'média',
  due_date: today(),
  responsible: '',
  recurrence: 'única',
  tags: '',
  color: 'red',
  checklist: '',
  observations: []
}

function App() {
  const [authed, setAuthed] = useState(localStorage.getItem('gift_control_auth') === '1')
  if (!authed) return <Login onOk={() => setAuthed(true)} />
  return <BoardApp onLogout={() => { localStorage.removeItem('gift_control_auth'); setAuthed(false) }} />
}

function Login({ onOk }) {
  const [pass, setPass] = useState('')
  const submit = () => {
    if (pass === LOGIN_PASSWORD) {
      localStorage.setItem('gift_control_auth', '1')
      onOk()
    } else {
      alert('Senha incorreta')
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-white via-gray-100 to-gray-300 p-4">
      <section className="w-full max-w-md bg-white rounded-3xl p-8 border shadow-xl">
        <img src={LOGO} className="w-72 mx-auto rounded-2xl mb-6" />
        <h1 className="text-4xl font-black text-center tracking-tight">GIFT CONTROL</h1>
        <p className="text-center text-gray-500 mt-2 mb-6">Quadro inteligente de tarefas</p>
        <input
          className="w-full border rounded-2xl px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-red-500"
          type="password"
          placeholder="Senha de acesso"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 font-black text-lg" onClick={submit}>Entrar</button>
        <p className="text-xs text-center mt-4 text-gray-400">Senha inicial: asd123</p>
      </section>
    </main>
  )
}

function BoardApp({ onLogout }) {
  const { tasks, loading, addTask, updateTask, removeTask } = useTasks()
  const [period, setPeriod] = useState('dia')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [drag, setDrag] = useState(null)
  const [view, setView] = useState('board')
  const { history, historyLoading, logAction, clearHistory, downloadHistory } = useActivityHistory()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter((task) => task.period === period && (!q || JSON.stringify(task).toLowerCase().includes(q)))
  }, [tasks, period, query])

  const stats = useMemo(() => {
    const open = filtered.filter((t) => t.column_key !== 'concluido')
    return {
      total: filtered.length,
      open: open.length,
      late: open.filter((t) => t.due_date && new Date(t.due_date + 'T23:59:59') < new Date()).length,
      done: filtered.filter((t) => t.column_key === 'concluido').length
    }
  }, [filtered])

  const smartTip = useMemo(() => {
    if (stats.late > 0) return `Você tem ${stats.late} tarefa(s) atrasada(s). Priorize essas antes de abrir novas atividades.`
    if (filtered.some((t) => t.priority === 'urgente' && t.column_key !== 'concluido')) return 'Existem tarefas urgentes abertas. Mova para Em andamento ou conclua o quanto antes.'
    if (stats.open === 0) return 'Tudo limpo nesse período. Você pode planejar novas tarefas com calma.'
    return 'Quadro organizado. Arraste os cards conforme o andamento das atividades.'
  }, [stats, filtered])

  const saveTask = async (form) => {
    const clean = { ...form, observations: Array.isArray(form.observations) ? form.observations : [] }
    if (modal?.mode === 'edit') {
      const previousObs = modal.task?.observations?.length || 0
      const nextObs = clean.observations?.length || 0
      const saved = await updateTask(modal.task.id, clean)
      await logAction(nextObs > previousObs ? 'Observação adicionada' : 'Tarefa editada', clean.title || 'Tarefa sem título', saved)
    } else {
      const saved = await addTask(clean)
      await logAction('Tarefa criada', clean.title || 'Tarefa sem título', saved)
    }
    setModal(null)
  }

  const quickAdd = (columnKey) => {
    setModal({ mode: 'add', task: { ...blankTask, period, column_key: columnKey, due_date: period === 'dia' ? today() : '' } })
  }

  const onDrop = async (columnKey) => {
    if (!drag || drag.column_key === columnKey) return setDrag(null)
    const oldColumn = columns.find((c) => c.key === drag.column_key)?.label || drag.column_key
    const newColumn = columns.find((c) => c.key === columnKey)?.label || columnKey
    const saved = await updateTask(drag.id, { ...drag, column_key: columnKey })
    await logAction('Tarefa movida', `${drag.title || 'Tarefa sem título'}: ${oldColumn} → ${newColumn}`, saved)
    setDrag(null)
  }

  const deleteTask = async (task) => {
    if (!confirm('Apagar esta tarefa?')) return
    await logAction('Tarefa apagada', task.title || 'Tarefa sem título', task)
    await removeTask(task.id)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b">
        <div className="px-4 lg:px-6 py-3 flex gap-3 items-center">
          <img src={LOGO} className="w-24 rounded-xl hidden sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-xl lg:text-3xl leading-tight">GIFT CONTROL</h1>
            <p className="text-xs lg:text-sm text-gray-500">Quadro de tarefas inteligente, simples e colorido</p>
          </div>
          <div className="hidden md:flex bg-gray-100 rounded-2xl p-1 border">
            <button onClick={() => setView('board')} className={`px-4 py-3 rounded-xl font-black flex items-center gap-2 ${view === 'board' ? 'bg-white shadow-sm text-red-700' : 'text-gray-600'}`}>
              <CalendarDays size={18} /> Quadro
            </button>
            <button onClick={() => setView('history')} className={`px-4 py-3 rounded-xl font-black flex items-center gap-2 ${view === 'history' ? 'bg-white shadow-sm text-red-700' : 'text-gray-600'}`}>
              <History size={18} /> Histórico
            </button>
          </div>
          <button onClick={onLogout} className="border rounded-2xl px-4 py-3 font-bold flex items-center gap-2 bg-white"><LogOut size={18} /> Sair</button>
        </div>
        <div className="md:hidden px-4 pb-3 grid grid-cols-2 gap-2">
          <button onClick={() => setView('board')} className={`rounded-2xl border px-4 py-3 font-black ${view === 'board' ? 'bg-red-600 text-white border-red-600' : 'bg-white'}`}>Quadro</button>
          <button onClick={() => setView('history')} className={`rounded-2xl border px-4 py-3 font-black ${view === 'history' ? 'bg-red-600 text-white border-red-600' : 'bg-white'}`}>Histórico</button>
        </div>
      </header>

      <main className="p-4 lg:p-6">
        {view === 'history' ? (
          <HistoryPage entries={history} loading={historyLoading} onClear={clearHistory} onDownload={downloadHistory} />
        ) : (
        <>
        <section className="bg-white border rounded-3xl p-4 lg:p-5 shadow-sm mb-5">
          <div className="flex flex-col xl:flex-row gap-4 xl:items-end justify-between">
            <div>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tight">Quadro de atividades</h2>
              <p className="text-gray-500 mt-1">Organize tarefas por dia, semana, mês e ano. Clique no card para abrir detalhes e adicionar observações depois.</p>
            </div>
            <button onClick={() => setModal({ mode: 'add', task: { ...blankTask, period } })} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl px-5 py-4 font-black flex items-center justify-center gap-2">
              <Plus /> Nova tarefa
            </button>
          </div>

          <div className="mt-5 grid lg:grid-cols-[1fr_340px] gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {periods.map(({ key, label, hint, icon: Icon }) => (
                <button key={key} onClick={() => setPeriod(key)} className={`text-left rounded-2xl border p-4 transition ${period === key ? 'bg-red-600 text-white border-red-600' : 'bg-white hover:bg-gray-50'}`}>
                  <Icon size={20} />
                  <b className="block mt-2 text-lg">{label}</b>
                  <span className={`text-xs ${period === key ? 'text-white/80' : 'text-gray-500'}`}>{hint}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-4 text-gray-400" size={19} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarefa, responsável, tag ou observação..." className="w-full border rounded-2xl pl-11 pr-4 py-4 outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Kpi label="Total" value={stats.total} />
            <Kpi label="Em aberto" value={stats.open} />
            <Kpi label="Atrasadas" value={stats.late} danger={stats.late > 0} />
            <Kpi label="Concluídas" value={stats.done} />
          </div>

          <div className="mt-4 rounded-2xl border bg-gray-50 p-4 flex gap-3 items-start">
            <AlertTriangle className="text-red-600 shrink-0" />
            <div>
              <b>Leitura inteligente do quadro</b>
              <p className="text-gray-600 text-sm">{smartTip}</p>
            </div>
          </div>
        </section>

        {loading ? <p>Carregando...</p> : (
          <section className="grid xl:grid-cols-5 gap-4 items-start overflow-x-auto pb-5">
            {columns.map((col) => {
              const list = filtered.filter((task) => task.column_key === col.key)
              return (
                <div key={col.key} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(col.key)} className={`min-w-[290px] rounded-3xl border p-3 ${col.tone}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <b className="text-lg">{col.label}</b>
                      <p className="text-xs text-gray-500">{list.length} card(s)</p>
                    </div>
                    <button onClick={() => quickAdd(col.key)} className="bg-white border rounded-xl p-2 hover:bg-gray-50"><Plus size={18} /></button>
                  </div>

                  <div className="space-y-3 min-h-[260px]">
                    {list.map((task) => (
                      <TaskCard key={task.id} task={task} onDrag={() => setDrag(task)} onOpen={() => setModal({ mode: 'edit', task })} onDelete={() => deleteTask(task)} />
                    ))}
                    {!list.length && <button onClick={() => quickAdd(col.key)} className="w-full rounded-2xl border border-dashed bg-white/60 p-6 text-sm text-gray-500 hover:bg-white">+ adicionar card</button>}
                  </div>
                </div>
              )
            })}
          </section>
        )}
        </>
        )}
      </main>

      {modal && <TaskModal mode={modal.mode} task={modal.task} onClose={() => setModal(null)} onSave={saveTask} />}
    </div>
  )
}


function useActivityHistory() {
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  async function loadHistory() {
    setHistoryLoading(true)
    if (hasSupabase) {
      const { data, error } = await supabase.from(table('activity_logs')).select('*').order('created_at', { ascending: false })
      if (error) setHistory([])
      else setHistory(data || [])
    } else {
      setHistory(JSON.parse(localStorage.getItem('gift_control_history') || '[]'))
    }
    setHistoryLoading(false)
  }

  useEffect(() => { loadHistory() }, [])
  useEffect(() => {
    if (!hasSupabase && !historyLoading) localStorage.setItem('gift_control_history', JSON.stringify(history))
  }, [history, historyLoading])

  async function logAction(action, details, task = null) {
    const payload = {
      id: uid(),
      action,
      details,
      task_id: task?.id || null,
      task_title: task?.title || details || null,
      snapshot: task || {},
      created_at: new Date().toISOString()
    }
    if (hasSupabase) {
      const { error } = await supabase.from(table('activity_logs')).insert(payload)
      if (error) return
    }
    setHistory((prev) => [payload, ...prev])
  }

  async function clearHistory() {
    if (!confirm('Tem certeza que deseja limpar todo o histórico? As tarefas não serão apagadas.')) return
    if (hasSupabase) {
      const { error } = await supabase.from(table('activity_logs')).delete().not('id', 'is', null)
      if (error) return alert(error.message)
    }
    setHistory([])
  }

  function downloadHistory(format = 'json') {
    const stamp = new Date().toISOString().slice(0, 10)
    if (format === 'csv') {
      const header = ['Data', 'Ação', 'Detalhes', 'Tarefa']
      const rows = history.map((item) => [
        item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '',
        item.action || '',
        item.details || '',
        item.task_title || ''
      ])
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n')
      downloadBlob(csv, `historico-gift-control-${stamp}.csv`, 'text/csv;charset=utf-8')
      return
    }
    const data = {
      sistema: 'GIFT CONTROL',
      empresa: 'GIFT EXCELLENCE',
      gerado_em: new Date().toISOString(),
      observacao: 'Histórico exportado. Quando o módulo de anexos/comprovantes estiver ativo, os vínculos ficarão dentro do campo snapshot.',
      total_registros: history.length,
      historico: history
    }
    downloadBlob(JSON.stringify(data, null, 2), `historico-gift-control-${stamp}.json`, 'application/json')
  }

  return { history, historyLoading, logAction, clearHistory, downloadHistory }
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function HistoryPage({ entries, loading, onClear, onDownload }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return entries
    return entries.filter((item) => JSON.stringify(item).toLowerCase().includes(term))
  }, [entries, q])

  const totals = useMemo(() => ({
    total: entries.length,
    created: entries.filter((e) => e.action === 'Tarefa criada').length,
    moved: entries.filter((e) => e.action === 'Tarefa movida').length,
    notes: entries.filter((e) => e.action === 'Observação adicionada').length
  }), [entries])

  return (
    <section className="space-y-5">
      <div className="bg-white border rounded-3xl p-4 lg:p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row gap-4 xl:items-end justify-between">
          <div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight flex items-center gap-3"><FileClock className="text-red-600" /> Histórico</h2>
            <p className="text-gray-500 mt-1">Aba separada para acompanhar tudo que foi criado, editado, movido, comentado ou apagado no quadro.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <button onClick={() => onDownload('json')} className="bg-gray-900 hover:bg-black text-white rounded-2xl px-4 py-4 font-black flex items-center justify-center gap-2"><Download size={18} /> JSON</button>
            <button onClick={() => onDownload('csv')} className="bg-white border hover:bg-gray-50 rounded-2xl px-4 py-4 font-black flex items-center justify-center gap-2"><Download size={18} /> Excel/CSV</button>
            <button onClick={onClear} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl px-4 py-4 font-black flex items-center justify-center gap-2"><Trash2 size={18} /> Limpar</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Kpi label="Registros" value={totals.total} />
          <Kpi label="Criadas" value={totals.created} />
          <Kpi label="Movidas" value={totals.moved} />
          <Kpi label="Observações" value={totals.notes} />
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-4 top-4 text-gray-400" size={19} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no histórico por tarefa, ação, responsável, observação..." className="w-full border rounded-2xl pl-11 pr-4 py-4 outline-none focus:ring-2 focus:ring-red-500" />
        </div>
      </div>

      <div className="bg-white border rounded-3xl p-3 lg:p-4 shadow-sm">
        {loading ? <p className="p-6 text-gray-500">Carregando histórico...</p> : filtered.length ? (
          <div className="space-y-3">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-3xl border p-4 bg-gray-50 hover:bg-white transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <b className="text-lg">{item.action}</b>
                    <p className="text-gray-700 text-sm mt-1">{item.details || item.task_title || 'Sem detalhes'}</p>
                  </div>
                  <span className="text-xs font-bold bg-white border rounded-full px-3 py-2 w-fit">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}</span>
                </div>
                {item.task_title && <p className="text-xs text-gray-500 mt-3"><b>Tarefa:</b> {item.task_title}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <History className="mx-auto mb-3 text-gray-300" size={52} />
            <b>Nenhum registro encontrado.</b>
            <p className="text-sm">Quando você criar, mover, editar ou comentar uma tarefa, o histórico aparece aqui.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    if (hasSupabase) {
      const { data, error } = await supabase.from(table('tasks')).select('*').order('created_at', { ascending: false })
      if (error) {
        alert(error.message)
        setTasks([])
      } else {
        setTasks((data || []).map(normalizeTask))
      }
    } else {
      setTasks(JSON.parse(localStorage.getItem('gift_control_tasks') || '[]').map(normalizeTask))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!hasSupabase && !loading) localStorage.setItem('gift_control_tasks', JSON.stringify(tasks))
  }, [tasks, loading])

  async function addTask(task) {
    const payload = normalizeTask({ ...task, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    if (hasSupabase) {
      const { error } = await supabase.from(table('tasks')).insert(payload)
      if (error) throw error
    }
    setTasks((prev) => [payload, ...prev])
    return payload
  }

  async function updateTask(id, task) {
    const payload = normalizeTask({ ...task, updated_at: new Date().toISOString() })
    if (hasSupabase) {
      const { error } = await supabase.from(table('tasks')).update(payload).eq('id', id)
      if (error) throw error
    }
    const saved = { ...payload, id }
    setTasks((prev) => prev.map((item) => item.id === id ? { ...item, ...saved } : item))
    return saved
  }

  async function removeTask(id) {
    if (hasSupabase) {
      const { error } = await supabase.from(table('tasks')).delete().eq('id', id)
      if (error) throw error
    }
    setTasks((prev) => prev.filter((item) => item.id !== id))
  }

  return { tasks, loading, addTask, updateTask, removeTask }
}

function normalizeTask(task) {
  return {
    ...blankTask,
    ...task,
    observations: Array.isArray(task?.observations) ? task.observations : [],
    color: task?.color || 'red'
  }
}

function TaskCard({ task, onDrag, onOpen, onDelete }) {
  const color = cardColors.find((item) => item.key === task.color)?.cls || cardColors[0].cls
  const late = task.column_key !== 'concluido' && task.due_date && new Date(task.due_date + 'T23:59:59') < new Date()
  const tags = (task.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
  const checks = (task.checklist || '').split('\n').map((t) => t.trim()).filter(Boolean)
  const doneChecks = checks.filter((t) => t.startsWith('[x]') || t.startsWith('✓')).length

  return (
    <article draggable onDragStart={onDrag} onClick={onOpen} className={`cursor-pointer rounded-3xl border-2 p-4 shadow-sm hover:shadow-lg transition ${color}`}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-lg leading-tight break-words">{task.title || 'Tarefa sem título'}</h3>
          {task.description && <p className="text-sm text-gray-700 mt-2 line-clamp-3">{task.description}</p>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="h-9 w-9 shrink-0 bg-white/70 border rounded-xl grid place-items-center text-red-700"><Trash2 size={16} /></button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 text-xs font-bold">
        <span className={`px-2 py-1 rounded-full ${task.priority === 'urgente' ? 'bg-red-600 text-white' : 'bg-white/70 border'}`}>{task.priority}</span>
        {task.due_date && <span className={`px-2 py-1 rounded-full border bg-white/70 ${late ? 'text-red-700 border-red-400' : ''}`}>Prazo: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
        {task.recurrence && <span className="px-2 py-1 rounded-full bg-white/70 border">{task.recurrence}</span>}
      </div>

      {(task.responsible || tags.length > 0) && <div className="mt-3 text-xs text-gray-700 space-y-1">
        {task.responsible && <p><b>Resp.:</b> {task.responsible}</p>}
        {tags.length > 0 && <p><b>Tags:</b> {tags.join(' • ')}</p>}
      </div>}

      <div className="mt-4 flex items-center justify-between text-xs text-gray-700">
        <span className="flex items-center gap-1"><MessageSquarePlus size={15} /> {task.observations?.length || 0} obs.</span>
        {checks.length > 0 && <span className="flex items-center gap-1"><CheckCircle2 size={15} /> {doneChecks}/{checks.length}</span>}
        <span className="flex items-center gap-1"><Eye size={15} /> abrir</span>
      </div>
    </article>
  )
}

function TaskModal({ mode, task, onClose, onSave }) {
  const [form, setForm] = useState(normalizeTask(task))
  const [obs, setObs] = useState('')

  const addObservation = () => {
    if (!obs.trim()) return
    setForm((prev) => ({
      ...prev,
      observations: [{ id: uid(), text: obs.trim(), created_at: new Date().toISOString() }, ...(prev.observations || [])]
    }))
    setObs('')
  }

  const removeObservation = (id) => {
    setForm((prev) => ({ ...prev, observations: (prev.observations || []).filter((item) => item.id !== id) }))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-3 grid place-items-center">
      <section className="bg-white rounded-3xl p-5 w-full max-w-5xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl lg:text-3xl font-black">{mode === 'edit' ? 'Editar tarefa' : 'Nova tarefa'}</h2>
            <p className="text-sm text-gray-500">Depois de cadastrar, abra o card e adicione observações sempre que precisar.</p>
          </div>
          <button onClick={onClose} className="border rounded-xl p-2"><X /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Input label="Título da tarefa" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
            <Text label="Descrição inicial" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={4} />
            <div className="grid md:grid-cols-2 gap-3">
              <Select label="Período" value={form.period} opts={periods.map((p) => p.key)} labels={{ dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' }} onChange={(v) => setForm({ ...form, period: v })} />
              <Select label="Coluna" value={form.column_key} opts={columns.map((c) => c.key)} labels={Object.fromEntries(columns.map((c) => [c.key, c.label]))} onChange={(v) => setForm({ ...form, column_key: v })} />
              <Select label="Prioridade" value={form.priority} opts={priorities} onChange={(v) => setForm({ ...form, priority: v })} />
              <Input label="Prazo" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
              <Input label="Responsável" value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} />
              <Select label="Recorrência" value={form.recurrence} opts={recurrences} onChange={(v) => setForm({ ...form, recurrence: v })} />
            </div>
            <Input label="Tags separadas por vírgula" value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="ex: compras, urgente, máquina" />
            <Text label="Checklist" value={form.checklist} onChange={(v) => setForm({ ...form, checklist: v })} rows={5} placeholder={'Uma linha por item\nUse [x] para marcar concluído'} />
          </div>

          <div className="space-y-4">
            <div>
              <b className="text-sm">Cor do card</b>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {cardColors.map((color) => (
                  <button type="button" key={color.key} onClick={() => setForm({ ...form, color: color.key })} className={`rounded-2xl border-2 px-3 py-3 font-bold ${color.cls} ${form.color === color.key ? 'ring-2 ring-black' : ''}`}>{color.label}</button>
                ))}
              </div>
            </div>

            <div className="border rounded-3xl p-4 bg-gray-50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <b>Observações da tarefa</b>
                  <p className="text-xs text-gray-500">Use para registrar atualizações depois que a tarefa já foi criada.</p>
                </div>
                <MessageSquarePlus className="text-red-600" />
              </div>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Ex: Cliente respondeu, aguardando aprovação..." className="w-full border rounded-2xl p-3" />
              <button type="button" onClick={addObservation} className="mt-2 w-full bg-gray-900 text-white rounded-2xl py-3 font-black">Adicionar observação</button>
              <div className="mt-4 space-y-2 max-h-64 overflow-auto">
                {(form.observations || []).map((item) => (
                  <div key={item.id} className="bg-white border rounded-2xl p-3">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap">{item.text}</p>
                      <button type="button" onClick={() => removeObservation(item.id)} className="text-red-700"><Trash2 size={16} /></button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}</p>
                  </div>
                ))}
                {!form.observations?.length && <p className="text-sm text-gray-500 text-center py-5">Nenhuma observação ainda.</p>}
              </div>
            </div>

            <button className="w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl py-4 font-black text-lg flex items-center justify-center gap-2"><Edit3 size={20} /> Salvar tarefa</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Kpi({ label, value, danger }) {
  return <div className={`rounded-2xl border p-4 ${danger ? 'bg-red-50 border-red-200' : 'bg-white'}`}><p className="text-sm text-gray-500 font-bold">{label}</p><b className="text-3xl">{value}</b></div>
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '' }) {
  return <label className="block"><span className="text-sm font-bold">{label}</span><input required={required} type={type} value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-red-500" /></label>
}

function Text({ label, value, onChange, rows = 3, placeholder = '' }) {
  return <label className="block"><span className="text-sm font-bold">{label}</span><textarea value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={rows} className="mt-1 w-full border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-red-500" /></label>
}

function Select({ label, value, onChange, opts, labels = {} }) {
  return <label className="block"><span className="text-sm font-bold">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border rounded-2xl p-3 outline-none focus:ring-2 focus:ring-red-500">{opts.map((o) => <option key={o} value={o}>{labels[o] || o}</option>)}</select></label>
}

createRoot(document.getElementById('root')).render(<App />)
