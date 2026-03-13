import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY
const WORKSPACE = 'michael-h89ju'
const WORKFLOW_ID = 'custom-workflow-8'

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const audioRef = useRef(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      setError('Could not access camera. Please allow camera permissions.')
    }
  }, [])

  useEffect(() => {
    startCamera()
  }, [])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream, showAbout])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(dataUrl)
    setResult(null)
    analyzeImage(dataUrl)
  }, [])

  const analyzeImage = async (dataUrl) => {
    setLoading(true)
    setError(null)
    try {
      const base64 = dataUrl.split(',')[1]

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

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
      clearTimeout(timeout)

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      console.log('Roboflow response:', data)

      const outputText = parseRoboflowResponse(data)
      console.log('Parsed output:', outputText)
      const isHotdog = outputText.toLowerCase().includes('yes')
      const resultType = isHotdog ? 'hotdog' : 'nothotdog'
      setResult(resultType)
      playResultAudio(resultType)
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze image. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const parseRoboflowResponse = (data) => {
    // Response format: {"outputs":[{"output_1":"Yes"}]} or {"outputs":[{"output_1":"No"}]}
    if (data?.outputs && Array.isArray(data.outputs)) {
      const first = data.outputs[0]
      if (first?.output_1) return first.output_1
      // fallback: check any string value in first output
      if (first) {
        for (const val of Object.values(first)) {
          if (typeof val === 'string') return val
        }
      }
    }
    if (Array.isArray(data)) {
      const first = data[0]
      if (first) {
        for (const val of Object.values(first)) {
          if (typeof val === 'string') return val
        }
      }
    }
    return JSON.stringify(data)
  }

  const playResultAudio = (type) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const src = type === 'hotdog' ? '/audio/hotdog.mp4' : '/audio/nothotdog.mp4'
    const audio = new Audio(src)
    audioRef.current = audio
    audio.play().catch(() => {})
  }

  const reset = () => {
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
      {/* About page - overlays on top */}
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

      {/* Main camera app - always mounted */}
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
            </div>
          )}

          {error && !capturedImage && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* New Photo button - top right, above overlay */}
        {capturedImage && result && (
          <button className="retry-btn" onClick={reset}>
            {error ? 'Try Again' : 'New Photo'}
          </button>
        )}

        {/* Capture button - bottom center */}
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
