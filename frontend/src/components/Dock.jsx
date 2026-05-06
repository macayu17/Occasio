import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { Children, cloneElement, useEffect, useRef, useState } from 'react';

function DockItem({ children, className = '', onClick, ariaLabel, mouseX, spring, distance, magnification, baseItemSize }) {
    const ref = useRef(null);
    const isHovered = useMotionValue(0);

    const mouseDistance = useTransform(mouseX, val => {
        const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
        return val - rect.x - baseItemSize / 2;
    });

    const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
    const size = useSpring(targetSize, spring);

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick?.();
        }
    };

    return (
        <motion.div
            ref={ref}
            style={{ width: size, height: size }}
            onHoverStart={() => isHovered.set(1)}
            onHoverEnd={() => isHovered.set(0)}
            onFocus={() => isHovered.set(1)}
            onBlur={() => isHovered.set(0)}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-[#f2e7d8]/15 bg-[#15110e] text-[#f4e9dc] shadow-lg transition-colors hover:border-[#E23744]/50 hover:bg-[#f2e7d8] hover:text-[#17110d] cursor-pointer ${className}`}
            tabIndex={0}
            role="button"
            aria-label={ariaLabel}
        >
            {Children.map(children, child => cloneElement(child, { isHovered }))}
        </motion.div>
    );
}

function DockLabel({ children, className = '', ...rest }) {
    const { isHovered } = rest;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = isHovered?.on('change', latest => {
            setIsVisible(latest === 1);
        });
        return () => unsubscribe?.();
    }, [isHovered]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -10 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`${className} pointer-events-none absolute -top-10 left-1/2 z-[80] w-max whitespace-pre rounded-full border border-[#f2e7d8]/15 bg-[#f2e7d8] px-3 py-1.5 text-xs font-bold text-[#17110d] shadow-xl`}
                    style={{ x: '-50%' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function DockIcon({ children, className = '' }) {
    return <div className={`flex items-center justify-center ${className}`}>{children}</div>;
}

export default function Dock({
    items,
    className = '',
    spring = { mass: 0.1, stiffness: 150, damping: 12 },
    magnification = 70,
    distance = 140,
    panelHeight = 68,
    baseItemSize = 50,
    minimal = false
}) {
    const mouseX = useMotionValue(Infinity);
    const isHovered = useMotionValue(0);

    return (
        <motion.div
            onMouseMove={({ pageX }) => {
                isHovered.set(1);
                mouseX.set(pageX);
            }}
            onMouseLeave={() => {
                isHovered.set(0);
                mouseX.set(Infinity);
            }}
            className={`${className} scrollbar-hide flex w-full max-w-[calc(100vw-2rem)] items-end justify-start gap-3 ${minimal ? 'overflow-x-auto overflow-y-visible px-1 pb-2 pt-12 sm:justify-center sm:overflow-visible' : 'overflow-x-auto rounded-[1.75rem] border border-[#f2e7d8]/15 bg-[#100e0c]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:justify-center'}`}
            style={{ height: panelHeight }}
        >
            {items.map((item, index) => (
                <DockItem
                    key={index}
                    onClick={item.onClick}
                    ariaLabel={item.label}
                    className={item.active ? 'ring-2 ring-[#E23744] ring-offset-2 ring-offset-[#100e0c]' : ''}
                    mouseX={mouseX}
                    spring={spring}
                    distance={distance}
                    magnification={magnification}
                    baseItemSize={baseItemSize}
                >
                    <DockIcon>{item.icon}</DockIcon>
                    <DockLabel>{item.label}</DockLabel>
                </DockItem>
            ))}
        </motion.div>
    );
}
