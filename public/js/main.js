document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButtons = document.querySelectorAll('#theme-toggle, #theme-toggle-mobile');
    const htmlElement = document.documentElement;

    const applyTheme = (theme) => {
        htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem('wanzofc_theme', theme);
        themeToggleButtons.forEach(button => {
            const icon = button.querySelector('i');
            if (theme === 'dark') {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            } else {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        });
    };

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('wanzofc_theme') || 'dark';
    applyTheme(savedTheme);

    themeToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    });


    // Typewriter Effect (Home Page)
    const typewriterTextElement = document.getElementById('typewriter-text');
    if (typewriterTextElement) {
        const text = "Wanzofc API";
        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                typewriterTextElement.innerHTML += text.charAt(i);
                i++;
                setTimeout(typeWriter, 150);
            } else {
                // Optional: Restart atau efek lain
                // setTimeout(() => { i = 0; typewriterTextElement.innerHTML = ''; typeWriter(); }, 3000);
            }
        }
        typeWriter();
    }

    // Particles.js Background (Home Page)
    if (document.getElementById('particles-js')) {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
                "color": { "value": "#FF00E6" }, // Warna partikel (accent color)
                "shape": { "type": "circle" },
                "opacity": { "value": 0.5, "random": false },
                "size": { "value": 3, "random": true },
                "line_linked": { "enable": true, "distance": 150, "color": "#2575FC", "opacity": 0.4, "width": 1 }, // Secondary color
                "move": { "enable": true, "speed": 4, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": { "onhover": { "enable": true, "mode": "repulse" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
                "modes": { "grab": { "distance": 400, "line_linked": { "opacity": 1 } }, "bubble": { "distance": 400, "size": 40, "duration": 2, "opacity": 8, "speed": 3 }, "repulse": { "distance": 100, "duration": 0.4 }, "push": { "particles_nb": 4 }, "remove": { "particles_nb": 2 } }
            },
            "retina_detect": true
        });
    }

    // Copy to Clipboard Buttons
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.clipboardTarget;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.select(); // Untuk input/textarea
                // Untuk elemen lain, bisa gunakan Range API
                try {
                    navigator.clipboard.writeText(targetElement.value || targetElement.innerText)
                        .then(() => {
                            const originalIcon = button.innerHTML;
                            button.innerHTML = '<i class="fas fa-check text-success-color"></i>';
                            setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
                        })
                        .catch(err => console.error('Gagal copy: ', err));
                } catch (err) {
                     console.error('Clipboard API tidak didukung atau error: ', err);
                     // Fallback (deprecated, but for older browsers)
                     try {
                        document.execCommand('copy');
                        const originalIcon = button.innerHTML;
                        button.innerHTML = '<i class="fas fa-check text-success-color"></i>';
                        setTimeout(() => { button.innerHTML = originalIcon; }, 1500);
                     } catch (execErr) {
                        console.error('Fallback copy gagal: ', execErr);
                        alert('Gagal menyalin. Browser Anda mungkin tidak mendukung fitur ini.');
                     }
                }
            }
        });
    });

    // Mobile Menu Toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const closeMobileMenuButton = document.getElementById('close-mobile-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuDrawer = mobileMenu.querySelector('.fixed.right-0');


    if (mobileMenuButton && mobileMenu && closeMobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.remove('hidden');
            setTimeout(() => { // delay untuk transisi
                mobileMenuDrawer.classList.remove('translate-x-full');
            }, 10);
        });

        const closeMenu = () => {
            mobileMenuDrawer.classList.add('translate-x-full');
            setTimeout(() => { // delay untuk transisi
                 mobileMenu.classList.add('hidden');
            }, 300); // Sesuaikan dengan durasi transisi CSS
        }

        closeMobileMenuButton.addEventListener('click', closeMenu);
        // Optional: Close menu when clicking outside the drawer
        mobileMenu.addEventListener('click', (event) => {
            if (event.target === mobileMenu) { // Klik pada backdrop
                closeMenu();
            }
        });
    }

    // "Try API" Button (Home Page)
    const tryApiButton = document.getElementById('try-api-button');
    const apiKeyDemoInput = document.getElementById('api-key-demo');
    const apiResponseElement = document.getElementById('api-response').querySelector('code');
    const copyResponseButton = document.getElementById('copy-response-button');

    if (tryApiButton && apiResponseElement && copyResponseButton) {
        tryApiButton.addEventListener('click', async () => {
            apiResponseElement.textContent = 'Memuat...';
            copyResponseButton.classList.add('hidden');
            const apiKey = apiKeyDemoInput.value.trim();
            const headers = {};
            if (apiKey) {
                headers['X-API-KEY'] = apiKey;
            }

            try {
                // Ganti dengan endpoint API Anda yang bisa diakses publik (atau dengan key demo jika ada)
                const response = await fetch('/api/v1/example', { headers });
                const data = await response.json();
                apiResponseElement.textContent = JSON.stringify(data, null, 2);
                if (data.success) {
                    copyResponseButton.classList.remove('hidden');
                }
                // Jika menggunakan Prism.js atau highlight.js, panggil highlight setelah konten diubah
                // if (typeof Prism !== 'undefined') Prism.highlightElement(apiResponseElement);
            } catch (error) {
                console.error('Error fetching API demo:', error);
                apiResponseElement.textContent = JSON.stringify({ success: false, message: 'Gagal mengambil data dari API.', error: error.message }, null, 2);
            }
        });

        copyResponseButton.addEventListener('click', () => {
            navigator.clipboard.writeText(apiResponseElement.textContent)
                .then(() => {
                    const originalText = copyResponseButton.innerHTML;
                    copyResponseButton.innerHTML = '<i class="fas fa-check mr-2"></i> Berhasil Disalin!';
                    setTimeout(() => { copyResponseButton.innerHTML = originalText; }, 2000);
                })
                .catch(err => console.error('Gagal copy response: ', err));
        });
    }

    // Accordion (Documentation Page)
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        if(header && content){
            header.addEventListener('click', () => {
                // Toggle active class on header (optional for styling)
                header.classList.toggle('active');
                // Toggle display of content
                if (content.style.display === "block") {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
            });
        }
    });

});