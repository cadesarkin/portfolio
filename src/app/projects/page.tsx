"use client"

import Image from "next/image"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import AsciiFireBackground from "@/components/AsciiFireBackground"

export default function Projects() {


  return (
    <div className="relative w-full bg-black h-screen overflow-hidden">
      <main className="h-screen text-white relative w-full">
        <Navbar />
        {/* Mobile Layout */}
        <div className="sm:hidden flex flex-col items-center justify-center h-full px-4 space-y-8">
          {/* Title text */}
          <div className="text-4xl font-bold text-center">
            <Typewriter text="VANCE" speed={100} show={false} showMobile={false} />
          </div>
          
          {/* Image with button overlay */}
          <div className="relative w-full max-w-lg aspect-[4/3]">
            <Image
              src="/vance_photo.jpeg"
              alt="Vance Project"
              fill
              style={{ objectFit: 'cover' }}
              className="rounded-lg"
            />
            <Link href="https://vance-ad.com" target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/vance_button.png"
                alt="Vance Button"
                width={150}
                height={150}
                className="hover:scale-105 transition-transform duration-200 cursor-pointer"
              />
            </Link>
          </div>
          
          {/* More to come text */}
          <div className="text-xl text-center">
            <Typewriter text="More to come..." speed={100} show={true} showMobile={false} />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-center h-full px-4 -mt-40">
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
            {/* Left side - Text */}
            <div className="flex-1 text-4xl md:text-6xl font-bold">
              <Typewriter text="ad vance" speed={100} show={false} />
            </div>
            
            {/* Right side - Image with button overlay */}
            <div className="flex-1 relative h-[500px]">
              <Image
                src="/vance_photo.jpeg"
                alt="Vance Project"
                fill
                style={{ objectFit: 'cover' }}
                className="rounded-lg"
              />
              <Link href="https://vance-ad.com" target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center">
                <Image
                  src="/vance_button.png"
                  alt="Vance Button"
                  width={200}
                  height={200}
                  className="hover:scale-105 transition-transform duration-200 cursor-pointer"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* More to come text (Desktop) */}
        <div className="hidden sm:block w-full text-center text-2xl absolute bottom-[20%]">
          <Typewriter text="More to come..." speed={100} show={true} />
        </div>

        {/* ASCII Fire */}
        <div className="w-full h-[120px] sm:h-[150px] absolute bottom-10 sm:bottom-10">
          <AsciiFireBackground />
        </div>
      </main>
    </div>
  )
} 