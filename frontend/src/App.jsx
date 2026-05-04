import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Moon, Sun, RefreshCw, Bell, BellOff, MapPin, Clock,
  Phone, Globe, AlertCircle, CheckCircle2, ChevronDown,
  ChevronUp, Search, Settings, X, Loader2, Calendar,
  Heart, Navigation, Info, AlignLeft
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  })
  const set = useCallback((v) => {
    setValue(v)
    try {
      window.localStorage.setItem(key, JSON.stringify(v))
    } catch {}
  }, [key])
  return [value, set]
}

function ThemeToggle({ dark, toggle }) {
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
      style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function Badge({ children, color = 'accent' }) {
  const colors = {
    accent: 'bg-[var(--accent-light)] text-[var(--accent)]',
    success: 'bg-[var(--success-light)] text-[var(--success)]',
    warning: 'bg-[var(--warning-light)] text-[var(--warning)]',
    danger: 'bg-red-100 text-red-700',
    muted: 'bg-[var(--surface2)] text-[var(--text-muted)]',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

function PhoneHoursTable({ hours }) {
  const rows = hours.map(h => {
    const colon = h.indexOf(':')
    const day = colon > -1 ? h.slice(0, colon).trim() : h
    const times = colon > -1 ? h.slice(colon + 1).trim() : ''
    return { day, times }
  })
  return (
    <div className="w-full mt-2">
      <div className="flex items-center gap-1 mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        <Clock size={12} /> Telefonische Erreichbarkeit
      </div>
      <table className="w-full text-xs border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? '' : ''} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface2)' }}>
              <td className="py-0.5 pr-3 font-semibold whitespace-nowrap w-8" style={{ color: 'var(--text)' }}>{r.day}</td>
              <td className="py-0.5" style={{ color: 'var(--text-muted)' }}>{r.times}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SlotRow({ slot }) {
  const hasSlot = (v) => v !== null && v !== undefined && v > 0
  return (
    <div className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1">
        <span className="font-medium" style={{ color: 'var(--text)' }}>{slot.therapy}</span>
        <span className="mx-1.5" style={{ color: 'var(--text-muted)' }}>·</span>
        <span style={{ color: 'var(--text-muted)' }}>{slot.subtype}</span>
      </div>
      <div className="flex gap-2">
        {[
          { label: 'vorm.', val: slot.vormittags },
          { label: 'nachm.', val: slot.nachmittags },
          { label: 'abends', val: slot.abends },
        ].map(({ label, val }) => (
          <div key={label} className="text-center" style={{ minWidth: 48 }}>
            <div
              className="text-xs font-semibold rounded-md px-1.5 py-0.5"
              style={{
                background: hasSlot(val) ? 'var(--success-light)' : 'var(--surface2)',
                color: hasSlot(val) ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              {val === null || val === undefined ? '–' : val}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="text-right" style={{ minWidth: 32 }}>
        <Badge color="success">
          <CheckCircle2 size={10} />
          {slot.total}
        </Badge>
      </div>
    </div>
  )
}


function AlertCard({ alert, isNew }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${isNew ? 'ring-2 ring-[var(--success)]' : ''}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--text)' }}>
                {alert.name}
              </h3>
              {isNew && <Badge color="success"><Bell size={10} /> Neu</Badge>}
              <Badge color="accent">{alert.source}</Badge>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {alert.fachgebiet}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div
              className="text-xl font-bold"
              style={{ color: 'var(--success)' }}
            >
              {alert.available_slots.reduce((s, sl) => s + (sl.total || 0), 0)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>freie Plätze</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {alert.address && (
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {alert.address}
            </span>
          )}
          {alert.distance && (
            <span className="flex items-center gap-1">
              <Navigation size={13} />
              {alert.distance}
            </span>
          )}
          {alert.phone_hours && alert.phone_hours.length > 0 && (
            <PhoneHoursTable hours={alert.phone_hours} />
          )}
          {alert.phone && (
            <a
              href={`tel:${alert.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <Phone size={13} />
              {alert.phone}
            </a>
          )}
          {alert.website && (
            <a
              href={alert.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <Globe size={13} />
              Website
            </a>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors hover:opacity-80"
        style={{ background: 'var(--surface2)', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <span>
          {alert.available_slots.length} Therapieform{alert.available_slots.length !== 1 ? 'en' : ''} mit freien Plätzen
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2">
          {alert.available_slots.map((slot, i) => (
            <SlotRow key={i} slot={slot} />
          ))}
          <div className="flex gap-2 mt-3 flex-wrap">
            <a
              href={`https://arztsuche.kvbb.de/ases-kvbb/ases.jsf?t=pt&sort-by=auto&from=0&q=${encodeURIComponent(alert.name)}&size=10`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm py-2 rounded-xl font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              In KVBB-Arztsuche öffnen →
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(alert.name + ' Psychotherapeut ' + (alert.address || ''))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm py-2 px-4 rounded-xl font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Google →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function EterminAppointmentCard({ appt, bookingUrl }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--text)' }}>
                {appt.name}
              </h3>
              <Badge color="accent">eTerminservice</Badge>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{appt.practice}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>
              {appt.slots.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Termin{appt.slots.length !== 1 ? 'e' : ''}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {appt.address && (
            <span className="flex items-center gap-1"><MapPin size={13} />{appt.address}</span>
          )}
          {appt.distance && (
            <span className="flex items-center gap-1"><Navigation size={13} />{appt.distance}</span>
          )}
          <span className="flex items-center gap-1"><Calendar size={13} />{appt.date}</span>
        </div>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors hover:opacity-80"
        style={{ background: 'var(--surface2)', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        <span>{appt.slots.length} verfügbare{appt.slots.length !== 1 ? ' Zeiten' : ' Zeit'}</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {appt.slots.map((slot, j) => (
              <span key={j}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                <Clock size={11} className="inline mr-1" />{slot}
              </span>
            ))}
          </div>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 block text-center text-sm py-2 rounded-xl font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Auf eterminservice.de buchen →
          </a>
        </div>
      )}
    </div>
  )
}

function nameToColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = ((hash % 360) + 360) % 360
  const sat = 55 + (Math.abs(hash >> 8) % 20)
  return {
    bg: `hsl(${hue},${sat}%,92%)`,
    border: `hsl(${hue},${sat}%,75%)`,
    text: `hsl(${hue},${sat - 10}%,28%)`,
    pill: `hsl(${hue},${sat}%,80%)`,
  }
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']
const WEEKDAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']

function parseGermanDate(dateStr) {
  const m = dateStr.match(/(\w+),\s*(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return new Date(parseInt(m[4]), parseInt(m[3]) - 1, parseInt(m[2]))
}

function EterminCalendar({ appointments, bookingUrl }) {
  const [selected, setSelected] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)

  const allDates = appointments
    .map(a => parseGermanDate(a.date))
    .filter(Boolean)
    .sort((a, b) => a - b)

  if (allDates.length === 0) return null

  const firstDate = allDates[0]
  const monday = new Date(firstDate)
  monday.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7) + weekOffset * 7)

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const byDayKey = {}
  for (const appt of appointments) {
    const d = parseGermanDate(appt.date)
    if (!d) continue
    const k = toKey(d)
    if (!byDayKey[k]) byDayKey[k] = []
    byDayKey[k].push(appt)
  }

  const allKeys = Object.keys(byDayKey).sort()
  const firstKey = allKeys[0]
  const lastKey = allKeys[allKeys.length - 1]
  const weekKey = toKey(monday)
  const canPrev = weekOffset > 0 || weekKey > firstKey
  const canNext = toKey(weekDays[4]) < lastKey

  const todayKey = toKey(new Date())

  return (
    <div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="rounded-2xl border p-5 w-full max-w-sm shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>{selected.name}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{selected.practice}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:opacity-60" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1.5 text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {selected.address && <p className="flex items-center gap-2"><MapPin size={13} />{selected.address}</p>}
              {selected.distance && <p className="flex items-center gap-2"><Navigation size={13} />{selected.distance}</p>}
              <p className="flex items-center gap-2"><Calendar size={13} />{selected.date}</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Verfügbare Zeiten</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selected.slots.map((s, i) => {
                const c = nameToColor(selected.name)
                return (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                    {s}
                  </span>
                )
              })}
            </div>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
              className="block text-center text-sm py-2.5 rounded-xl font-semibold hover:opacity-80 transition-all"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Auf eterminservice.de buchen →
            </a>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          disabled={!canPrev}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 transition-all hover:opacity-70"
          style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
        >
          ← Vorherige Woche
        </button>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {monday.getDate()}.{monday.getMonth()+1}. – {weekDays[4].getDate()}.{weekDays[4].getMonth()+1}.{weekDays[4].getFullYear()}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          disabled={!canNext}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30 transition-all hover:opacity-70"
          style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
        >
          Nächste Woche →
        </button>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {weekDays.map((day, idx) => {
          const key = toKey(day)
          const appts = byDayKey[key] || []
          const isToday = key === todayKey
          const hasAppts = appts.length > 0
          return (
            <div key={key} className="flex flex-col min-w-0">
              <div
                className="text-center py-2 px-1 rounded-xl mb-2"
                style={{
                  background: isToday ? 'var(--accent)' : hasAppts ? 'var(--surface2)' : 'transparent',
                  border: hasAppts && !isToday ? '1px solid var(--border)' : 'none',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                  {WEEKDAYS[idx]}
                </p>
                <p className="text-lg font-bold leading-tight"
                  style={{ color: isToday ? '#fff' : hasAppts ? 'var(--text)' : 'var(--text-muted)', opacity: hasAppts ? 1 : 0.35 }}>
                  {day.getDate()}
                </p>
                <p className="text-[10px]"
                  style={{ color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', opacity: hasAppts ? 1 : 0.35 }}>
                  {String(day.getMonth()+1).padStart(2,'0')}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                {appts.length === 0 && (
                  <div className="flex-1 rounded-xl" style={{ minHeight: 40, background: 'var(--surface2)', opacity: 0.2 }} />
                )}
                {appts.map((appt, i) => {
                  const c = nameToColor(appt.name)
                  const lastName = appt.name.split(' ').filter(Boolean).slice(-1)[0]
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(appt)}
                      className="w-full text-left rounded-xl p-2.5 transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: c.bg, border: `1px solid ${c.border}` }}
                    >
                      <p className="text-xs font-bold leading-tight truncate" style={{ color: c.text }}>
                        {lastName}
                      </p>
                      <p className="text-[10px] mt-0.5 font-medium" style={{ color: c.text, opacity: 0.75 }}>
                        {appt.slots.length} Termin{appt.slots.length !== 1 ? 'e' : ''}
                      </p>
                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                        {appt.slots.slice(0, 2).map((s, j) => (
                          <span key={j} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: c.pill, color: c.text }}>{s}</span>
                        ))}
                        {appt.slots.length > 2 && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: c.pill, color: c.text }}>+{appt.slots.length - 2}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EterminCard({ result, eterminCode, eterminPLZ }) {
  const [view, setView] = useState('calendar')

  if (!result) return null
  const bookingUrl = result?.url && result.url.startsWith('http')
    ? result.url
    : 'https://www.eterminservice.de/terminservice'

  if (!result.success) {
    return (
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl shrink-0" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>eTerminservice Fehler</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{result.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const appointments = result.appointments || []
  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
          <Calendar size={22} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="font-medium" style={{ color: 'var(--text)' }}>Keine Termine verfügbar</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Im eingestellten Umkreis wurden keine PT-Sprechstunden gefunden.</p>
        <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs font-medium hover:underline"
          style={{ color: 'var(--accent)' }}>
          <Globe size={11} /> Direkt auf eterminservice.de prüfen
        </a>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={view === 'list'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'var(--surface2)', color: 'var(--text-muted)' }}
        >
          <AlignLeft size={12} /> Liste
        </button>
        <button
          onClick={() => setView('calendar')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={view === 'calendar'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'var(--surface2)', color: 'var(--text-muted)' }}
        >
          <Calendar size={12} /> Kalender
        </button>
      </div>
      {view === 'list' ? (
        <div className="space-y-3">
          {appointments.map((appt, i) => (
            <EterminAppointmentCard key={i} appt={appt} bookingUrl={bookingUrl} />
          ))}
        </div>
      ) : (
        <EterminCalendar appointments={appointments} bookingUrl={bookingUrl} />
      )}
    </div>
  )
}

function SearchConfigPanel({ config, onChange, onSearch, loading }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(config)

  const update = (key, val) => setLocal(p => ({ ...p, [key]: val }))

  const submit = () => {
    onChange(local)
    onSearch(local)
    setOpen(false)
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
        style={{ background: 'var(--surface2)', color: 'var(--text)' }}
      >
        <Settings size={15} />
        Sucheinstellungen
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div
          className="mt-2 p-5 rounded-2xl border space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Ort / PLZ
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={local.location}
                  onChange={e => update('location', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="z.B. Potsdam oder 14471"
                />
                <button
                  type="button"
                  onClick={() => geocodeLocation(local.location, update)}
                  className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80 whitespace-nowrap"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Ort suchen
                </button>
              </div>
              {local.lat && local.lng && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  ✓ Koordinaten: {local.lat.toFixed(4)}, {local.lng.toFixed(4)}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Umkreis (km)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={local.range}
                onChange={e => update('range', parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
              eTerminservice 116117 (Quelle 2)
            </h4>

            <div className="rounded-xl p-3 mb-3 text-xs space-y-1.5" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>So bekommst du deinen Vermittlungscode:</p>
              <p>1. Gehe zu <a href="https://www.eterminservice.de/terminservice" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent)' }}>eterminservice.de/terminservice</a></p>
              <p>2. Wähle <b>Ich habe keinen Vermittlungscode</b>, fülle das Formular aus (Psychotherapie, Erwachsene) und bestätige die E-Mail über den Link darin.</p>
              <p>3. Du wirst zur Suchergebnisseite weitergeleitet. Der Vermittlungscode steht dann in der URL – z.B. <code className="font-mono">eterminservice.de/terminservice/suche/<b>XXXX-XXXX-XXXX</b>/14471/W981</code>. Kopiere entweder nur den Code (<code className="font-mono">XXXX-XXXX-XXXX</code>) oder die ganze URL.</p>
              <p>Alternativ: Falls du einen Code von einer Therapeutin erhalten hast, gib ihn ein – oder kopiere gleich die ganze URL aus deinem Browser wenn du auf der Suchergebnisseite bist.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Vermittlungscode
                </label>
                <input
                  type="text"
                  value={local.eterminCode || ''}
                  onChange={e => {
                    const val = e.target.value.trim()
                    if (val.startsWith('http')) {
                      const m = val.match(/\/suche\/(.+)/)
                      if (m) {
                        const parts = m[1].split('/')
                        update('eterminCode', parts.slice(0, 3).join('/'))
                        if (parts[1]) update('eterminPLZ', parts[1])
                      } else {
                        update('eterminCode', val)
                      }
                    } else {
                      update('eterminCode', val.toUpperCase())
                    }
                  }}
                  placeholder="XXXX-XXXX-XXXX oder komplette URL"
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  PLZ (Suchort)
                </label>
                <input
                  type="text"
                  value={local.eterminPLZ || '14471'}
                  onChange={e => update('eterminPLZ', e.target.value.trim())}
                  placeholder="14471"
                  maxLength={5}
                  className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Praxen ausschließen (Blacklist)
            </label>
            <input
              type="text"
              value={local.blacklist || ''}
              onChange={e => update('blacklist', e.target.value)}
              placeholder="z.B. Demmrich, Müller (kommagetrennt)"
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Namen oder Namensbestandteile, die nicht in den Ergebnissen erscheinen sollen.</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Suche starten
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBar({ lastFetch, loading, alertCount, autoRefresh, onToggleAutoRefresh, intervalMs }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl text-xs"
      style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
    >
      <div className="flex items-center gap-1.5">
        {loading ? (
          <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
        )}
        <span>{loading ? 'Wird geladen...' : `Zuletzt: ${lastFetch || '–'}`}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={12} style={{ color: alertCount > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
        <span>{alertCount} Alert{alertCount !== 1 ? 's' : ''} gefunden</span>
      </div>

      <button
        onClick={onToggleAutoRefresh}
        className="flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
        style={{
          background: autoRefresh ? 'var(--success-light)' : 'var(--surface)',
          color: autoRefresh ? 'var(--success)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        title={`Auto-Refresh alle ${Math.round(intervalMs / 60000)} min`}
      >
        {autoRefresh ? <Bell size={11} /> : <BellOff size={11} />}
        <span>{autoRefresh ? `Auto (${Math.round(intervalMs / 60000)} min)` : 'Manuell'}</span>
      </button>
    </div>
  )
}

async function geocodeLocation(location, update) {
  if (!location.trim()) return
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=de`,
      { headers: { 'Accept-Language': 'de' } }
    )
    const data = await resp.json()
    if (data.length > 0) {
      update('lat', parseFloat(parseFloat(data[0].lat).toFixed(6)))
      update('lng', parseFloat(parseFloat(data[0].lon).toFixed(6)))
    }
  } catch {}
}

const DEFAULT_CONFIG = {
  location: 'Potsdam',
  range: 20,
  lat: 52.4009309,
  lng: 13.0591397,
  blacklist: 'Demmrich,Speyer-Danes',
  eterminCode: '',
  eterminPLZ: '14471',
}

const REFRESH_INTERVAL = 10 * 60 * 1000

const PW_HASH = '1ef65850246c85dc7ffa2f9fe8a065fce5d3069fb79fcddb3e90df1a2c6b98b7'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function PasswordGate({ children }) {
  const [storedHash, setStoredHash] = useLocalStorage('pw-token', null)
  const [unlocked, setUnlocked] = useState(() => storedHash === PW_HASH)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return children

  const handleSubmit = async (e) => {
    e.preventDefault()
    const hash = await sha256(input)
    if (hash === PW_HASH) {
      setStoredHash(hash)
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 shadow-lg"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col items-center gap-2 mb-6">
          <Heart size={32} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>TherapyAlert</h1>
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            Bitte gib das Passwort ein, um fortzufahren.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false) }}
            placeholder="Passwort"
            className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2"
            style={{
              background: 'var(--surface2)',
              borderColor: error ? 'var(--danger)' : 'var(--border)',
              color: 'var(--text)',
              ringColor: 'var(--accent)',
            }}
          />
          {error && (
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={12} /> Falsches Passwort
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Weiter
          </button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useLocalStorage('theme-dark', true)
  const [config, setConfig] = useLocalStorage('search-config', DEFAULT_CONFIG)
  useEffect(() => {
    setConfig(c => ({ ...DEFAULT_CONFIG, ...c,
      ...(c.eterminUrl && !c.eterminCode ? (() => {
        const parts = c.eterminUrl.split('/terminservice/suche/')
        const code = parts[1]?.split('/')[0]
        return code ? { eterminCode: code, eterminUrl: undefined } : {}
      })() : {})
    }))
  }, [])
  const [kvbbAlerts, setKvbbAlerts] = useState([])
  const [eterminResult, setEterminResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [eterminLoading, setEterminLoading] = useState(false)
  const [eterminProgress, setEterminProgress] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useLocalStorage('auto-refresh', false)
  const [seenIds, setSeenIds] = useLocalStorage('seen-ids', [])
  const intervalRef = useRef(null)

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [dark])

  const fetchKvbb = useCallback(async (cfg = config) => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const params = new URLSearchParams({
        location: cfg.location,
        range: cfg.range,
        lat: cfg.lat,
        lng: cfg.lng,
        ...(cfg.blacklist ? { blacklist: cfg.blacklist } : {}),
      })
      const resp = await fetch(`${API_BASE}/api/kvbb?${params}`, { signal: controller.signal })
      const data = await resp.json()
      if (data.success) {
        setKvbbAlerts(data.alerts)
        const newIds = data.alerts.map(a => `${a.name}::${a.address}`)
        setSeenIds(prev => [...new Set([...prev, ...newIds])])
      } else {
        setError(data.error || 'Unbekannter Fehler')
      }
      setLastFetch(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Zeitüberschreitung: Backend antwortet nicht. Bitte erneut versuchen.')
      } else {
        setError(`Verbindungsfehler: ${e.message}`)
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [config, setSeenIds])

  const fetchEtermin = useCallback((cfg = config) => {
    if (!cfg.eterminCode) return
    setEterminLoading(true)
    setEterminProgress({ step: 'start', pct: 5, detail: 'Browser wird gestartet…' })
    const params = new URLSearchParams({ code: cfg.eterminCode, plz: cfg.eterminPLZ || '14471', distance: cfg.range || 20 })
    const evtSource = new EventSource(`${API_BASE}/api/etermin/stream?${params}`)
    evtSource.onmessage = (e) => {
      try {
        const obj = JSON.parse(e.data)
        if (obj.done) {
          evtSource.close()
          setEterminResult(obj)
          setEterminLoading(false)
          setEterminProgress(null)
        } else {
          setEterminProgress(obj)
        }
      } catch {}
    }
    evtSource.onerror = () => {
      evtSource.close()
      setEterminResult({ success: false, error: 'Verbindungsfehler zum Backend.' })
      setEterminLoading(false)
      setEterminProgress(null)
    }
  }, [config])

  const runSearch = useCallback((cfg = config) => {
    fetchKvbb(cfg)
    fetchEtermin(cfg)
  }, [fetchKvbb, fetchEtermin, config])

  useEffect(() => {
    runSearch()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => runSearch(), REFRESH_INTERVAL)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, runSearch])

  const isNew = (alert) => !seenIds.includes(`${alert.name}::${alert.address}`)
  const newAlerts = kvbbAlerts.filter(isNew)

  return (
    <PasswordGate>
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-50 backdrop-blur-sm border-b"
        style={{ background: 'color-mix(in srgb, var(--surface) 90%, transparent)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Heart size={16} color="#fff" fill="#fff" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>TherapyAlert</h1>
              <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>Freie Therapieplätze</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => runSearch()}
              disabled={loading}
              className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
              title="Jetzt aktualisieren"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <SearchConfigPanel
          config={config}
          onChange={setConfig}
          onSearch={runSearch}
          loading={loading}
        />

        <StatusBar
          lastFetch={lastFetch}
          loading={loading || eterminLoading}
          alertCount={kvbbAlerts.length + (eterminResult?.appointments?.length || 0)}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          intervalMs={REFRESH_INTERVAL}
        />

        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-2xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Fehler beim Laden</p>
              <p className="text-sm mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        )}

        <section>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
            style={{ background: 'var(--accent-light)' }}
          >
            <div className="w-1.5 h-7 rounded-full" style={{ background: 'var(--accent)' }} />
            <div>
              <h2 className="font-bold text-base leading-tight" style={{ color: 'var(--accent)' }}>
                KVBB Arztsuche
              </h2>
              <p className="text-xs" style={{ color: 'var(--accent)', opacity: 0.7 }}>{config.location} · {config.range} km Umkreis</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {newAlerts.length > 0 && (
                <Badge color="success">
                  <Bell size={10} />
                  {newAlerts.length} neu
                </Badge>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <Loader2 size={15} className="animate-spin shrink-0" />
                <span>Alle Praxen werden gescannt – das dauert ca. 15–20 Sekunden…</span>
              </div>
              {[1, 2].map(i => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse"
                  style={{ background: 'var(--surface)' }}
                />
              ))}
            </div>
          ) : kvbbAlerts.length === 0 ? (
            <div
              className="rounded-2xl border p-8 text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--surface2)' }}>
                <Search size={22} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--text)' }}>Keine freien Plätze gefunden</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Aktuell haben alle Praxen in {config.location} im Umkreis von {config.range} km
                keine freien Einzeltherapie-Plätze für Erwachsene gemeldet.
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Aktiviere Auto-Refresh, um automatisch benachrichtigt zu werden.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {kvbbAlerts.map((alert, i) => (
                <AlertCard key={`${alert.name}-${i}`} alert={alert} isNew={isNew(alert)} />
              ))}
            </div>
          )}
        </section>

        <div className="border-t" style={{ borderColor: 'var(--border)' }} />

        <section>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
            style={{ background: 'var(--success-light)' }}
          >
            <div className="w-1.5 h-7 rounded-full" style={{ background: 'var(--success)' }} />
            <div>
              <h2 className="font-bold text-base leading-tight" style={{ color: 'var(--success)' }}>
                eTerminservice
              </h2>
              <p className="text-xs" style={{ color: 'var(--success)', opacity: 0.7 }}>116117 · {config.eterminPLZ || '14471'} · {config.range} km Umkreis</p>
            </div>
            <div className="ml-auto">
              {!config.eterminCode
                ? <Badge color="warning">Kein Code</Badge>
                : <Badge color="success">{config.eterminCode}</Badge>
              }
            </div>
          </div>

          {!config.eterminCode && !eterminLoading && !eterminResult && (
            <div className="rounded-2xl border p-5 mb-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>Vermittlungscode noch nicht eingetragen</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Öffne die Sucheinstellungen und trage deinen Vermittlungscode ein. Falls du noch keinen hast, kannst du ihn auf{' '}
                <a href="https://www.eterminservice.de/terminservice" target="_blank" rel="noopener noreferrer" className="underline font-medium" style={{ color: 'var(--accent)' }}>eterminservice.de</a>{' '}
                beantragen.
              </p>
            </div>
          )}

          {eterminLoading ? (
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 size={15} className="animate-spin shrink-0" />
                  <span className="font-medium">{eterminProgress?.detail || 'Browser wird gestartet…'}</span>
                  <span className="ml-auto font-semibold">{eterminProgress?.pct ?? 5}%</span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--accent-light)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${eterminProgress?.pct ?? 5}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
              {[1, 2].map(i => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
              ))}
            </div>
          ) : (
            <EterminCard
              result={eterminResult}
              eterminCode={config.eterminCode}
              eterminPLZ={config.eterminPLZ || '14471'}
            />
          )}
        </section>

        <footer className="pt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>TherapyAlert · Daten von KVBB Arztsuche & eTerminservice</p>
          <p className="mt-0.5">Kein Ersatz für eine direkte Kontaktaufnahme mit den Praxen</p>
        </footer>
      </main>
    </div>
    </PasswordGate>
  )
}
