// ===== BudgetWise App.js =====

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initScrollReveal();
    initCounters();
    initCharts();
    initBudgetBars();
    initHealthScore();
    initTestimonials();
    checkCookieConsent();
});

// ===== Navbar =====
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const spans = hamburger.querySelectorAll('span');
        hamburger.classList.toggle('open');
        if (hamburger.classList.contains('open')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
            spans[0].style.transform = '';
            spans[1].style.opacity = '1';
            spans[2].style.transform = '';
        }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            hamburger.classList.remove('open');
            hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = '1'; });
        });
    });
}

// ===== Scroll Reveal =====
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ===== Animated Counters =====
function initCounters() {
    const counters = document.querySelectorAll('.stat-num');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.target);
    const duration = 2000;
    const start = Date.now();
    const format = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M+';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K+';
        return n + '%';
    };
    const step = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = format(current);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ===== Charts =====
function initCharts() {
    drawHeroChart();
    drawTrendChart();
    drawDonutChart();
}

function drawHeroChart() {
    const canvas = document.querySelector('.mini-chart canvas') || createCanvas('heroChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    const w = rect.width, h = rect.height;
    const data = [30, 45, 35, 60, 50, 75, 65, 80, 70, 85, 75, 90];
    const data2 = [20, 30, 25, 40, 35, 50, 45, 55, 50, 60, 55, 65];
    drawLineChart(ctx, w, h, data, '#57F2D1', 0.15);
    drawLineChart(ctx, w, h, data2, '#FFB142', 0.1);
}

function drawTrendChart() {
    const canvas = document.getElementById('trendCanvas');
    if (!canvas) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                renderTrendChart(canvas);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    observer.observe(canvas);
}

function renderTrendChart(canvas) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    const w = rect.width, h = rect.height;
    const padding = 40;
    const actual = [18, 22, 19, 25, 23, 28, 26, 30, 27, 32, 29, 35];
    const forecast = [null, null, null, null, null, null, null, null, 27, 31, 33, 36];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxVal = 40;

    // Grid
    ctx.strokeStyle = '#f0f0f5';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (i / 4) * (h - padding * 2);
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - 10, y); ctx.stroke();
        ctx.fillStyle = '#9ca3af'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
        ctx.fillText('₹' + ((4 - i) * 10) + 'K', padding - 8, y + 4);
    }
    // Month labels
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
        const x = padding + (i / (months.length - 1)) * (w - padding - 10);
        ctx.fillText(m, x, h - 10);
    });

    // Actual line
    animateLine(ctx, actual, w, h, padding, maxVal, '#57F2D1', 2.5, true);

    // Forecast line (dashed)
    setTimeout(() => {
        const forecastData = forecast.map((v, i) => v !== null ? v : actual[i]);
        ctx.setLineDash([6, 4]);
        animateLine(ctx, forecastData.slice(7), w, h, padding, maxVal, '#FFB142', 2.5, false, 7);
        ctx.setLineDash([]);
    }, 800);
}

function animateLine(ctx, data, w, h, padding, maxVal, color, lineWidth, fill, startIdx = 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const points = [];
    data.forEach((val, i) => {
        if (val === null) return;
        const idx = startIdx + i;
        const x = padding + (idx / 11) * (w - padding - 10);
        const y = padding + ((maxVal - val) / maxVal) * (h - padding * 2);
        points.push({ x, y });
        if (points.length === 1) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (fill && points.length > 1) {
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, h - padding);
        ctx.lineTo(points[0].x, h - padding);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + '25');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    // Dots
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawDonutChart() {
    const canvas = document.getElementById('donutCanvas');
    if (!canvas) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                renderDonut(canvas);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    observer.observe(canvas);
}

function renderDonut(canvas) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2);
    const cx = size / 2, cy = size / 2, radius = size / 2 - 20, inner = radius * 0.6;
    const data = [
        { label: 'Food', value: 30, color: '#57F2D1' },
        { label: 'Transport', value: 15, color: '#3DD4B5' },
        { label: 'Shopping', value: 20, color: '#f093fb' },
        { label: 'Bills', value: 18, color: '#4facfe' },
        { label: 'Entertainment', value: 10, color: '#FFB142' },
        { label: 'Others', value: 7, color: '#fa709a' }
    ];
    const total = data.reduce((s, d) => s + d.value, 0);
    let startAngle = -Math.PI / 2;
    const duration = 1500;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        ctx.clearRect(0, 0, size, size);
        let currentAngle = -Math.PI / 2;
        data.forEach(d => {
            const sliceAngle = (d.value / total) * Math.PI * 2 * eased;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(cx, cy, inner, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();
            ctx.fillStyle = d.color;
            ctx.fill();
            currentAngle += sliceAngle;
        });
        // Center text
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('₹43K', cx, cy - 8);
        ctx.font = '11px Inter';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText('Total', cx, cy + 12);

        if (progress < 1) requestAnimationFrame(animate);
    }
    animate();

    // Legend
    const legendEl = document.getElementById('donutLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map(d =>
            `<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${d.color};flex-shrink:0"></span>${d.label} ${d.value}%</div>`
        ).join('');
    }
}

