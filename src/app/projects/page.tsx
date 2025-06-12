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
        <div className="flex items-center justify-center h-full px-4 -mt-40">
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto -mt-40">
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
        
        {/* More to come text */}
        <div className="w-full text-center text-2xl absolute bottom-[25%]">
          <Typewriter text="More to come..." speed={100} show={true} />
        </div>

        {/* ASCII Fire */}
        <div className="w-full h-[200px] absolute bottom-0">
          <AsciiFireBackground />
        </div>
      </main>
    </div>
  )
} 