import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface StarRatingDisplayProps {
  average: number;
  count: number;
  size?: "sm" | "md";
}

export function StarRatingDisplay({
  average,
  count,
  size = "sm",
}: StarRatingDisplayProps) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              iconSize,
              i < Math.round(average)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "text-muted-foreground",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        ({count})
      </span>
    </span>
  );
}

interface StarRatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <span className="inline-flex">
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        const filled = hovered ? starValue <= hovered : starValue <= (value ?? 0);
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            className="p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(starValue)}
          >
            <Star
              className={cn(
                "size-6",
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40 hover:text-yellow-300",
              )}
            />
          </button>
        );
      })}
    </span>
  );
}
