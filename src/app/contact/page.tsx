"use client"

import Image from "next/image"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import AsciiFireBackground from "@/components/AsciiFireBackground"
import { SiGithub, SiInstagram, SiLinkedin } from "react-icons/si"
import { HiOutlineEnvelope, HiOutlinePhone } from "react-icons/hi2"

export default function Contact() {
  return (
    <div className="relative w-full bg-black h-screen overflow-hidden">
      <main className="h-screen text-white relative w-full">
        <Navbar />
        <div className="flex items-center justify-center h-full px-4">
          <div className="text-center max-w-2xl -mt-40">
            <h1 className="text-4xl md:text-6xl font-bold mb-8">
              <Typewriter text="Let's Connect" speed={100} show={true} />
            </h1>

            <div className="relative w-48 h-48 mx-auto mb-8">
              <Image
                src="/profile.jpeg"
                alt="Cade Sarkin"
                fill
                className="rounded-full object-cover"
              />
            </div>
            
            <div className="space-y-6 text-lg">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Link
                  href="mailto:cadesarkin@gmail.com"
                  className="flex items-center space-x-2 text-white/80 hover:text-sky-400 transition-all duration-300 hover:scale-110"
                >
                  <HiOutlineEnvelope className="h-6 w-6" />
                  <span>cadesarkin@gmail.com</span>
                </Link>
                <Link
                  href="tel:+14796849353"
                  className="flex items-center space-x-2 text-white/80 hover:text-sky-400 transition-all duration-300 hover:scale-110"
                >
                  <HiOutlinePhone className="h-6 w-6" />
                  <span>+1 (479)-684-9353</span>
                </Link>
              </div>

              <div className="flex items-center justify-center space-x-8">
                <Link
                  href="https://instagram.com/cadesarkin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-pink-400 transition-all duration-300 hover:scale-110"
                >
                  <SiInstagram className="h-6 w-6" />
                  <span>@cadesarkin</span>
                </Link>

                <Link
                  href="https://linkedin.com/in/cade-sarkin-4a2918222/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-blue-400 transition-all duration-300 hover:scale-110"
                >
                  <SiLinkedin className="h-6 w-6" />
                  <span>LinkedIn</span>
                </Link>

                <Link
                  href="https://github.com/cadesarkin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-gray-300 transition-all duration-300 hover:scale-110"
                >
                  <SiGithub className="h-6 w-6" />
                  <span>GitHub</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ASCII Fire */}
        <div className="w-full h-[200px] absolute bottom-40">
          <AsciiFireBackground />
        </div>
      </main>
    </div>
  )
} 