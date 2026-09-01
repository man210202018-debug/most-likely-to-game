export default function Background() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a1a] via-[#1a1130] to-[#0d0a1a]" />
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#b76e79]/20 blur-3xl" />
      <div className="absolute bottom-0 -left-20 w-96 h-96 rounded-full bg-[#6b3fa0]/20 blur-3xl" />
      <div className="absolute top-1/3 left-1/4 w-40 h-40 rounded-full bg-[#e5b96b]/10 blur-2xl" />
    </div>
  )
}
