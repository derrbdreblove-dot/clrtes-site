const canvas = document.getElementById("bgCanvas");
const ctx = canvas.getContext("2d");

let w = 0;
let h = 0;
let particles = [];
let mouse = { x: null, y: null };

function resizeCanvas() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  createParticles();
}

class Particle {
  constructor() {
    this.reset();
    this.x = Math.random() * w;
    this.y = Math.random() * h;
  }

  reset() {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.35;
    this.vy = (Math.random() - 0.5) * 0.35;
    this.size = Math.random() * 1.8 + 0.6;
    this.alpha = Math.random() * 0.45 + 0.08;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < -50 || this.x > w + 50 || this.y < -50 || this.y > h + 50) {
      this.reset();
    }

    if (mouse.x !== null && mouse.y !== null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 140) {
        this.x -= dx * 0.0025;
        this.y -= dy * 0.0025;
      }
    }
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = `rgba(180,180,180,${this.alpha})`;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function createParticles() {
  const count = Math.max(90, Math.floor((w * h) / 16000));
  particles = [];

  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 110) {
        const alpha = (1 - dist / 110) * 0.12;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(120,120,120,${alpha})`;
        ctx.lineWidth = 1;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
}

function drawGlow() {
  const gradient = ctx.createRadialGradient(
    w * 0.5,
    h * 0.25,
    0,
    w * 0.5,
    h * 0.25,
    h * 0.55
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.025)");
  gradient.addColorStop(0.35, "rgba(140,140,140,0.02)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function animate() {
  ctx.clearRect(0, 0, w, h);

  drawGlow();

  for (const p of particles) {
    p.update();
    p.draw();
  }

  drawConnections();

  requestAnimationFrame(animate);
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("mouseleave", () => {
  mouse.x = null;
  mouse.y = null;
});

resizeCanvas();
animate();