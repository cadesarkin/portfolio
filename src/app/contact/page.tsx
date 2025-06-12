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
          <div className="text-center max-w-2xl -mt-20 sm:-mt-40">
            <h1 className="text-3xl sm:text-6xl font-bold mb-6 sm:mb-8">
              <Typewriter text="Let's Connect" speed={100} show={true} />
            </h1>

            <div className="relative w-36 h-36 sm:w-48 sm:h-48 mx-auto mb-6 sm:mb-8">
              <Image
                src="/profile.jpeg"
                alt="Cade Sarkin"
                fill
                className="rounded-full object-cover"
              />
            </div>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                <Link
                  href="mailto:cadesarkin@gmail.com"
                  className="flex items-center space-x-2 text-white/80 hover:text-sky-400 transition-all duration-300 hover:scale-110"
                >
                  <HiOutlineEnvelope className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">cadesarkin@gmail.com</span>
                </Link>
                <Link
                  href="tel:+14796849353"
                  className="flex items-center space-x-2 text-white/80 hover:text-sky-400 transition-all duration-300 hover:scale-110"
                >
                  <HiOutlinePhone className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">+1 (479)-684-9353</span>
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-8">
                <Link
                  href="https://instagram.com/cadesarkin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-pink-400 transition-all duration-300 hover:scale-110"
                >
                  <SiInstagram className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">@cadesarkin</span>
                </Link>

                <Link
                  href="https://linkedin.com/in/cade-sarkin-4a2918222/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-blue-400 transition-all duration-300 hover:scale-110"
                >
                  <SiLinkedin className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">LinkedIn</span>
                </Link>

                <Link
                  href="https://github.com/cadesarkin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-white/80 hover:text-gray-300 transition-all duration-300 hover:scale-110"
                >
                  <SiGithub className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="text-base sm:text-lg">GitHub</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ASCII Fire */}
        <div className="w-full h-[150px] sm:h-[200px] absolute bottom-20 sm:bottom-40">
          <AsciiFireBackground />
        </div>
      </main>
    </div>
  )
} 