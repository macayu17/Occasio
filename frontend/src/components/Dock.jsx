function DockItem({ children, className = '', onClick, ariaLabel, magnification, baseItemSize, minimal }) {
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.();
        }
    };

    return (
        <button
            type="button"
            style={{
                width: baseItemSize,
                height: baseItemSize,
                '--dock-hover-scale': (magnification / baseItemSize).toFixed(2)
            }}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={`group relative inline-flex shrink-0 items-center justify-center rounded-full border border-[#f2e7d8]/15 bg-[#15110e] text-[#f4e9dc] shadow-lg transition-[background-color,border-color,color,transform] duration-150 ease-out hover:z-10 hover:scale-[var(--dock-hover-scale)] hover:border-[#E23744]/50 hover:bg-[#f2e7d8] hover:text-[#17110d] focus-visible:z-10 focus-visible:scale-[var(--dock-hover-scale)] focus-visible:border-[#E23744]/50 focus-visible:bg-[#f2e7d8] focus-visible:text-[#17110d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E23744] focus-visible:ring-offset-2 focus-visible:ring-offset-[#100e0c] active:scale-95 ${className}`}
            aria-label={ariaLabel}
        >
            {children}
            <DockLabel minimal={minimal}>{ariaLabel}</DockLabel>
        </button>
    );
}

function DockLabel({ children, className = '', minimal = false }) {
    return (
        <span
            className={`${className} pointer-events-none absolute ${minimal ? 'bottom-full mb-1 px-3 py-1' : '-top-10 px-3 py-1.5'} left-1/2 z-[80] w-max -translate-x-1/2 translate-y-1 whitespace-pre rounded-full border border-[#f2e7d8]/15 bg-[#f2e7d8] text-xs font-bold text-[#17110d] opacity-0 shadow-xl transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100`}
        >
            {children}
        </span>
    );
}

function DockIcon({ children, className = '' }) {
    return <div className={`flex items-center justify-center ${className}`}>{children}</div>;
}

export default function Dock({
    items,
    className = '',
    magnification = 70,
    panelHeight = 68,
    baseItemSize = 50,
    minimal = false
}) {
    return (
        <div
            className={`${className} scrollbar-hide flex w-full max-w-[calc(100vw-2rem)] items-end justify-start gap-3 ${minimal ? 'overflow-x-auto overflow-y-visible px-1 pb-2 pt-12 sm:justify-center sm:overflow-visible' : 'overflow-x-auto rounded-[1.75rem] border border-[#f2e7d8]/15 bg-[#100e0c]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:justify-center'}`}
            style={{ height: panelHeight }}
        >
            {items.map((item, index) => (
                <DockItem
                    key={index}
                    onClick={item.onClick}
                    ariaLabel={item.label}
                    className={item.active ? 'ring-2 ring-[#E23744] ring-offset-2 ring-offset-[#100e0c]' : ''}
                    magnification={magnification}
                    baseItemSize={baseItemSize}
                    minimal={minimal}
                >
                    <DockIcon>{item.icon}</DockIcon>
                </DockItem>
            ))}
        </div>
    );
}
