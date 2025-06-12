"use client"

import { useEffect, useRef } from 'react'

interface FireConfig {
  selector: string
  animation_fps: number
  autoplay: boolean
  loop: boolean
  font_size_vw: number
  letter_spacing_vw: number
  line_height_vw: number
  text_color: string
  char_bg_color?: string
}

export default function AsciiFireBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const config: FireConfig = {
      selector: '#fire-canvas',
      animation_fps: 12,
      autoplay: true,
      loop: true,
      font_size_vw: 1.5,
      letter_spacing_vw: 0.8,
      line_height_vw: 1.2,
      text_color: '#7dd3fc'
    }

    let loaded = false
    let asciiData: string[][] = []
    let fireIndex = 0
    let then = Date.now()
    const fpsInterval = 1000 / config.animation_fps
    let oneVw = 0
    let ctx: CanvasRenderingContext2D | null = null

    const calculateSizes = () => {
      if (!canvasRef.current) return
      
      oneVw = window.innerWidth < 800 
        ? window.innerWidth / 50 
        : window.innerWidth / 100

      ctx = fixDpi(canvasRef.current)
      if (ctx) {
        ctx.font = `${oneVw * config.font_size_vw}px 'Courier New'`
      }
    }

    const fixDpi = (canvas: HTMLCanvasElement) => {
      const parentWidth = window.innerWidth
      const parentHeight = window.innerHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      const dpr = window.devicePixelRatio || 1
      const ratio = dpr

      canvas.style.width = parentWidth + 'px'
      canvas.style.height = parentHeight + 'px'
      canvas.width = parentWidth * ratio
      canvas.height = parentHeight * ratio
      ctx.scale(ratio, ratio)

      return ctx
    }

    const playNextFrame = () => {
      if (!ctx || !canvasRef.current) return

      if (fireIndex >= asciiData.length) {
        if (config.loop) fireIndex = 0
        else return
      }

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

      const frame = asciiData[fireIndex]
      const characterWidth = config.letter_spacing_vw + 0.53
      const charWidthVw = oneVw * characterWidth
      const charHeightVw = oneVw * config.line_height_vw

      frame.forEach((line, i) => {
        const chars = line.split('')
        chars.forEach((char, x) => {
          if (char !== ' ') {
            if (config.char_bg_color) {
              ctx!.fillStyle = config.char_bg_color
              ctx!.fillRect(
                x * charWidthVw,
                (i - 1) * charHeightVw,
                charWidthVw,
                oneVw * config.line_height_vw
              )
            }
            ctx!.fillStyle = config.text_color
            ctx!.fillText(char, x * charWidthVw, i * (oneVw * config.line_height_vw))
          }
        })
      })

      fireIndex++
    }

    const animate = () => {
      if (!loaded) return
      
      requestAnimationFrame(animate)

      const now = Date.now()
      const elapsed = now - then

      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval)
        playNextFrame()
      }
    }

    // Initialize
    const init = async () => {
      calculateSizes()
      window.addEventListener('resize', calculateSizes)

      try {
        const response = await fetch('/hero-fire.json')
        const data = await response.text()
        asciiData = data.split('---').map(frame => frame.split('\n'))
        loaded = true
        
        if (config.autoplay) {
          then = Date.now()
          animate()
        }
      } catch (err) {
        console.error('Failed to load ASCII data:', err)
      }
    }

    init()

    return () => {
      window.removeEventListener('resize', calculateSizes)
    }
  }, [])

  return (
    <canvas
      id="fire-canvas"
      ref={canvasRef}
      className="w-full h-full"
    />
  )
} 