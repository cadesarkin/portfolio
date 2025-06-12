"use client"

import { useState, useEffect } from "react"

interface TypewriterProps {
  text: string
  speed?: number
  show?: boolean
}

export default function Typewriter({ text, speed, show }: TypewriterProps) {
    const [displayedText, setDisplayedText] = useState("")
    const [currentIndex, setCurrentIndex] = useState(0)
    const [showCursor, setShowCursor] = useState(true)
  
    useEffect(() => {
      // Typing animation
      if (currentIndex < text.length) {
        const timeout = setTimeout(() => {
          setDisplayedText((prev) => prev + text[currentIndex])
          setCurrentIndex((prev) => prev + 1)
        }, speed) // Adjust typing speed here (lower = faster)
  
        return () => clearTimeout(timeout)
      }
    }, [currentIndex])
  
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
          <span className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity duration-100`}>█</span>
        )}
      </span>
    )
  }
