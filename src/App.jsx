import { useState, useEffect, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://hernandezback.onrender.com'

// Icons como componentes
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17,8 12,3 7,8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,3 19,12 5,21 5,3" />
  </svg>
)

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12" />
  </svg>
)

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="1,4 1,10 7,10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
)

function App() {
  const [apiStatus, setApiStatus] = useState('checking')
  const [selectedFile, setSelectedFile] = useState(null)
  const [currentView, setCurrentView] = useState('upload') // upload, processing, result, error
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [stats, setStats] = useState({ fields: 0, time: 0 })
  const [errorMessage, setErrorMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const fileInputRef = useRef(null)
  const startTimeRef = useRef(null)

  // Check API health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/health`)
        setApiStatus(response.ok ? 'online' : 'offline')
      } catch {
        setApiStatus('offline')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // File handlers
  const handleFileSelect = useCallback((file) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMessage('Solo se permiten archivos Excel (.xlsx, .xls)')
      setCurrentView('error')
      return
    }
    setSelectedFile(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  // Process file
  const processFile = async () => {
    if (!selectedFile) return

    setCurrentView('processing')
    startTimeRef.current = Date.now()

    // Animate progress
    const statuses = [
      { progress: 20, text: 'Analizando estructura...' },
      { progress: 40, text: 'Extrayendo datos...' },
      { progress: 60, text: 'Aplicando transformaciones...' },
      { progress: 80, text: 'Escribiendo en plantilla...' },
      { progress: 95, text: 'Finalizando...' }
    ]

    let step = 0
    const progressInterval = setInterval(() => {
      if (step < statuses.length) {
        setProgress(statuses[step].progress)
        setProgressText(statuses[step].text)
        step++
      }
    }, 400)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${API_URL}/api/process`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error(data.detail || 'Error procesando archivo')
      }

      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1)

      setDownloadUrl(`${API_URL}/api/download/${data.download_id}`)
      setStats({ fields: data.fields_extracted, time: elapsed })
      setCurrentView('result')

    } catch (error) {
      clearInterval(progressInterval)
      setErrorMessage(error.message)
      setCurrentView('error')
    }
  }

  // Download
  const handleDownload = () => {
    if (downloadUrl) {
      window.location.href = downloadUrl
    }
  }

  // Reset
  const reset = () => {
    setSelectedFile(null)
    setDownloadUrl(null)
    setStats({ fields: 0, time: 0 })
    setProgress(0)
    setProgressText('')
    setCurrentView('upload')
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <img src="/logo.png" alt="Hernandez Bueno" />
            <div className="logo-text">
              <h1>Hernandez Bueno Sort Bot</h1>
              <span>Cuaderno de Explotación Agrícola</span>
            </div>
          </div>
          <div className={`status-badge ${apiStatus === 'online' ? '' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{apiStatus === 'online' ? 'API Conectada' : 'Sin conexión'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-card">

          {/* Upload Section */}
          {currentView === 'upload' && (
            <>
              <div
                className={`upload-zone ${isDragOver ? 'dragover' : ''} ${selectedFile ? 'has-file' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="upload-icon">
                  <UploadIcon />
                </div>
                <h2>Arrastra tu archivo Excel aquí</h2>
                <p>o haz clic para seleccionar</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
                />
                {selectedFile && (
                  <div className="file-info">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={!selectedFile}
                onClick={processFile}
              >
                <PlayIcon />
                <span>Procesar Archivo</span>
              </button>
            </>
          )}

          {/* Processing Section */}
          {currentView === 'processing' && (
            <div className="processing-section">
              <div className="loader"></div>
              <h2>Procesando...</h2>
              <p>{progressText || 'Iniciando...'}</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {/* Result Section */}
          {currentView === 'result' && (
            <div className="result-section">
              <div className="result-icon success">
                <CheckIcon />
              </div>
              <h2>¡Archivo Procesado!</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{stats.fields}</span>
                  <span className="stat-label">Campos extraídos</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">10</span>
                  <span className="stat-label">Hojas procesadas</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.time}s</span>
                  <span className="stat-label">Tiempo</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleDownload}>
                <DownloadIcon />
                <span>Descargar Excel Ordenado</span>
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                <RefreshIcon />
                <span>Procesar otro archivo</span>
              </button>
            </div>
          )}

          {/* Error Section */}
          {currentView === 'error' && (
            <div className="result-section">
              <div className="result-icon error">
                <XIcon />
              </div>
              <h2>Error al procesar</h2>
              <p className="error-message">{errorMessage}</p>
              <button className="btn btn-secondary" onClick={reset}>
                <span>Intentar de nuevo</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Features */}
      <section className="features">
        <div className="feature">
          <div className="feature-icon">
            <ShieldIcon />
          </div>
          <h3>Seguro</h3>
          <p>Tus archivos se procesan localmente</p>
        </div>
        <div className="feature">
          <div className="feature-icon">
            <ClockIcon />
          </div>
          <h3>Rápido</h3>
          <p>Procesamiento instantáneo</p>
        </div>
        <div className="feature">
          <div className="feature-icon">
            <CheckIcon />
          </div>
          <h3>Preciso</h3>
          <p>Extracción inteligente de datos</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Hernandez Bueno Sort Bot v2.0 • Cuaderno de Explotación Agrícola</p>
      </footer>
    </div>
  )
}

export default App
