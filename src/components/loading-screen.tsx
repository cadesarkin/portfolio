"use client"

import { useEffect, useState } from "react"

interface LoadingScreenProps {
  onLoadingComplete: () => void
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onLoadingComplete, 500) // Additional delay for fade out animation
    }, 2500)

    return () => clearTimeout(timer)
  }, [onLoadingComplete])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="text-center">
        {/* Animated Logo */}
        <div className="relative mb-8">

          {/* Center logo */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-sky-300 rounded-lg flex items-center justify-center shadow-lg animate-bounce">
              <span className="text-white font-bold text-lg">CS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
