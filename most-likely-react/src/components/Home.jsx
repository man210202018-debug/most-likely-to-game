export default function Home({ onSelect }) {
  const games = [
    {
      id: 'mlt',
      emoji: '🙋',
      title: 'مين أكتر واحد فينا؟',
      desc: 'شوفوا مين فيكم الأكتر في كل حاجة!',
      grad: 'from-rose-soft/30 to-violet-deep/20',
      border: 'border-rose-main/40',
      active: true,
    },
    {
      id: 'tod',
      emoji: '🎭',
      title: 'صراحة ولا تحدي؟',
      desc: 'أسئلة صراحة وتحديات واتعرفوا أكتر',
      grad: 'from-gold-light/30 to-rose-soft/20',
      border: 'border-gold-gold/40',
      active: true,
    },
    {
      id: 'soon',
      emoji: '🔮',
      title: 'لعبني تعرفني',
      desc: 'قريباً جداً!',
      grad: 'from-violet-soft/30 to-bgdark-2',
      border: 'border-violet-soft/30',
      active: false,
    },
  ]

  return (
    <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">💗</div>
        <h1 className="shuruq-title text-6xl font-bold leading-tight">شروقتي</h1>
        <p className="text-white/50 text-sm mt-2">لعبة للأحبة العبوا مع بعض 💕</p>
      </div>

      <div className="flex flex-col gap-4">
        {games.map((g) => (
          <button
            key={g.id}
            disabled={!g.active}
            onClick={() => g.active && onSelect(g.id)}
            className={`w-full text-right p-5 rounded-3xl backdrop-blur-xl border bg-gradient-to-br ${g.grad} ${g.border} transition-transform hover:scale-[1.02] active:scale-[0.98] ${!g.active ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{g.emoji}</span>
              <div>
                <div className="text-lg font-extrabold">{g.title}</div>
                <div className="text-white/60 text-sm mt-0.5">{g.desc}</div>
              </div>
              {g.active && <span className="mr-auto text-white/40">←</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="text-center text-white/30 text-xs mt-10">شروقتي ♡ Couples Game</div>
    </div>
  )
}
