"use client"

import { useState, useEffect } from "react"

interface TypewriterProps {
  text: string
  speed?: number
  show?: boolean
  showMobile?: boolean
}

export default function Typewriter({ text, speed, show, showMobile = true }: TypewriterProps) {
    const [displayedText, setDisplayedText] = useState("")
    const [currentIndex, setCurrentIndex] = useState(0)
    const [showCursor, setShowCursor] = useState(true)
  
    useEffect(() => {
      // Typing animation
      if (currentIndex < text.length) {
        const timeout = setTimeout(() => {
          setDisplayedText((prev) => prev + text[currentIndex])
          setCurrentIndex((prev) => prev + 1)
        }, speed || 100) // Default speed if not provided
  
        return () => clearTimeout(timeout)
      }
    }, [currentIndex, text, speed])
  
    useEffect(() => {
      // Blinking cursor animation
      const cursorInterval = setInterval(() => {
        setShowCursor((prev) => !prev)
      }, 500) // Cursor blink speed
  
      return () => clearInterval(cursorInterval)
    }, [])
  
    
    return (
      <span>
        {displayedText}
        {show && (
          <span className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity duration-100 ${!showMobile ? "hidden sm:inline" : ""}`}>█</span>
        )}
      </span>
    )
  }
