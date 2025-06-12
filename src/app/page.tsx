"use client"

import { useState } from "react"
import Navbar from "@/components/navbar"
import LoadingScreen from "@/components/loading-screen"
import Typewriter from "@/components/typewriter"
import AsciiFireBackground from "@/components/AsciiFireBackground"

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)

  const handleLoadingComplete = () => {
    setIsLoading(false)
  }

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />
  }

  return (
    <main className="min-h-screen h-screen bg-black text-white relative overflow-hidden">
      <Navbar />
      <div className="flex items-center justify-center h-full px-4 sm:-mt-80">
        <div className="text-center max-w-4xl">
          <div className="text-3xl sm:text-6xl text-sky-300 font-bold mb-4 sm:mb-6 w-full max-w-4xl mx-auto">
            <Typewriter text="Hi, my name is Cade Sarkin" speed={60} show={false} />
          </div>
          <div className="text-lg sm:text-2xl text-gray-300 mt-4 sm:mt-8 max-w-4xl">
            <Typewriter
              text="I'm a software engineer with a passion for designing cool things. My main expertise is in building full-stack web applications using Java/Spring Boot and React/Next.js."
              speed={50}
              show={true}
            />
          </div>
        </div>
      </div>
      <div className="absolute bottom-[20%] sm:bottom-[30%] left-0 right-0 h-[150px] sm:h-[200px] pointer-events-none">
        <AsciiFireBackground />
      </div>
    </main>
  )
}