function createCanvas(parentId) {
    const parent = document.getElementById(parentId);
    if (!parent) return null;
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    return canvas;
}

function drawLineChart(ctx, w, h, data, color, fillOpacity) {
    const points = data.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: h - (v / 100) * h
    }));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    // Fill
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();
}

// ===== Budget Bars Animation =====
function initBudgetBars() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.querySelectorAll('.bar-fill').forEach(bar => {
                    bar.classList.add('animated');
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    const budgetBars = document.getElementById('budgetBars');
    if (budgetBars) observer.observe(budgetBars);
}

// ===== Health Score Animation =====
function initHealthScore() {
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreNum = document.getElementById('scoreNum');
    if (!scoreCircle || !scoreNum) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateScore(scoreCircle, scoreNum, 82);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    observer.observe(scoreCircle.closest('.health-score-card'));
}

function animateScore(circle, numEl, targetScore) {
    const circumference = 2 * Math.PI * 85;
    const targetOffset = circumference - (targetScore / 100) * circumference;
    const duration = 2000;
    const start = Date.now();

    function step() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentScore = Math.floor(eased * targetScore);
        const currentOffset = circumference - (eased * targetScore / 100) * circumference;
        circle.style.strokeDashoffset = currentOffset;
        numEl.textContent = currentScore;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ===== Testimonials Carousel =====
function initTestimonials() {
    const cards = document.querySelectorAll('.testimonial-card');
    const dots = document.querySelectorAll('.t-dot');
    let current = 0;

    function showSlide(idx) {
        cards.forEach((c, i) => {
            c.classList.toggle('active', i === idx);
        });
        dots.forEach((d, i) => {
            d.classList.toggle('active', i === idx);
        });
        current = idx;
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            showSlide(parseInt(dot.dataset.idx));
        });
    });

    setInterval(() => {
        showSlide((current + 1) % cards.length);
    }, 5000);
}

// ===== AI Chat =====
const chatResponses = {
    'how much did i spend': "You spent ₹18,450 this month. Here's the breakdown:\n\n🍕 Food: ₹6,200 (34%)\n🚕 Transport: ₹3,800 (21%)\n🛍️ Shopping: ₹4,450 (24%)\n📱 Bills: ₹2,500 (14%)\n🎬 Entertainment: ₹1,500 (8%)\n\nFood is your top spending category.",
    'can i afford': "Based on your current budget analysis:\n\n⚠️ A ₹20,000 phone purchase will exceed your shopping budget by ₹4,000.\n\n💡 Suggestion: If you reduce dining out by ₹2,000 for 2 months, you can comfortably afford it without impacting your savings goals.",
    'show my savings': "Here's your savings summary:\n\n🏠 Dream House: ₹4,50,000 / ₹10,00,000 (45%)\n🎓 Education: ₹5,40,000 / ₹7,50,000 (72%)\n🛡️ Emergency: ₹2,70,000 / ₹3,00,000 (90%)\n✈️ Vacation: ₹30,000 / ₹1,00,000 (30%)\n\n📈 Total savings this month: ₹12,500\n✅ You're on track with 3 out of 4 goals!",
    'default': "Great question! Based on your financial data, I can help you with spending analysis, budget planning, savings goals, and expense forecasting. Try asking me:\n\n• \"How much did I spend this month?\"\n• \"Can I afford a new purchase?\"\n• \"Show my savings progress\"\n• \"What's my financial health score?\""
};

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    addChatBubble(msg, 'user');
    input.value = '';
    showTyping();
    setTimeout(() => {
        removeTyping();
        const key = Object.keys(chatResponses).find(k => msg.toLowerCase().includes(k));
        addChatBubble(chatResponses[key || 'default'], 'bot');
    }, 1500);
}

function askAI(btn) {
    const input = document.getElementById('chatInput');
    input.value = btn.textContent;
    sendChatMessage();
}

function addChatBubble(text, type) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.innerHTML = `<div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg bot typing-msg';
    div.innerHTML = '<div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.querySelector('.typing-msg');
    if (el) el.remove();
}

function openChat() {
    const section = document.getElementById('ai-assistant');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => document.getElementById('chatInput')?.focus(), 800);
    }
}

// Enter key for chat
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement?.id === 'chatInput') {
        sendChatMessage();
    }
});


// ===== Cookie Consent =====
function checkCookieConsent() {
    const consent = localStorage.getItem('cookieWiseConsent');
    if (!consent) {
        setTimeout(() => {
            const banner = document.getElementById('cookieBanner');
            if (banner) banner.classList.add('active');
        }, 2000);
    }
}

function acceptCookies() {
    localStorage.setItem('cookieWiseConsent', 'true');
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('active');
}

// ===== Password Toggle =====
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}
