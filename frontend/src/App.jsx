import { useEffect, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Banknote,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Info,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import './App.css'
import './Allocation.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const MAP_URL = '/india-state-risk.geojson'
const PAGE_SIZE = 10
const CURRENCY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const NAME_ALIASES = {
  'andaman and nicobar': 'andaman and nicobar islands',
  'dadra and nagar haveli': 'dadra and nagar haveli and daman and diu',
  'daman and diu': 'dadra and nagar haveli and daman and diu',
  'jammu and kashmir': 'jammu and kashmir',
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
}

function stateKey(value = '') {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('&', 'and').replace(/^the\s+/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  return NAME_ALIASES[normalized] || normalized
}

function money(value) {
  return value == null || !Number.isFinite(Number(value)) ? 'Not reported' : CURRENCY.format(Number(value))
}

async function loadDashboard() {
  const [statsResponse, mapResponse, allocationsResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/stats`),
    fetch(`${API_BASE_URL}/api/map`),
    fetch(`${API_BASE_URL}/api/allocations?limit=600`),
  ])
  if (![statsResponse, mapResponse, allocationsResponse].every((response) => response.ok)) {
    throw new Error('The monitoring API is unavailable. Refresh the page or check the backend service.')
  }
  const [stats, map, allocations] = await Promise.all([
    statsResponse.json(),
    mapResponse.json(),
    allocationsResponse.json(),
  ])
  return { stats, states: map.data || [], records: allocations.data || [] }
}

function outlierClass(summary) {
  if (!summary || summary.scored_count === 0) return 'map-no-data'
  if (summary.outlier_rate >= 0.12) return 'map-high'
  if (summary.outlier_count > 0) return 'map-watch'
  return 'map-clear'
}

function App() {
  const [stats, setStats] = useState(null)
  const [stateSummaries, setStateSummaries] = useState([])
  const [records, setRecords] = useState([])
  const [geoJson, setGeoJson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapError, setMapError] = useState('')
  const [activeView, setActiveView] = useState('overview')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selectedState, setSelectedState] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('model_score')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let active = true
    loadDashboard()
      .then((data) => {
        if (!active) return
        setStats(data.stats)
        setStateSummaries(data.states)
        setRecords(data.records)
        setUpdatedAt(new Date())
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load allocation data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    fetch(MAP_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Map boundary file could not be loaded.')
        return response.json()
      })
      .then((data) => { if (active) setGeoJson(data) })
      .catch((mapRequestError) => { if (active) setMapError(mapRequestError.message) })
    return () => { active = false }
  }, [])

  async function refreshData() {
    setLoading(true)
    try {
      const data = await loadDashboard()
      setStats(data.stats)
      setStateSummaries(data.states)
      setRecords(data.records)
      setUpdatedAt(new Date())
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to load allocation data.')
    } finally {
      setLoading(false)
    }
  }

  const stateLookup = new Map(stateSummaries.map((summary) => [stateKey(summary.state), summary]))
  const states = [...new Set(records.map((record) => record.state).filter(Boolean))].sort()
  const query = search.trim().toLowerCase()
  const filteredRecords = records
    .filter((record) => selectedState === 'all' || record.state === selectedState)
    .filter((record) => riskFilter === 'all' || (riskFilter === 'review' ? record.is_outlier : !record.is_outlier))
    .filter((record) => !query || [record.mp_name, record.state, record.constituency, record.allocation_id]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((left, right) => {
      const leftValue = left[sortBy] ?? 0
      const rightValue = right[sortBy] ?? 0
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue))
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const pageRecords = filteredRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const reviewStates = [...stateSummaries]
    .filter((summary) => summary.outlier_count > 0)
    .sort((left, right) => right.outlier_rate - left.outlier_rate || right.outlier_count - left.outlier_count)
  const selectedStateSummary = selectedState === 'all'
    ? null
    : stateLookup.get(stateKey(selectedState))

  function selectState(state) {
    const canonical = stateSummaries.find((summary) => stateKey(summary.state) === stateKey(state))
    if (canonical) {
      setSelectedState(canonical.state)
      setPage(0)
    }
  }

  function selectView(view) {
    setActiveView(view)
    setMobileNavOpen(false)
    setPage(0)
    if (view !== 'review') setRiskFilter('all')
    else setRiskFilter('review')
  }

  function toggleSort(field) {
    if (sortBy === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(field)
      setSortDirection(field === 'model_score' || field === 'allocated_amount' ? 'desc' : 'asc')
    }
    setPage(0)
  }

  function exportRecords() {
    const headers = ['Allocation ID', 'MP', 'Constituency', 'State', 'Allocation limit (INR)', 'Model score', 'Review flag', 'Explanation']
    const rows = filteredRecords.map((record) => [
      record.allocation_id,
      record.mp_name,
      record.constituency,
      record.state,
      record.allocated_amount,
      record.model_score,
      record.is_outlier ? 'Review outlier' : 'Not flagged',
      record.explanation,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'mplads-allocation-review.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const metricCards = [
    { label: 'MP allocation records', value: stats?.total_records?.toLocaleString('en-IN') ?? '—', note: 'Published constituency limits', icon: ClipboardList, tone: 'green' },
    { label: 'Total allocated limits', value: money(stats?.total_allocated_amount), note: 'Sum of reported limits', icon: Banknote, tone: 'blue' },
    { label: 'Outliers for review', value: stats?.review_outliers?.toLocaleString('en-IN') ?? '—', note: 'Isolation Forest · 3% review rate', icon: AlertTriangle, tone: 'orange' },
    { label: 'Missing amounts', value: stats?.missing_amounts?.toLocaleString('en-IN') ?? '—', note: 'Excluded from model scoring', icon: ShieldCheck, tone: 'violet' },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => selectView('overview')}>
          <span className="brand-mark"><Activity size={19} /></span>
          <span className="brand-copy"><strong>JAN<span>DRISHTI</span></strong><small>MPLADS ALLOCATION MONITOR</small></span>
        </a>
        <div className="workspace-label">MONITORING</div>
        <nav className="side-nav" aria-label="Main navigation">
          {[['overview', 'Overview', Activity], ['allocations', 'MP allocations', ClipboardList], ['review', 'Outlier review', AlertTriangle]].map(([id, label, Icon]) => (
            <button key={id} className={`nav-item ${activeView === id ? 'nav-item-active' : ''}`} onClick={() => selectView(id)} type="button">
              <Icon size={18} /><span>{label}</span>
              {id === 'review' && stats?.review_outliers > 0 && <span className="nav-count">{stats.review_outliers}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <div className="workspace-label">DATA SCOPE</div>
          <div className="scope-sidebar"><MapPin size={15} /><span><strong>National</strong><small>544 MP allocation limits</small></span></div>
          <div className="sidebar-version">SOURCE DATA · MPLADS PUBLIC DASHBOARD</div>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation" type="button"><Menu size={19} /></button>
          <div className="breadcrumb"><span>National oversight</span><ChevronRight size={14} /><strong>{activeView === 'review' ? 'Outlier review' : activeView === 'allocations' ? 'MP allocations' : 'Overview'}</strong></div>
          <div className="topbar-actions"><span className={`service-status ${error ? 'service-error' : ''}`}><i />{error ? 'API unavailable' : loading ? 'Updating' : 'Data loaded'}</span><span className="user-avatar">MO</span></div>
        </header>

        <main className="content-area">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> MINISTRY OF STATISTICS & PROGRAMME IMPLEMENTATION</div>
              <h1>{activeView === 'review' ? 'Allocation outlier review' : activeView === 'allocations' ? 'MP allocation register' : 'MPLADS allocation monitor'}</h1>
              <p>{activeView === 'review'
                ? 'Inspect unusually high or low reported allocation limits and review the underlying comparison.'
                : 'Explore reported allocation limits by MP, constituency, and state.'}</p>
            </div>
            <div className="heading-actions"><span className="updated-label">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data'}</span>
              <button className="button button-secondary" onClick={refreshData} disabled={loading} type="button"><RefreshCw size={15} className={loading ? 'spin' : ''} />Refresh</button>
              <button className="button button-primary" onClick={exportRecords} disabled={filteredRecords.length === 0} type="button"><Download size={15} />Export</button>
            </div>
          </section>

          <div className="scope-notice" role="note"><Info size={17} /><span><strong>Current data scope:</strong> this download contains MP allocation limits, not individual works, expenditure, payments, or progress. Model flags are statistical review signals, not fraud findings.</span></div>
          {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><div><strong>Live data unavailable</strong><span>{error}</span></div><button className="icon-button" onClick={refreshData} type="button" aria-label="Retry"><RefreshCw size={16} /></button></div>}

          {activeView === 'overview' && <>
            <section className="metrics-grid" aria-label="Allocation dataset summary">
              {metricCards.map(({ label, value, note, icon: Icon, tone }, index) => <div className={`metric-card metric-${tone}`} key={label} style={{ '--card-index': index }}><span className="metric-top"><span>{label}</span><i><Icon size={18} /></i></span><strong className="metric-value">{loading && !stats ? <span className="skeleton skeleton-value" /> : value}</strong><span className="metric-note">{note}</span></div>)}
            </section>
            <section className="insight-grid">
              <div className="panel map-panel">
                <div className="panel-heading"><div><span className="section-kicker">GEOGRAPHIC REVIEW</span><h2>Allocation outliers by state / UT</h2></div>{selectedState !== 'all' && <button className="text-action" onClick={() => setSelectedState('all')} type="button">Clear state</button>}</div>
                <div className="map-caption">Select a state to filter the register. Fill color reflects model-flagged allocation outliers.</div>
                <IndiaMap geoJson={geoJson} stateLookup={stateLookup} selectedState={selectedState} onSelectState={selectState} />
                {mapError && <div className="map-error">{mapError}</div>}
                <div className="map-legend"><span><i className="legend-clear" /> No outliers</span><span><i className="legend-watch" /> Some flagged</span><span><i className="legend-high" /> Higher flagged share</span><span><i className="legend-no-data" /> No matching record</span></div>
                <p className="map-attribution">Boundaries: geoBoundaries ADM1 · DataMeet / Election Commission of India · CC BY 2.5 IN.</p>
              </div>
              <div className="panel state-panel">
                <div className="panel-heading"><div><span className="section-kicker">STATE SUMMARY</span><h2>{selectedStateSummary?.state || 'Review queue'}</h2></div><span className="alert-total">{selectedStateSummary?.outlier_count ?? reviewStates.length}</span></div>
                <div className="state-list">{(selectedStateSummary ? [selectedStateSummary] : reviewStates.slice(0, 8)).map((summary) => <button className="state-review-row" key={summary.state} onClick={() => selectState(summary.state)} type="button"><span className={`state-swatch ${outlierClass(summary)}`} /><span className="state-review-name"><strong>{summary.state}</strong><small>{summary.record_count} allocation records</small></span><span className="state-review-count"><strong>{summary.outlier_count}</strong><small>{(summary.outlier_rate * 100).toFixed(1)}%</small></span><ChevronRight size={15} /></button>)}
                  {reviewStates.length === 0 && !loading && <div className="empty-state">No outliers were selected by the current model.</div>}
                </div>
                <button className="review-all" onClick={() => selectView('review')} type="button">Open all outlier records <ChevronRight size={15} /></button>
              </div>
            </section>
          </>}

          <section className="panel register-panel">
            <div className="register-heading">
              <div className="register-title"><div><span className="section-kicker">SOURCE REGISTER</span><h2>{activeView === 'review' ? 'Allocation limits flagged for review' : activeView === 'overview' ? 'MP allocation records' : 'All MP allocations'}</h2></div><span className="record-count">{filteredRecords.length.toLocaleString('en-IN')} records</span></div>
              <div className="filter-toolbar">
                <label className="search-field"><Search size={16} /><input aria-label="Search allocations" placeholder="Search MP, constituency, ID…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} />{search && <button onClick={() => setSearch('')} type="button" aria-label="Clear search"><X size={14} /></button>}</label>
                <label className="select-field"><MapPin size={15} /><select aria-label="Filter by state" value={selectedState} onChange={(event) => { setSelectedState(event.target.value); setPage(0) }}><option value="all">All states / UTs</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select><ChevronDown size={14} /></label>
                <div className="risk-toggle" role="group" aria-label="Filter allocation outliers">{[['all', 'All'], ['review', 'Review flags'], ['typical', 'Not flagged']].map(([value, label]) => <button key={value} className={riskFilter === value ? 'risk-toggle-active' : ''} onClick={() => { setRiskFilter(value); setPage(0) }} type="button">{label}</button>)}</div>
                <button className="icon-button filter-reset" onClick={() => { setSearch(''); setSelectedState('all'); setRiskFilter('all'); setPage(0) }} title="Clear filters" aria-label="Clear filters" type="button"><ArrowDownUp size={16} /></button>
              </div>
            </div>
            <div className="table-wrap"><table className="project-table allocation-table">
              <thead><tr><th><button onClick={() => toggleSort('mp_name')} type="button">MEMBER OF PARLIAMENT <SortIcon field="mp_name" sortBy={sortBy} direction={sortDirection} /></button></th><th><button onClick={() => toggleSort('state')} type="button">STATE / UT <SortIcon field="state" sortBy={sortBy} direction={sortDirection} /></button></th><th>CONSTITUENCY</th><th><button onClick={() => toggleSort('allocated_amount')} type="button">ALLOCATED LIMIT <SortIcon field="allocated_amount" sortBy={sortBy} direction={sortDirection} /></button></th><th><button onClick={() => toggleSort('model_score')} type="button">MODEL REVIEW <SortIcon field="model_score" sortBy={sortBy} direction={sortDirection} /></button></th><th><span className="sr-only">Open record</span></th></tr></thead>
              <tbody>{loading && records.length === 0 ? <tr><td className="table-message" colSpan="6">Loading allocation records…</td></tr>
                : pageRecords.length === 0 ? <tr><td className="table-message" colSpan="6"><ShieldCheck size={21} /><strong>No matching allocations</strong><span>Adjust your search or filters.</span></td></tr>
                    : pageRecords.map((record) => <tr key={record.allocation_id} className="project-row allocation-row" onClick={() => { setSelectedRecord(record); setSelectedState(record.state) }}><td><div className="project-name">{record.mp_name}</div><div className="project-id">Allocation record {record.allocation_id}</div></td><td><div className="jurisdiction-name">{record.state}</div></td><td><span className="representative">{record.constituency || 'Not reported'}</span></td><td><span className="amount-value">{money(record.allocated_amount)}</span></td><td><span className={`risk-pill ${record.is_outlier ? 'risk-high' : 'risk-clear'}`}><i />{record.is_outlier ? `Review · ${record.model_score.toFixed(0)}` : 'Not flagged'}</span></td><td><button className="row-open" onClick={(event) => { event.stopPropagation(); setSelectedRecord(record); setSelectedState(record.state) }} type="button" aria-label={`Inspect ${record.mp_name}`}><ChevronRight size={17} /></button></td></tr>)}
                  </tbody>
            </table></div>
            <div className="table-footer"><span>Showing <strong>{filteredRecords.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, filteredRecords.length)}</strong> of <strong>{filteredRecords.length}</strong></span><div className="pagination"><button className="icon-button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} aria-label="Previous page" type="button"><ChevronLeft size={17} /></button><span>Page {page + 1} of {pageCount}</span><button className="icon-button" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} aria-label="Next page" type="button"><ChevronRight size={17} /></button></div></div>
          </section>
          <footer className="page-footer"><span><Check size={13} /> Source dataset loaded · {stats?.scored_records ?? 0} model-scored records</span><span>Review signal only <i /> Not an audit finding</span></footer>
        </main>
      </div>

      {selectedRecord && <AllocationDrawer record={selectedRecord} geoJson={geoJson} stateLookup={stateLookup} onSelectState={selectState} onClose={() => setSelectedRecord(null)} />}
    </div>
  )
}

function SortIcon({ field, sortBy, direction }) {
  if (field !== sortBy) return <ArrowDownUp size={13} />
  return direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
}

function IndiaMap({ geoJson, stateLookup, selectedState, onSelectState, compact = false }) {
  if (!geoJson) return <div className={`map-loading ${compact ? 'map-loading-compact' : ''}`}>Loading state boundaries…</div>
  const width = 560
  const height = compact ? 300 : 490
  const projection = geoMercator().fitSize([width, height], geoJson)
  const path = geoPath(projection)
  return <svg className={`india-map ${compact ? 'india-map-compact' : ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Map of India coloured by allocation outlier review rate">
    {geoJson.features.map((feature) => {
      const boundaryName = feature.properties.shapeName || feature.properties.NAME_1
      const summary = stateLookup.get(stateKey(boundaryName))
      const selected = selectedState !== 'all' && stateKey(selectedState) === stateKey(boundaryName)
      return <path key={feature.properties.shapeID || feature.properties.ID_1 || boundaryName} d={path(feature) || ''} className={`state-shape ${outlierClass(summary)} ${selected ? 'map-selected' : ''}`} role="button" tabIndex="0" aria-label={`${boundaryName}: ${summary?.outlier_count ?? 0} outliers for review`} onClick={() => onSelectState?.(summary?.state || boundaryName)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectState?.(summary?.state || boundaryName) }}><title>{boundaryName}: {summary ? `${summary.outlier_count} review outliers of ${summary.scored_count} records` : 'No matching source record'}</title></path>
    })}
  </svg>
}

function AllocationDrawer({ record, geoJson, stateLookup, onSelectState, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const stateStats = stateLookup.get(stateKey(record.state))
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="Allocation record details">
      <div className="drawer-topline"><span>ALLOCATION RECORD · {record.allocation_id}</span><button className="icon-button" onClick={onClose} type="button" aria-label="Close details"><X size={18} /></button></div>
      <div className="drawer-content">
        <span className={`drawer-risk ${record.is_outlier ? 'drawer-risk-high' : 'drawer-risk-normal'}`}>{record.is_outlier ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}{record.is_outlier ? 'Model review outlier' : 'Not selected by model'}</span>
        <h2>{record.mp_name}</h2><p className="drawer-id">{record.constituency} · {record.state}</p>
        <div className="drawer-amount"><span>Reported allocation limit</span><strong>{money(record.allocated_amount)}</strong></div>
        <div className="detail-section"><h3>Model review evidence</h3><div className="detail-row"><span>Isolation Forest score</span><strong>{record.model_score.toFixed(2)} / 100 priority</strong></div><div className="detail-row"><span>State records</span><strong>{stateStats?.record_count ?? 'Not matched'}</strong></div><div className="detail-row"><span>State outliers</span><strong>{stateStats?.outlier_count ?? 'Not matched'}</strong></div><p className="review-explanation">{record.explanation}</p></div>
        <div className="detail-section"><h3>State / UT location</h3><IndiaMap geoJson={geoJson} stateLookup={stateLookup} selectedState={record.state} onSelectState={onSelectState} compact /></div>
        <div className="drawer-advisory"><Info size={17} /><span>The model uses allocation-limit amount only. It does not observe works, spending, payments, progress, or audited outcomes. A flag is not an allegation or finding.</span></div>
      </div>
      <div className="drawer-actions"><button className="button button-secondary" onClick={onClose} type="button">Close record</button></div>
    </aside>
  </div>
}

export default App