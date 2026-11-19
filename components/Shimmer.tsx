const WIDTHS = ['100%', '80%', '90%', '70%', '85%']

export default function Shimmer({ lines = 4 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="shimmer"
          style={{ height: 18, width: WIDTHS[i % WIDTHS.length] }}
        />
      ))}
    </div>
  )
}
