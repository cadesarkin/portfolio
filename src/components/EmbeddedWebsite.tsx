"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"

interface EmbeddedWebsiteProps {
  url: string
  fallbackImage?: string
  fallbackButtonImage?: string
  className?: string
  title?: string
}

export default function EmbeddedWebsite({ 
  url, 
  fallbackImage = "/vance_photo.jpg", 
  fallbackButtonImage = "/vance_button.png",
  className = "",
  title = "Embedded Website"
}: EmbeddedWebsiteProps) {
  const [isBlocked, setIsBlocked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showNavigationHint, setShowNavigationHint] = useState(false)

  useEffect(() => {
    // Set a timeout to detect if iframe fails to load
    const timer = setTimeout(() => {
      setIsLoading(false)
      // Show navigation hint after iframe loads
      setTimeout(() => setShowNavigationHint(true), 2000)
    }, 3000) // Wait 3 seconds before showing fallback

    return () => clearTimeout(timer)
  }, [])

  const handleIframeError = () => {
    setIsBlocked(true)
    setIsLoading(false)
  }

  const handleIframeLoad = () => {
    setIsLoading(false)
    // Additional check for X-Frame-Options
    try {
      // This will throw an error if the iframe is blocked
      const iframe = document.querySelector('iframe')
      if (iframe?.contentWindow) {
        // If we can access contentWindow, it's likely working
        setIsBlocked(false)
      }
    } catch {
      setIsBlocked(true)
    }
  }

  if (isBlocked || (isLoading && isBlocked)) {
    // Fallback to original image/button design
    return (
      <div className={`relative ${className}`}>
        {fallbackImage && (
          <Image
            src={fallbackImage}
            alt={title}
            fill
            style={{ objectFit: 'cover' }}
            className="rounded-lg"
          />
        )}
        <Link 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="absolute inset-0 flex items-center justify-center"
        >
          {fallbackButtonImage && (
            <Image
              src={fallbackButtonImage}
              alt="Visit Website"
              width={200}
              height={200}
              className="hover:scale-105 transition-transform duration-200 cursor-pointer"
            />
          )}
        </Link>
        {/* Overlay text indicating external link */}
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
          External Site
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 rounded-lg z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
            <p>Loading website...</p>
          </div>
        </div>
      )}
      
      <iframe
        src={url}
        className="w-full h-full rounded-lg border-0"
        title={title}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads"
        allow="fullscreen; geolocation; microphone; camera; payment; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          border: 'none',
          background: 'transparent'
        }}
      />
      
      {/* Navigation hint overlay */}
      {showNavigationHint && !isLoading && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 text-white p-3 rounded-lg text-sm z-20">
          <p className="mb-2">💡 <strong>Navigation Tip:</strong> Some actions may be limited in embedded view.</p>
          <Link 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-block bg-sky-600 hover:bg-sky-700 px-3 py-1 rounded text-white transition-colors"
            onClick={() => setShowNavigationHint(false)}
          >
            Open Full Site ↗
          </Link>
          <button 
            onClick={() => setShowNavigationHint(false)}
            className="ml-2 text-gray-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overlay with external link indicator */}
      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm z-20">
        <Link href={url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400">
          Open in New Tab ↗
        </Link>
      </div>
    </div>
  )
}
