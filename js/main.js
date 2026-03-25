// S.I.L.T. System - Main JavaScript
// Utilities, animations, currency handling, and UI interactions

// Global state
let currentCurrency = 'USD';
let exchangeRate = { USD: 1, BRL: 5.0 }; // Default rate, will be fetched
let headerVisible = false;
let headerTimeout = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initParticles();
    initAnimations();
    fetchExchangeRate();
});

// Header show/hide on mouse approach
function initHeader() {
    const header = document.querySelector('.floating-header');
    const triggerZone = document.querySelector('.header-trigger');

    if (!header || !triggerZone) return;

    // Show header when mouse enters trigger zone
    triggerZone.addEventListener('mouseenter', () => {
        clearTimeout(headerTimeout);
        header.classList.add('visible');
        headerVisible = true;
    });

    // Hide header when mouse leaves header area
    header.addEventListener('mouseleave', () => {
        headerTimeout = setTimeout(() => {
            header.classList.remove('visible');
            headerVisible = false;
        }, 500);
    });

    // Keep header visible when mouse is over it
    header.addEventListener('mouseenter', () => {
        clearTimeout(headerTimeout);
    });

    // Also show on scroll up (optional enhancement)
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY < lastScrollY && currentScrollY > 100) {
            // Scrolling up
            header.classList.add('visible');
            headerVisible = true;
        } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scrolling down
            header.classList.remove('visible');
            headerVisible = false;
        }

        lastScrollY = currentScrollY;
    });
}

// Create floating particles
function initParticles() {
    const container = document.querySelector('.particles');
    if (!container) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particle.style.opacity = Math.random() * 0.3 + 0.1;
        particle.style.width = (Math.random() * 4 + 2) + 'px';
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// Initialize scroll and intersection animations
function initAnimations() {
    // Intersection Observer for fade-in elements
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements with animation classes
    document.querySelectorAll('.glass-card, .stat-card, .chart-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animate-in class style
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
}

// Fetch exchange rate from API
async function fetchExchangeRate() {
    try {
        // Using a free exchange rate API
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();

        if (data && data.rates && data.rates.BRL) {
            exchangeRate.BRL = data.rates.BRL;
            console.log('Exchange rate updated:', exchangeRate);
        }
    } catch (error) {
        console.warn('Failed to fetch exchange rate, using default:', error);
    }
}

// Convert value between currencies
function convertCurrency(value, from = 'USD', to = currentCurrency) {
    if (from === to) return value;

    // Convert to USD first
    const usdValue = from === 'USD' ? value : value / exchangeRate.BRL;

    // Then convert to target
    return to === 'USD' ? usdValue : usdValue * exchangeRate.BRL;
}

// Format currency for display
function formatCurrency(value, currency = currentCurrency) {
    const symbol = currency === 'BRL' ? 'R$' : '$';
    const convertedValue = convertCurrency(value);

    return symbol + convertedValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Switch currency
function switchCurrency(currency) {
    currentCurrency = currency;
    window.CURRENCY = currency;

    // Update UI
    document.querySelectorAll('.currency-switcher button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === currency);
    });

    // Update all displayed values
    updateDisplayedValues();

    // Update charts
    if (window.SILTCharts) {
        window.SILTCharts.updateChartsCurrency(exchangeRate[currency]);
    }

    // Save preference
    localStorage.setItem('silt_currency', currency);

    return currency;
}

// Update all currency displays on the page
function updateDisplayedValues() {
    document.querySelectorAll('[data-value]').forEach(el => {
        const value = parseFloat(el.dataset.value);
        if (!isNaN(value)) {
            el.textContent = formatCurrency(value);
        }
    });
}

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
    // Create container if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };

    toast.innerHTML = `
        <span style="font-size: 18px;">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
        toast.style.animation = 'slide-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading overlay
function showLoading(message = 'Loading...') {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <p>${message}</p>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Modal handling
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = 'var(--danger)';

            // Show error message
            const errorEl = input.parentElement.querySelector('.error-message');
            if (errorEl) {
                errorEl.classList.add('visible');
            }
        } else {
            input.style.borderColor = '';
            const errorEl = input.parentElement.querySelector('.error-message');
            if (errorEl) {
                errorEl.classList.remove('visible');
            }
        }
    });

    return isValid;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Check authentication status
async function checkAuth() {
    const publicPages = ['/', '/index.html', '/login.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Check if we're on a public page
    const isPublicPage = publicPages.some(page => currentPage.includes(page.replace('/', '')));

    if (!isPublicPage) {
        // Check for session
        const session = localStorage.getItem('silt_session');
        if (!session) {
            window.location.href = 'login.html';
            return false;
        }
    }

    return true;
}

// Save session
function saveSession(userData) {
    localStorage.setItem('silt_session', JSON.stringify(userData));
}

// Get session
function getSession() {
    const session = localStorage.getItem('silt_session');
    return session ? JSON.parse(session) : null;
}

// Clear session
function clearSession() {
    localStorage.removeItem('silt_session');
    localStorage.removeItem('silt_currency');
}

// Export utilities
window.SILTUtils = {
    currentCurrency,
    exchangeRate,
    convertCurrency,
    formatCurrency,
    switchCurrency,
    updateDisplayedValues,
    showToast,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    validateForm,
    debounce,
    throttle,
    checkAuth,
    saveSession,
    getSession,
    clearSession,
    fetchExchangeRate
};

// Load saved currency preference
const savedCurrency = localStorage.getItem('silt_currency');
if (savedCurrency) {
    currentCurrency = savedCurrency;
    window.CURRENCY = savedCurrency;
}

// =====================================================
// MOBILE NAV — Hambúrguer + Drawer
// =====================================================
function toggleMobileNav() {
    const btn     = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('mob-overlay');
    const drawer  = document.getElementById('mob-drawer');

    if (!btn || !overlay || !drawer) return;

    const isOpen = drawer.classList.contains('open');

    if (isOpen) {
        closeMobileNav();
    } else {
        btn.classList.add('open');
        overlay.classList.add('active');
        drawer.classList.add('open');
        document.body.classList.add('nav-open');
    }
}

function closeMobileNav() {
    const btn     = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('mob-overlay');
    const drawer  = document.getElementById('mob-drawer');

    if (btn)     btn.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (drawer)  drawer.classList.remove('open');
    document.body.classList.remove('nav-open');
}

// Fechar com Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMobileNav();
});

// Wrap pools tables para scroll horizontal no mobile
document.addEventListener('DOMContentLoaded', function() {
    // Observar mudanças no DOM para capturar tables geradas pelo JS
    const obs = new MutationObserver(function() {
        document.querySelectorAll('.week-card table.pools-table').forEach(function(table) {
            if (!table.parentElement.classList.contains('table-scroll-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-scroll-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    });

    const weeksContainer = document.getElementById('weeks-container');
    if (weeksContainer) {
        obs.observe(weeksContainer, { childList: true, subtree: true });
    }
});
