type IconProps = { className?: string };
type HeartIconProps = IconProps & { filled?: boolean };

export function SearchIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4.25 4.25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function SparkleIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 13.55 9 19.6 10.5l-6.05 1.55L12 18.3l-1.55-6.25L4.4 10.5 10.45 9 12 2.8Z" fill="currentColor" /><path d="m18.7 15.3.7 2.75 2.7.7-2.7.7-.7 2.75-.7-2.75-2.7-.7 2.7-.7.7-2.75Z" fill="currentColor" /></svg>;
}

export function ArrowIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PinIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9.5c0 5-6 10.2-6 10.2S6 14.5 6 9.5a6 6 0 1 1 12 0Z" fill="none" stroke="currentColor" strokeWidth="1.75" /><circle cx="12" cy="9.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.75" /></svg>;
}

export function HeartIcon({ className, filled = false }: HeartIconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8.7c0 5.45-8 10.05-8 10.05S4 14.15 4 8.7C4 5.9 6 4 8.55 4c1.62 0 2.77.77 3.45 1.85C12.68 4.77 13.83 4 15.45 4 18 4 20 5.9 20 8.7Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

export function CheckIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.25 4L19.5 6.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function MenuIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function SlidersIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h8M16 7h4M4 17h3M12 17h8M12 4v6M7 14v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function SendIcon({ className }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.4 18-3.1-7.3L3 10.6 21 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m10.5 13.5 4.3-4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}