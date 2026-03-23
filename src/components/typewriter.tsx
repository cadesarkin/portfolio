"use client"

import { useState, useEffect, useRef } from "react"

interface TypewriterProps {
  text: string
  speed?: number
  show?: boolean
  showMobile?: boolean
  onComplete?: () => void
}

export default function Typewriter({
  text,
  speed,
  show,
  showMobile = true,
  onComplete,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed ?? 100)
      return () => clearTimeout(timeout)
    } else if (onComplete && !completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)
    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <span>
      {displayedText}
      {show && (
        <span
          className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity duration-100 ${
            !showMobile ? "hidden sm:inline" : ""
          }`}
        >
          █
        </span>
      )}
    </span>
  )
}
