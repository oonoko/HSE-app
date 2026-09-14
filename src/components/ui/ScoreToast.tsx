'use client'

export default function ScoreToast({ message }: { message: string }) {
  return (
    <div className="score-toast">
      {message}
    </div>
  )
}
