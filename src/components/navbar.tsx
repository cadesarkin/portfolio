"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { SiGithub, SiLinkedin } from "react-icons/si"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

export default function Navbar() {
  const [showHover, setShowHover] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHover(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const navLinkClass = cn(
    navigationMenuTriggerStyle(),
    "bg-transparent text-white",
    showHover && "hover:bg-white/10"
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
      <div className="mx-auto max-w-7xl">
        <div className="relative flex items-center justify-between rounded-xl bg-white/5 backdrop-blur-xl backdrop-filter px-4 sm:px-6 py-3 shadow-2xl border border-white/20 overflow-hidden">
          {/* Enhanced Glass effects */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-70"></div>
          
          {/* Top highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
          
          {/* Left highlight */}
          <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/40 via-white/10 to-transparent"></div>
          
          {/* Right highlight */}
          <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-white/40 via-white/10 to-transparent"></div>
          
          {/* Bottom shadow */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent"></div>
          
          {/* Inner shadow */}
          <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_10px_rgba(255,255,255,0.15)]"></div>
          
          {/* Diagonal glare effect */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 animate-shine"></div>
          
          {/* Radial glare */}
          <div className="absolute inset-0 rounded-xl bg-radial-gradient opacity-25"></div>
          
          {/* Subtle pulsing overlay */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/5 via-transparent to-white/5 animate-[pulse_6s_ease-in-out_infinite] opacity-20"></div>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden sm:flex relative z-10">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  href="/projects"
                  className={cn(
                    navLinkClass,
                    "bg-transparent hover:bg-white/10 text-white backdrop-blur-sm",
                  )}
                >
                  Projects
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    navLinkClass,
                    "bg-transparent hover:bg-white/10 text-white backdrop-blur-sm",
                  )}
                >
                  Resume
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          {/* Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Link href="/" className="text-xl font-bold text-white">
              <span className="sr-only">CS</span>
              <div className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-br from-blue-500 to-sky-300 flex items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-lg"></div>
                <span className="text-white font-semibold text-sm whitespace-nowrap relative z-10">CS</span>
              </div>
            </Link>
          </div>

          {/* Desktop Social Icons */}
          <div className="hidden sm:flex items-center space-x-4 relative z-10">
            <Link
              href="/contact"
              className="text-white/80 hover:text-sky-400 transition-all duration-300 hover:drop-shadow-lg hover:scale-110"
            >
              <span className="sr-only">Contact</span>
              <Send className="h-5 w-5" />
            </Link>
            <Link
              href="https://linkedin.com/in/cade-sarkin-4a2918222/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-blue-400 transition-all duration-300 hover:drop-shadow-lg hover:scale-110"
            >
              <span className="sr-only">LinkedIn</span>
              <SiLinkedin className="h-5 w-5" />
            </Link>
            <Link
              href="https://github.com/cadesarkin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-gray-300 transition-all duration-300 hover:drop-shadow-lg hover:scale-110"
            >
              <span className="sr-only">GitHub</span>
              <SiGithub className="h-5 w-5" />
            </Link>
          </div>

          {/* Mobile Menu Button and Contact Icon */}
          <div className="sm:hidden flex items-center space-x-4 relative z-10">
            <Link
              href="/contact"
              className="text-white/80 hover:text-sky-400 transition-all duration-300 hover:drop-shadow-lg hover:scale-110"
            >
              <span className="sr-only">Contact</span>
              <Send className="h-4 w-4" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Open menu</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-0 right-0 mt-2 px-4">
            <div className="rounded-xl bg-black/90 backdrop-blur-xl backdrop-filter p-4 shadow-2xl border border-white/20">
              <div className="flex flex-col space-y-4">
                <Link
                  href="/projects"
                  className="text-white hover:text-sky-400 transition-all duration-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Projects
                </Link>
                <Link
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-sky-400 transition-all duration-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Resume
                </Link>
                <div className="flex space-x-4">
                  <Link
                    href="https://linkedin.com/in/cade-sarkin-4a2918222/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-blue-400 transition-all duration-300"
                  >
                    <SiLinkedin className="h-5 w-5" />
                  </Link>
                  <Link
                    href="https://github.com/cadesarkin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-gray-300 transition-all duration-300"
                  >
                    <SiGithub className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
