function initializeGlobalAdvancedAnimations() {
    if (typeof gsap === 'undefined') {
        console.warn("GSAP library is not loaded. Animations will not run.");
        return;
    }
    gsap.registerPlugin(ScrollTrigger);

    const defaultDuration = 0.9;
    const defaultEase = "power3.out";
    const defaultStagger = 0.12;

    ScrollTrigger.defaults({
        toggleActions: "play none none none", 
        start: "top 85%",
    });

    gsap.utils.toArray('[data-anim-type]').forEach(element => {
        const animType = element.dataset.animType || "fadeInUp";
        const duration = parseFloat(element.dataset.animDuration) || defaultDuration;
        const delay = parseFloat(element.dataset.animDelay) || 0;
        const ease = element.dataset.animEase || defaultEase;
        const yFrom = parseFloat(element.dataset.animYFrom) || 40;
        const xFrom = parseFloat(element.dataset.animXFrom) || 0;
        const scaleFrom = parseFloat(element.dataset.animScaleFrom) || 1;
        const rotationFrom = parseFloat(element.dataset.animRotationFrom) || 0;
        
        let fromVars = { opacity: 0, delay: delay, duration: duration, ease: ease };
        let toVars = { opacity: 1 };

        switch (animType) {
            case "fadeIn":
                break;
            case "fadeInUp":
                fromVars.y = yFrom;
                toVars.y = 0;
                break;
            case "fadeInDown":
                fromVars.y = -yFrom;
                toVars.y = 0;
                break;
            case "fadeInLeft":
                fromVars.x = xFrom || 50;
                toVars.x = 0;
                break;
            case "fadeInRight":
                fromVars.x = -(xFrom || 50);
                toVars.x = 0;
                break;
            case "scaleIn":
                fromVars.scale = scaleFrom === 1 ? 0.8 : scaleFrom;
                toVars.scale = 1;
                break;
            case "rotateIn":
                fromVars.rotation = rotationFrom || -15;
                fromVars.scale = scaleFrom === 1 ? 0.9 : scaleFrom;
                toVars.rotation = 0;
                toVars.scale = 1;
                break;
            case "curtainReveal":
                const parent = element.parentElement.classList.contains('curtain-reveal-container') ? element.parentElement : null;
                if (parent) {
                    const curtain = parent.querySelector('.curtain');
                    if (curtain) {
                        gsap.timeline({
                            scrollTrigger: { trigger: parent, start: "top 80%" }
                        })
                        .to(curtain, { scaleX: 0, duration: duration * 0.7, ease: "power2.inOut", delay:delay })
                        .fromTo(element, { opacity: 0, y: yFrom/2 }, { opacity: 1, y: 0, duration: duration * 0.5, ease: ease }, `-=${duration * 0.4}`);
                        return; 
                    }
                }
                fromVars.y = yFrom; toVars.y = 0; // Fallback if curtain setup is wrong
                break;
            default:
                fromVars.y = yFrom;
                toVars.y = 0;
        }
        
        gsap.fromTo(element, fromVars, { ...toVars, scrollTrigger: { trigger: element } });
    });

    gsap.utils.toArray('[data-anim-stagger-children]').forEach(container => {
        const childrenQuery = container.dataset.animChildren || "> *"; 
        const children = gsap.utils.toArray(container.querySelectorAll(childrenQuery));
        const staggerAmount = parseFloat(container.dataset.animStagger) || defaultStagger;
        const duration = parseFloat(container.dataset.animDuration) || 0.7;
        const yFrom = parseFloat(container.dataset.animYFrom) || 30;
        const xFrom = parseFloat(container.dataset.animXFrom) || 0;
        const scaleFrom = parseFloat(container.dataset.animScaleFrom) || 0.95;
        const ease = container.dataset.animEase || defaultEase;
        const animType = container.dataset.animType || "fadeInUp";

        let fromVars = { opacity: 0, duration: duration, ease: ease, stagger: staggerAmount };

        switch (animType) {
            case "fadeInUp": fromVars.y = yFrom; break;
            case "fadeInLeft": fromVars.x = xFrom || 30; break;
            case "scaleIn": fromVars.scale = scaleFrom; break;
            default: fromVars.y = yFrom;
        }
        
        gsap.from(children, { ...fromVars, scrollTrigger: { trigger: container } });
    });

    const parallaxBgElements = document.querySelectorAll('[data-parallax-bg-speed]');
    parallaxBgElements.forEach(el => {
        const speed = parseFloat(el.dataset.parallaxBgSpeed) || 0.2;
        gsap.to(el, {
            backgroundPosition: `50% ${innerHeight * speed}px`,
            ease: "none",
            scrollTrigger: {
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: true
            }
        });
    });
    
    const SplitText = window.SplitText; 
    if (SplitText) {
        gsap.utils.toArray('[data-anim-splittext]').forEach(textElement => {
            const type = textElement.dataset.animSplittextType || "chars,words";
            const split = new SplitText(textElement, { type: type });
            const animType = textElement.dataset.animSplittextEffect || "charsFadeInUp";
            const stagger = parseFloat(textElement.dataset.animStagger) || (type.includes("chars") ? 0.03 : 0.1);
            const duration = parseFloat(textElement.dataset.animDuration) || 0.6;
            const yFrom = parseFloat(textElement.dataset.animYFrom) || 20;

            let targetElements = split.chars;
            if (type.includes("words") && !type.includes("chars")) targetElements = split.words;
            if (type.includes("lines") && !type.includes("chars") && !type.includes("words")) targetElements = split.lines;

            let fromVars = { opacity: 0, duration: duration, ease: "power2.out", stagger: stagger };

            if (animType === "charsFadeInUp") { fromVars.y = yFrom; }
            else if (animType === "charsRandomRotate") { 
                fromVars.rotation = () => Math.random() * 90 - 45;
                fromVars.scale = 0.5;
            }
            
            gsap.from(targetElements, { ...fromVars, scrollTrigger: { trigger: textElement } });
        });
    } else {
        console.warn("GSAP SplitText plugin is not loaded. SplitText animations will not run. Load it from https://gsap.com/docs/v3/Plugins/SplitText/");
    }

    const cursorFollower = document.createElement('div');
    cursorFollower.style.cssText = `
        position: fixed;
        width: 30px;
        height: 30px;
        border: 2px solid var(--primary-color, #00aaff);
        border-radius: 50%;
        pointer-events: none;
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        z-index: 9999;
        mix-blend-mode: difference;
        transition: width 0.2s ease, height 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
        opacity: 0;
    `;
    document.body.appendChild(cursorFollower);
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;
    const speed = 0.1; 

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursorFollower.style.opacity === '0') {
            cursorFollower.style.opacity = '1';
        }
    });
    document.addEventListener('mouseleave', () => {
        cursorFollower.style.opacity = '0';
    });


    function animateCursorFollower() {
        let dx = mouseX - followerX;
        let dy = mouseY - followerY;
        followerX += dx * speed;
        followerY += dy * speed;
        cursorFollower.style.left = `${followerX}px`;
        cursorFollower.style.top = `${followerY}px`;
        requestAnimationFrame(animateCursorFollower);
    }
    if (window.innerWidth > 768) { 
        animateCursorFollower();
    }


    document.querySelectorAll('a, button, .interactive-card-hover, .nav-tab, .profile-icon-trigger, .action-btn, .copy-btn').forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) {
                gsap.to(cursorFollower, { width: 50, height: 50, duration:0.2, ease:"power2.out", backgroundColor: 'rgba(0, 170, 255, 0.2)' });
            }
        });
        el.addEventListener('mouseleave', () => {
             if (window.innerWidth > 768) {
                gsap.to(cursorFollower, { width: 30, height: 30, duration:0.2, ease:"power2.out", backgroundColor: 'transparent' });
            }
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalAdvancedAnimations);
} else {
    initializeGlobalAdvancedAnimations();
}