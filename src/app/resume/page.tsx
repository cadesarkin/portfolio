"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import { ChevronDown, ChevronUp } from "lucide-react"

interface DropdownSectionProps {
  children: React.ReactNode
  title: string
  delay?: number
  className?: string
}

function DropdownSection({ children, title, delay = 0, className = "" }: DropdownSectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setTimeout(() => {
            setIsVisible(true)
            setHasTriggered(true)
          }, delay)
        }
      },
      { threshold: 0.2 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [delay, hasTriggered])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      // Start typewriter animation when opening
      setTimeout(() => setShowContent(true), 100)
    } else {
      // Reset content when closing
      setShowContent(false)
    }
  }

  return (
    <div
      ref={sectionRef}
      className={`relative mb-4 sm:mb-8 transition-all duration-1000 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } ${className}`}
    >
      <div className={`relative rounded-xl ${className?.includes('ml-4') || className?.includes('ml-8') ? 'bg-white/2' : 'bg-white/5'} backdrop-blur-xl backdrop-filter px-3 sm:px-6 md:px-8 py-3 sm:py-6 shadow-2xl border border-white/20 overflow-hidden`}>
        {/* Enhanced Glass effects - matching navbar */}
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${className?.includes('ml-4') || className?.includes('ml-8') ? 'from-white/8 via-white/2' : 'from-white/20 via-white/5'} to-transparent opacity-70`}></div>
        
        {/* Top highlight */}
        <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${className?.includes('ml-4') || className?.includes('ml-8') ? 'via-white/30' : 'via-white/60'} to-transparent`}></div>
        
        {/* Left highlight */}
        <div className={`absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b ${className?.includes('ml-4') || className?.includes('ml-8') ? 'from-white/20 via-white/5' : 'from-white/40 via-white/10'} to-transparent`}></div>
        
        {/* Right highlight */}
        <div className={`absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b ${className?.includes('ml-4') || className?.includes('ml-8') ? 'from-white/20 via-white/5' : 'from-white/40 via-white/10'} to-transparent`}></div>
        
        {/* Bottom shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent"></div>
        
        {/* Inner shadow */}
        <div className={`absolute inset-0 rounded-xl ${className?.includes('ml-4') || className?.includes('ml-8') ? 'shadow-[inset_0_0_10px_rgba(255,255,255,0.08)]' : 'shadow-[inset_0_0_10px_rgba(255,255,255,0.15)]'}`}></div>
        
        {/* Diagonal glare effect */}
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-transparent ${className?.includes('ml-4') || className?.includes('ml-8') ? 'via-white/10' : 'via-white/15'} to-transparent -skew-x-12 animate-shine-slow`}></div>
        
        {/* Radial glare */}
        <div className={`absolute inset-0 rounded-xl bg-radial-gradient ${className?.includes('ml-4') || className?.includes('ml-8') ? 'opacity-10' : 'opacity-15'}`}></div>
        
        {/* Subtle pulsing overlay */}
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-t ${className?.includes('ml-4') || className?.includes('ml-8') ? 'from-white/2 via-transparent to-white/2' : 'from-white/5 via-transparent to-white/5'} animate-[pulse_8s_ease-in-out_infinite] opacity-20`}></div>

        <div className="relative z-10">
          <button
            onClick={toggleDropdown}
            className="w-full flex items-center justify-between text-left hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors duration-200"
          >
            <h2 className={`${className?.includes('ml-4') ? 'text-base sm:text-lg font-semibold text-white' : className?.includes('ml-8') ? 'text-sm sm:text-base font-medium text-gray-200' : 'text-xl sm:text-2xl font-bold text-sky-400'}`}>
              {isVisible ? <Typewriter text={title} speed={50} show={false} /> : title}
            </h2>
            <div className={`${className?.includes('ml-4') ? 'text-white' : className?.includes('ml-8') ? 'text-gray-200' : 'text-sky-400'} transition-transform duration-300`}>
              {isOpen ? <ChevronUp size={className?.includes('ml-4') || className?.includes('ml-8') ? 20 : 24} /> : <ChevronDown size={className?.includes('ml-4') || className?.includes('ml-8') ? 20 : 24} />}
            </div>
          </button>
          
          <div className={`transition-all duration-500 overflow-hidden ${
            isOpen ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}>
            <div className={`transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
              {showContent && children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TechSkillProps {
  name: string
  logoPath: string
}

function TechSkill({ name, logoPath }: TechSkillProps) {
  return (
    <div className="flex flex-col items-center p-2 sm:p-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
      <div className="w-8 h-8 sm:w-12 sm:h-12 relative mb-1 sm:mb-2">
        <Image
          src={logoPath}
          alt={`${name} logo`}
          fill
          className="object-contain"
        />
      </div>
      <span className="text-white text-xs sm:text-sm font-medium text-center leading-tight">{name}</span>
    </div>
  )
}

export default function ResumePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <Navbar />
      
      <div className="pt-24 pb-12 px-2 sm:px-4 max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            <Typewriter text="Cade Sarkin" speed={100} show={false} />
          </h1>
          <p className="text-lg sm:text-xl text-gray-300">Software Engineer</p>
        </div>

        {/* Professional Experience */}
        <DropdownSection title="PROFESSIONAL EXPERIENCE" delay={200}>
          <div className="space-y-4 text-white">
            
            {/* J.B. Hunt Transport Services */}
            <DropdownSection title="J.B. Hunt Transport Services, Inc." delay={0} className="ml-4">
              <div className="space-y-2">
                
                {/* Software Engineer II */}
                <DropdownSection title="Software Engineer II – Java" delay={0} className="ml-8">
                  <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300 list-disc pl-4 sm:pl-5">
                    <li>Spearheaded conversion of session storage to GraphQL, significantly reducing bugs and enhancing user experience, updating over 1000 JUnit tests in the process. This allows for session information to be retained over different tabs and increasing speed of fetching necessary user info by nearly 50%.</li>
                    <li>Researched and implemented solutions for critical IT issues. For example, resolving a 6-month operational issue where users couldn&apos;t book an intermodal order through the legacy systems without having to reach out to a representative.</li>
                    <li>Selected to lead key initiatives, adding OpenAPI specs and working with the business to create documentation attached to each shipment that is generated through shipment creation which allows for the customer and shipper to have more accurate information such as, shipment items, hazmat information, stop locations, etc.</li>
                    <li>Created new microservices to improve customer booking, substantially increasing booking speeds. This allows for a user to go through and find quotes before they are signed up for an account, with availability to use credit card for the first time ever, increasing company share of nationwide LTL shipping market.</li>
                    <li>Developed and optimized SQL queries and managed relational databases to improve data retrieval efficiency and fix bugs causing issues in production. Solved large database type mismatch error causing 80% down rate in Grafana testing logs, decreasing this number back to below 10%.</li>
                  </ul>
                </DropdownSection>

                {/* Software Engineer I */}
                <DropdownSection title="Software Engineer I – Java" delay={0} className="ml-8">
                  <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300 list-disc pl-4 sm:pl-5">
                    <li>Member on a team of software engineers working on a customer facing application using microservices that handle hundreds of thousands of requests daily to allow customers to book, track, and pay for shipments throughout North America via truckload or intermodal, using Java in Spring Boot.</li>
                    <li>Applied my knowledge of Spring Boot applications and Java to mitigate over 300 Common Vulnerabilities and Exposures and update over 20 microservices to Spring Boot 3.x in the process.</li>
                    <li>Optimized Location Services, enhancing booking accuracy and customer satisfaction. Eliminated bugs which had led to booking failures and quit outs of attempted bookings by implementing a Regular Expression solution to be able to take a query with a city, state, country, and zip and associate them to the correct type to find locations faster than before through Google saved locations and fuzzy search.</li>
                  </ul>
                </DropdownSection>

                {/* Team Lead Internship */}
                <DropdownSection title="Engineering/IT Internship – Team Lead – JavaScript" delay={0} className="ml-8">
                  <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300 list-disc pl-4 sm:pl-5">
                    <li>Led a team of engineers in applying Agile methodologies to streamline system updates.</li>
                    <li>Applied Agile project management principles, coordinated meetings with managers, scheduled work for team and led internal presentations.</li>
                  </ul>
                </DropdownSection>

                {/* Regular Internship */}
                <DropdownSection title="Engineering/IT Internship – JavaScript" delay={0} className="ml-8">
                  <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300 list-disc pl-4 sm:pl-5">
                    <li>Collaborated on a 5-person team converting Excel pivot tables to J.B. Hunt-data grids on Carrier 360 load board simulation app.</li>
                    <li>The group completed 11 conversions. Each conversion was budgeted at one-month of man-hours.</li>
                    <li>Personally completed 4 conversions in one month and presented results to an audience of more than 200 participants including the Chief Information Officer.</li>
                  </ul>
                </DropdownSection>

              </div>
            </DropdownSection>

            {/* AD VANCE */}
            <DropdownSection title="AD VANCE | www.vance-ad.com" delay={0} className="ml-4">
              <div className="space-y-2">
                
                <DropdownSection title="Website Developer and Co-Owner" delay={0} className="ml-8">
                  <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-300 list-disc pl-4 sm:pl-5">
                    <li>Created the website for a designer clothing brand and work closely on technical and business-related operations.</li>
                    <li>In charge of changes on the website and keeping it up to date with current products, brand information, and any rebranding that may happen.</li>
                    <li>Website created with Squarespace with additional custom coding using JavaScript, CSS, and HTML.</li>
                    <li>New site under construction using React/Next.js with Stripe API and Vercel deployment</li>
                  </ul>
                </DropdownSection>

              </div>
            </DropdownSection>

          </div>
        </DropdownSection>

        {/* Technical Skills */}
        <div className="relative mb-4 sm:mb-8 transition-all duration-1000 transform opacity-100 translate-y-0">
          <div className="relative rounded-xl bg-white/5 backdrop-blur-xl backdrop-filter px-3 sm:px-6 md:px-8 py-3 sm:py-6 shadow-2xl border border-white/20 overflow-hidden">
            {/* Enhanced Glass effects - matching navbar */}
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

            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-sky-400 mb-3 sm:mb-4">
                <Typewriter text="TECHNICAL SKILLS" speed={50} show={false} />
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {/* Backend */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-sky-300 mb-2 sm:mb-3">Backend</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-4">
                    <TechSkill name="Java" logoPath="/java-logo.png" />
                    <TechSkill name="Spring Boot" logoPath="/spring-boot.png" />
                    <TechSkill name="C++" logoPath="/c-logo.png" />
                    <TechSkill name="Python" logoPath="/python-logo.png" />
                    <TechSkill name="SQL" logoPath="/sql-logo.png" />
                  </div>
                </div>

                {/* Frontend */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-sky-300 mb-2 sm:mb-3">Frontend</h4>
                  <div className="grid grid-cols-4 gap-2 sm:gap-4">
                    <TechSkill name="JavaScript" logoPath="/javascript-logo.png" />
                    <TechSkill name="TypeScript" logoPath="/typescript-logo.webp" />
                    <TechSkill name="React" logoPath="/react-logo.png" />
                    <TechSkill name="Next.js" logoPath="/nextjs-logo.png" />
                  </div>
                </div>

                {/* Tools & Technologies */}
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-sky-300 mb-2 sm:mb-3">Tools & Technologies</h4>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <TechSkill name="Docker" logoPath="/docker-logo.png" />
                    <TechSkill name="GraphQL" logoPath="/graphql-logo.png" />
                    <TechSkill name="Git" logoPath="/git-logo.png" />
                    <TechSkill name="Azure" logoPath="/azure-logo.png" />
                    <TechSkill name="REST API" logoPath="/rest-logo.png" />
                    <TechSkill name="Cursor" logoPath="/cursor-logo.png" />
                    <TechSkill name="JUnit" logoPath="/junit-logo.png" />
                    <TechSkill name="Postman" logoPath="/postman-logo.webp" />
                    <TechSkill name="Vercel" logoPath="/vercel-logo.png" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Education */}
        <DropdownSection title="EDUCATION" delay={600}>
          <div className="space-y-4 sm:space-y-6 text-white">
            {/* University of Kansas */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-sky-300 mb-2">The University of Kansas | Lawrence, Kansas</h3>
              <h4 className="text-base sm:text-lg font-medium text-white mb-2 sm:mb-3">B.S. in Computer Science and Engineering</h4>
              
              <div className="mt-4">
                <h5 className="text-base sm:text-lg font-medium text-sky-300 mb-2">University of Kansas SELF Engineering Leadership Fellow</h5>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">One of 27 (from freshman class of 500) selected to program whose mission is to develop the personal attributes, leadership skills and vision in young engineers displaying an entrepreneurial aptitude, to prepare for future business leadership opportunities.</p>
              </div>
            </div>

            {/* UCLA */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-sky-300 mb-2">University of California Los Angeles (UCLA)</h3>
              <h4 className="text-base sm:text-lg font-medium text-white">NanoSystems Institute Summer Workshop</h4>
            </div>

            {/* Stanford */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-sky-300 mb-2">Stanford University | Palo Alto CA</h3>
              <h4 className="text-base sm:text-lg font-medium text-white">Programming Methodology</h4>
            </div>
          </div>
        </DropdownSection>
      </div>
    </div>
  )
}
