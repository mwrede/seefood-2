import { useState, useRef, useEffect } from 'react'
import './App.css'

const API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY
const WORKSPACE = 'michael-h89ju'
const WORKFLOW_ID = 'custom-workflow-8'

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch {
        if (!cancelled) setError('Could not access camera. Please allow camera permissions.')
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    // Capture at full res for display
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const displayUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(displayUrl)
    setResult(null)
    setError(null)

    // Resize to max 640px for API (smaller payload = faster upload)
    const maxDim = 640
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const apiDataUrl = canvas.toDataURL('image/jpeg', 0.7)

    ;(async () => {
      setLoading(true)
      try {
        const base64 = apiDataUrl.split(',')[1]
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(
          `https://serverless.roboflow.com/infer/workflows/${WORKSPACE}/${WORKFLOW_ID}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              api_key: API_KEY,
              inputs: {
                image: { type: 'base64', value: base64 },
                dog: { type: 'base64', value: base64 },
              },
            }),
          }
        )
        clearTimeout(timeoutId)

        if (!response.ok) throw new Error(`API error: ${response.status}`)

        const data = await response.json()
        console.log('Roboflow response:', data)

        // Parse: {"outputs":[{"output_1":"Yes"}]} or {"outputs":[{"output_1":"No"}]}
        let answer = ''
        if (data?.outputs?.[0]?.output_1) {
          answer = data.outputs[0].output_1
        } else {
          answer = JSON.stringify(data)
        }
        console.log('Parsed answer:', answer)

        const isHotdog = answer.toLowerCase().includes('yes')
        const resultType = isHotdog ? 'hotdog' : 'nothotdog'
        setResult(resultType)

        // Play audio
        if (audioRef.current) audioRef.current.pause()
        const audio = new Audio(isHotdog ? '/audio/hotdog.mp4' : '/audio/nothotdog.mp4')
        audioRef.current = audio
        audio.play().catch(() => {})
      } catch (err) {
        console.error('Analysis error:', err)
        const msg = err.name === 'AbortError' ? 'Request timed out. Try again.' : `Error: ${err.message}`
        setError(msg)
      } finally {
        setLoading(false)
      }
    })()
  }

  function reset() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setCapturedImage(null)
    setResult(null)
    setError(null)
  }

  return (
    <>
      {showAbout && (
        <div className="about-page">
          <div className="about-content">
            <h1 className="about-logo">
              <span className="logo-see">See</span>
              <span className="logo-food" style={{ color: '#22c55e' }}>Food</span>
            </h1>
            <p className="about-text">i like hot dog. big start up. investors maybe welcome. $2B angel round</p>
            <button className="back-btn" onClick={() => setShowAbout(false)}>Go Back</button>
          </div>
        </div>
      )}

      <div className="app" style={{ display: showAbout ? 'none' : undefined }}>
        <header className="header">
          <h1 className="logo">
            <span className="logo-see">See</span>
            <span className="logo-food">Food</span>
          </h1>
          <button className="about-link" onClick={() => setShowAbout(true)}>About</button>
        </header>

        <div className="camera-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setCameraReady(true)}
            className={`camera-feed ${capturedImage ? 'hidden' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden-canvas" />

          {capturedImage && (
            <div className="captured-view">
              <img src={capturedImage} alt="Captured" className="captured-image" />

              {loading && (
                <div className="overlay loading-overlay">
                  <div className="spinner" />
                  <p className="analyzing-text">Analyzing...</p>
                </div>
              )}

              {result === 'hotdog' && (
                <div className="overlay hotdog-overlay">
                  <div className="result-banner hotdog-banner">
                    <h2 className="result-text hotdog-text">Hotdog</h2>
                  </div>
                  <div className="result-icon-circle hotdog-circle">
                    <svg className="result-icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              )}

              {result === 'nothotdog' && (
                <div className="overlay nothotdog-overlay">
                  <div className="result-icon-circle nothotdog-circle">
                    <svg className="result-icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <div className="result-banner nothotdog-banner">
                    <h2 className="result-text nothotdog-text">Not hotdog</h2>
                  </div>
                </div>
              )}

              {error && (
                <div className="overlay error-overlay">
                  <p className="error-text">{error}</p>
                  <button className="retry-btn" onClick={reset}>Try Again</button>
                </div>
              )}
            </div>
          )}

          {error && !capturedImage && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>

        {capturedImage && result && (
          <button className="retry-btn" onClick={reset}>New Photo</button>
        )}

        {!capturedImage && (
          <div className="controls">
            <button
              className="capture-btn"
              onClick={capturePhoto}
              disabled={!cameraReady}
              aria-label="Take photo"
            >
              <div className="capture-btn-inner" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default App
