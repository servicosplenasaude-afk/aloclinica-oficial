import { useState, useRef, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  priority?: boolean;
  aspectRatio?: string;
}

/**
 * Image with blur-up loading, error fallback, IntersectionObserver lazy loading,
 * and a skeleton placeholder while loading.
 */
const OptimizedImage = ({
  className,
  fallback = "/placeholder.svg",
  alt,
  priority = false,
  aspectRatio,
  onLoad,
  onError,
  style,
  ...props
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const priorityProps = { fetchpriority: priority ? "high" : "auto" };

  useEffect(() => {
    if (priority || !imgRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  return (
    <div
      className={cn("relative overflow-hidden", aspectRatio && "w-full")}
      style={aspectRatio ? { aspectRatio, ...style } : style}
    >
      {/* Skeleton placeholder (nunca para a imagem LCP, que deve pintar de imediato) */}
      {!loaded && !priority && (
        <div className="absolute inset-0 bg-muted/40 shimmer-v2 rounded-inherit" />
      )}
      <img
        ref={imgRef}
        {...props}
        {...priorityProps}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        src={!inView ? undefined : error ? fallback : props.src}
        className={cn(
          "transition-all duration-500 w-full h-full object-cover",
          loaded || priority ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-sm scale-[1.02]",
          className
        )}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setError(true);
          setLoaded(true);
          onError?.(e);
        }}
      />
    </div>
  );
};

export default OptimizedImage;
