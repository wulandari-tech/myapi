function initializeGlobalAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    const defaultStagger = 0.1;

    gsap.utils.toArray('.animate-on-scroll').forEach(element => {
        const delay = parseFloat(element.dataset.gsapDelay) || 0;
        const duration = parseFloat(element.dataset.gsapDuration) || 0.8;
        const yFrom = parseFloat(element.dataset.gsapYFrom) || 30;
        const scaleFrom = parseFloat(element.dataset.gsapScaleFrom) || 0.95;
        const easeType = element.dataset.gsapEase || "power2.out";

        gsap.fromTo(element,
            { opacity: 0, y: yFrom, scale: scaleFrom },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: duration,
                delay: delay,
                ease: easeType,
                scrollTrigger: {
                    trigger: element,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            }
        );
    });
    
    gsap.utils.toArray('.stagger-children-on-scroll').forEach(container => {
        const children = gsap.utils.toArray(container.children);
        const staggerAmount = parseFloat(container.dataset.gsapStagger) || defaultStagger;
        const yFrom = parseFloat(container.dataset.gsapYFrom) || 20;

        gsap.from(children, {
            opacity: 0,
            y: yFrom,
            duration: 0.6,
            ease: "power1.out",
            stagger: staggerAmount,
            scrollTrigger: {
                trigger: container,
                start: "top 80%",
                toggleActions: "play none none none"
            }
        });
    });

    const parallaxElements = document.querySelectorAll('[data-parallax-speed]');
    parallaxElements.forEach(el => {
        const speed = parseFloat(el.dataset.parallaxSpeed) || 0.1;
        gsap.to(el, {
            y: () => (ScrollTrigger.maxScroll(window) - ScrollTrigger.scroll()) * speed,
            ease: "none",
            scrollTrigger: {
                trigger: document.body,
                start: "top top",
                end: "bottom top",
                scrub: true, 
            }
        });
    });
    
    if (document.querySelector('.parallax-bg')) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const parallaxBg = document.querySelector('.parallax-bg');
            if (parallaxBg) {
                 parallaxBg.style.backgroundPositionY = -(scrolled * 0.3) + 'px';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initializeGlobalAnimations);