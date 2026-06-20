import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  textClassName?: string;
  label?: string;
};

const BrandMark = ({
  className,
  textClassName,
  label = "\u03A9hm Study Club",
}: BrandMarkProps) => (
  <div
    aria-label={label}
    className={cn(
      "flex items-center justify-center rounded-lg gradient-primary text-primary-foreground shadow-soft",
      className,
    )}
  >
    <span className={cn("font-extrabold leading-none", textClassName)}>{"\u03A9"}</span>
  </div>
);

export default BrandMark;
