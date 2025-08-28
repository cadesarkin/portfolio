"use client"

import Image from "next/image"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import AsciiFireBackground from "@/components/AsciiFireBackground"
import EmbeddedWebsite from "@/components/EmbeddedWebsite"

export default function Projects() {


  return (
    <div className="relative w-full h-screen overflow-hidden">
      <main className="h-screen text-white relative w-full">
        <Navbar />
        {/* Mobile Layout */}
        <div className="sm:hidden flex flex-col items-center justify-center h-full px-4 space-y-6 pt-28 pb-32">
          {/* Title image */}
          <div className="flex justify-center">
            <Image
              src="/vance_button.png"
              alt="Vance Logo"
              width={120}
              height={120}
              className="object-contain"
            />
          </div>
          
          {/* Embedded Website */}
          <div className="w-full max-w-lg h-[400px]">
            <EmbeddedWebsite
              url="https://vance-ad.com"
              title="Vance AD Website"
              className="w-full h-full"
              fallbackImage="/vance_photo.jpg"
              fallbackButtonImage="/vance_button.png"
            />
          </div>
          
          {/* More to come text */}
          <div className="text-xl text-center">
            <Typewriter text="More to come..." speed={100} show={true} showMobile={false} />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-center h-full px-4 -mt-32 pb-32">
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto gap-8">
            {/* Left side - Logo */}
            <div className="flex-shrink-0 flex justify-center">
              <Image
                src="/vance_button.png"
                alt="Vance Logo"
                width={200}
                height={200}
                className="object-contain"
              />
            </div>
            
            {/* Right side - Embedded Website (larger) */}
            <div className="flex-1 h-[600px] max-w-4xl">
              <EmbeddedWebsite
                url="https://vance-ad.com"
                title="Vance AD Website"
                className="w-full h-full"
                fallbackImage="/vance_photo.jpg"
                fallbackButtonImage="/vance_button.png"
              />
            </div>
          </div>
        </div>

        {/* More to come text (Desktop) */}
        <div className="hidden sm:block w-full text-center text-2xl absolute bottom-[25%]">
          <Typewriter text="More to come..." speed={100} show={true} />
        </div>

        {/* ASCII Fire */}
        <div className="w-full h-[120px] sm:h-[150px] absolute bottom-0 sm:bottom-10">
          <AsciiFireBackground />
        </div>
      </main>
    </div>
  )
} 