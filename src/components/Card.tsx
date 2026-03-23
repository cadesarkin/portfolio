interface CardProps {
  name: string
  description: string
  tag: string
  onClick: () => void
}

export default function Card({ name, description, tag, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 border border-[#c8d4e0] hover:border-[#0d0d0d] transition-colors duration-150 bg-transparent cursor-pointer"
    >
      <div className="font-bold text-[#0d0d0d] text-sm">{name}</div>
      <div className="text-[#0d0d0d] text-xs mt-1 opacity-60">{description}</div>
      <div className="text-[#0d0d0d] text-xs mt-2 opacity-35 font-light">{tag}</div>
    </button>
  )
}
