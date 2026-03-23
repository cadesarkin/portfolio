"use client"

import { useState, useEffect, useRef } from "react"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import Card from "@/components/Card"
import ProjectModal from "@/components/ProjectModal"

interface ModalData {
  title: string
  description: string
  type: "work" | "project"
  liveUrl?: string
  githubUrl?: string
}

const workItems: (ModalData & { tag: string; cardDescription: string })[] = [
  {
    title: "vance",
    cardDescription: "clothing brand website",
    tag: "[client]",
    type: "work",
    liveUrl: "https://vance-ad.com",
    description:
      "Website for Vance, a designer clothing brand. Built with custom JavaScript, CSS, and HTML. New site under construction with React/Next.js and Stripe.",
  },
  {
    title: "dreamhouse",
    cardDescription: "interior design studio website",
    tag: "[client]",
    type: "work",
    liveUrl: "https://dreamhouse.nyc",
    description: "Website for Dreamhouse, an interior design studio based in New York City.",
  },
]

const projectItems: (ModalData & { tag: string; cardDescription: string })[] = [
  {
    title: "three.js portfolio",
    cardDescription: "3d graphics experiments",
    tag: "[personal]",
    type: "project",
    githubUrl: "https://github.com/cadesarkin/threejs-learning-portfolio",
    liveUrl: "https://threejs-learning-portfolio.vercel.app",
    description:
      "A collection of 3D graphics experiments built while learning Three.js. Explores lighting, geometry, animation, and shader techniques.",
  },
  {
    title: "matchplay",
    cardDescription: "golf scorecard app",
    tag: "[in progress]",
    type: "project",
    githubUrl: "https://github.com/cadesarkin/matchplay",
    description: "golf scorecard app. currently in development.",
  },
]

export default function Home() {
  // Hero typewriter sequencing
  const [line1Done, setLine1Done] = useState(false)
  const [showLine2, setShowLine2] = useState(false)

  useEffect(() => {
    if (line1Done) {
      const t = setTimeout(() => setShowLine2(true), 400)
      return () => clearTimeout(t)
    }
  }, [line1Done])

  // Contact section IntersectionObserver
  const contactRef = useRef<HTMLDivElement>(null)
  const [contactStarted, setContactStarted] = useState(false)

  useEffect(() => {
    const el = contactRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setContactStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Modal state
  const [modal, setModal] = useState<ModalData | null>(null)

  return (
    <>
      <Navbar />

      <main className="max-w-2xl mx-auto px-6">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="min-h-screen flex flex-col justify-center py-32">
          <div className="text-lg sm:text-2xl leading-relaxed">
            <div>
              <Typewriter
                text="> hi, i'm cade sarkin"
                speed={60}
                show={!line1Done}
                onComplete={() => setLine1Done(true)}
              />
            </div>
            {showLine2 && (
              <div className="mt-2 text-base sm:text-lg opacity-60">
                <Typewriter
                  text="software engineer. java/spring boot + react/next.js."
                  speed={40}
                  show={true}
                />
              </div>
            )}
          </div>
        </section>

        {/* ─── Work ─────────────────────────────────────────────── */}
        <section id="work" className="py-20">
          <div className="text-xs text-[#0d0d0d] opacity-40 mb-6 font-light tracking-wider">
            $ ls ./work
          </div>
          <div className="flex flex-col gap-3">
            {workItems.map((item) => (
              <Card
                key={item.title}
                name={item.title}
                description={item.cardDescription}
                tag={item.tag}
                onClick={() =>
                  setModal({
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    liveUrl: item.liveUrl,
                    githubUrl: item.githubUrl,
                  })
                }
              />
            ))}
          </div>
        </section>

        {/* ─── Projects ─────────────────────────────────────────── */}
        <section id="projects" className="py-20">
          <div className="text-xs text-[#0d0d0d] opacity-40 mb-6 font-light tracking-wider">
            $ ls ./projects
          </div>
          <div className="flex flex-col gap-3">
            {projectItems.map((item) => (
              <Card
                key={item.title}
                name={item.title}
                description={item.cardDescription}
                tag={item.tag}
                onClick={() =>
                  setModal({
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    liveUrl: item.liveUrl,
                    githubUrl: item.githubUrl,
                  })
                }
              />
            ))}
          </div>
        </section>

        {/* ─── Contact ──────────────────────────────────────────── */}
        <section id="contact" className="py-20 pb-32" ref={contactRef}>
          <div className="text-lg sm:text-xl mb-8">
            {contactStarted ? (
              <Typewriter text="> let's connect" speed={80} show={false} />
            ) : (
              <span className="opacity-0 select-none">&gt; let&apos;s connect</span>
            )}
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <a
              href="mailto:sarkincade@gmail.com"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              sarkincade@gmail.com
            </a>
            <a
              href="tel:+14796849353"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              +1 (479) 684-9353
            </a>
            <a
              href="https://github.com/cadesarkin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              github.com/cadesarkin
            </a>
            <a
              href="https://linkedin.com/in/cade-sarkin-4a2918222/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              linkedin.com/in/cade-sarkin
            </a>
          </div>
        </section>
      </main>

      {/* ─── Modal ────────────────────────────────────────────── */}
      {modal && (
        <ProjectModal
          title={modal.title}
          description={modal.description}
          type={modal.type}
          liveUrl={modal.liveUrl}
          githubUrl={modal.githubUrl}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
