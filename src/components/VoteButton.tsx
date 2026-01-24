interface VoteButtonProps {
  votes: number;
  hasVoted: boolean;
  onClick: () => void;
}

export default function VoteButton({ votes, hasVoted, onClick }: VoteButtonProps) {
  return (
    <button
      onClick={onClick}
      class="relative font-mono transition-all cursor-pointer active:animate-[heartBounce_0.4s_ease-in-out] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sketch-dark focus-visible:ring-offset-2 rounded-full size-vote-btn"
      title={hasVoted ? 'Remove vote' : 'Vote'}
      aria-label={hasVoted ? `Remove vote, currently ${votes} votes` : `Vote, currently ${votes} votes`}
      aria-pressed={hasVoted}
    >
      {/* Heart SVG */}
      <svg
        viewBox="0 0 24 24"
        class={`absolute inset-0 w-full h-full transition-all stroke-2 filter-doodly ${
          hasVoted ? 'fill-sketch-dark stroke-sketch-dark' : 'fill-none stroke-sketch-medium hover:stroke-sketch-dark'
        }`}
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      {/* Number */}
      <span
        class={`absolute inset-0 flex items-center justify-center text-xs font-semibold -mt-0.5 ${
          hasVoted ? 'text-beige-light' : 'text-sketch-medium'
        }`}
      >
        {votes}
      </span>
    </button>
  );
}
