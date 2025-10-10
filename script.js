document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute("href")).scrollIntoView({
      behavior: "smooth",
    });
  });
});

const canvas = document.getElementById("constellation");
const ctx = canvas.getContext("2d");

// SVG-данные для звёздочки
const starSvgPath = "M10,0 A10,10 0 1,1 10,20 A10,10 0 1,1 10,0";
const starSize = 10;

// Привязываем звёзды к секциям на странице
const sections = [
  ["#hero", "#star-1"],
  ["#about", "#star-2"],
  ["#ar", "#star-3"],
  ["#works", "#star-4"],
  ["#team", "#star-5"],
];

// Координаты звёзд (будут заполнены динамически из секций)
let stars = [
  { x: 0.2, y: 0.1 },
  { x: 0.78, y: 0.223 },
  { x: 0.78, y: 0.422 },
  { x: 0.4, y: 0.7 },
  { x: 0.8, y: 0.9 },
];

// Переменные для анимации звёздочки
let starPosition = 0;
let targetStarPosition = 0;
let animationFrameId = null;
let currentStarX = 0;
let currentStarY = 0;
let previousStarX = 0;
let previousStarY = 0;
let rotationAngle = 0;

const starSpeed = 0.05;

// Переменные для следа
const trail = [];
const maxTrailLength = 30;
const trailFadeFactor = 0.95;

/**
 * Вычисляет абсолютный центр каждой секции и преобразует его
 * в относительные (процентные) координаты для Canvas.
 */
function calculateStarPositions() {
  const documentHeight = document.documentElement.scrollHeight;
  const documentWidth = window.innerWidth;

  const newStars = sections.map((selector, index) => {
    // selector[1] - ID элемента, который вы отслеживаете (напр., '#star-1')
    const element = document.querySelector(selector[1]);

    if (!element) return stars[index] || { x: 0.5, y: 0.5 };
    const rect = element.getBoundingClientRect();

    // 1. АБСОЛЮТНАЯ ВЕРХНЯЯ КООРДИНАТА ЭЛЕМЕНТА:
    // rect.top (относительно viewport) + window.scrollY (прокрутка)
    const absoluteTop = rect.top + window.scrollY;

    // 2. АБСОЛЮТНАЯ ЦЕНТРАЛЬНАЯ КООРДИНАТА:
    // Absolute Top + половина высоты элемента
    const centerY = absoluteTop + rect.height / 2;

    // 3. АБСОЛЮТНАЯ ГОРИЗОНТАЛЬНАЯ ЦЕНТРАЛЬНАЯ КООРДИНАТА:
    const centerX = rect.left + window.scrollX + rect.width / 2;

    // 4. ПРЕОБРАЗОВАНИЕ В ПРОЦЕНТЫ:
    const x_percent = centerX / documentWidth;
    const y_percent = centerY / documentHeight;

    return { x: x_percent, y: y_percent };
  });

  stars = newStars;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = document.documentElement.scrollHeight;

  // 1. Пересчитываем позиции звезд
  calculateStarPositions();

  // 2. ВАЖНОЕ ИЗМЕНЕНИЕ: Обновляем текущее абсолютное положение летающей звезды
  // на основе ее текущей дробной позиции (starPosition) и новых размеров.
  if (stars.length > 1) {
    const segmentLength = 1 / (stars.length - 1);
    const currentSegmentIndex = Math.floor(starPosition / segmentLength);
    const t = (starPosition % segmentLength) / segmentLength;

    if (currentSegmentIndex < stars.length - 1) {
      const startStar = stars[currentSegmentIndex];
      const endStar = stars[currentSegmentIndex + 1];
      currentStarX = (startStar.x * (1 - t) + endStar.x * t) * canvas.width;
      currentStarY = (startStar.y * (1 - t) + endStar.y * t) * canvas.height;
    } else {
      // Если звезда достигла последней точки
      currentStarX = stars[stars.length - 1].x * canvas.width;
      currentStarY = stars[stars.length - 1].y * canvas.height;
    }
  } else {
    // Заглушка, если звёзд нет
    currentStarX = 0;
    currentStarY = 0;
  }
  // Конец НОВОГО блока

  draw();

  // 3. ПЕРЕЗАПУСК АНИМАЦИИ: Гарантируем, что анимация возобновится после изменения размера.
  if (starPosition !== targetStarPosition) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animateStar();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем линии созвездия
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  stars.forEach((star, i) => {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Рисуем неподвижные звёзды
  stars.forEach((star) => {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.shadowColor = "white";
    ctx.shadowBlur = 10;
    ctx.fill();
  });

  // Рисуем летающую звёздочку и её след
  if (stars.length > 1) {
    const segmentLength = 1 / (stars.length - 1);
    const currentSegmentIndex = Math.floor(starPosition / segmentLength);
    const t = (starPosition % segmentLength) / segmentLength;

    // ВАЖНО: Если анимация активна (starPosition < 1), пересчитываем координаты
    // для корректного движения по новой траектории
    if (starPosition < 1) {
      if (currentSegmentIndex < stars.length - 1) {
        const startStar = stars[currentSegmentIndex];
        const endStar = stars[currentSegmentIndex + 1];

        const x = (startStar.x * (1 - t) + endStar.x * t) * canvas.width;
        const y = (startStar.y * (1 - t) + endStar.y * t) * canvas.height;

        // Только если координаты изменились (в процессе анимации)
        if (currentStarX !== 0 && currentStarY !== 0) {
          const dx = x - currentStarX;
          const dy = y - currentStarY;
          rotationAngle = Math.atan2(dy, dx) + Math.PI / 2;
        }

        previousStarX = currentStarX;
        previousStarY = currentStarY;
        currentStarX = x;
        currentStarY = y;
      } else {
        // Если звезда достигла последней точки
        currentStarX = stars[stars.length - 1].x * canvas.width;
        currentStarY = stars[stars.length - 1].y * canvas.height;
      }
    }

    // Добавляем текущее положение звезды в массив следа
    trail.push({ x: currentStarX, y: currentStarY });
    if (trail.length > maxTrailLength) {
      trail.shift();
    }

    // Рисуем след
    for (let i = 0; i < trail.length; i++) {
      const trailPoint = trail[i];
      const alpha = (i / trail.length) * trailFadeFactor;
      const size = (i / trail.length) * (starSize / 1.1);

      ctx.beginPath();
      ctx.arc(trailPoint.x, trailPoint.y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.shadowBlur = 5;
      ctx.fill();
    }

    // Рисуем саму звёздочку
    ctx.save();
    ctx.translate(currentStarX, currentStarY);
    ctx.rotate(rotationAngle);

    ctx.beginPath();
    const path = new Path2D(starSvgPath);
    ctx.transform(
      starSize / 19,
      0,
      0,
      starSize / 19,
      -starSize / 2,
      -starSize / 2
    );
    ctx.fill(path);

    ctx.fillStyle = "white";
    ctx.shadowColor = "white";
    ctx.shadowBlur = 15;
    ctx.fill();

    ctx.restore();
  }
}

function animateStar() {
  if (Math.abs(starPosition - targetStarPosition) > 0.0001) {
    starPosition += (targetStarPosition - starPosition) * starSpeed;
    draw();
    animationFrameId = requestAnimationFrame(animateStar);
  } else {
    starPosition = targetStarPosition;
    trail.length = 0;
    draw();
    cancelAnimationFrame(animationFrameId);
  }
}

let currentSectionIndex = 0;
window.addEventListener("scroll", () => {
  let newSectionIndex = currentSectionIndex;
  for (let i = 0; i < sections.length; i++) {
    const sectionElement = document.querySelector(sections[i][0]);
    if (
      sectionElement &&
      window.scrollY >= sectionElement.offsetTop - window.innerHeight / 1.2
    ) {
      newSectionIndex = i;
    }
  }

  if (newSectionIndex !== currentSectionIndex) {
    currentSectionIndex = newSectionIndex;
    targetStarPosition = currentSectionIndex / (sections.length - 1);

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animateStar();
    sections.forEach((sec, idx) => {
      const starElem = document.querySelector(sec[1]);
      if (starElem) {
        if (idx === currentSectionIndex) {
          starElem.classList.add("glowing-star");
        } else {
          starElem.classList.remove("glowing-star");
        }
      }
    });
  }
});

setTimeout(resizeCanvas, 100);
window.addEventListener("resize", resizeCanvas);

// === ЛОГИКА ДИНАМИЧЕСКОЙ НАВИГАЦИОННЙ ПАНЕЛИ ===

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(sections[0][1])[0].classList.add("glowing-star");
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const navLinks = navbar.querySelectorAll('a[href^="#"]');

  const SCROLL_THRESHOLD = 50;
  const MOUSE_TOP_THRESHOLD = 100;

  let isNavigating = false;
  let lastMouseY = 0;

  function handleScroll() {
    if (isNavigating) return;

    const isScrolledDown = window.scrollY > SCROLL_THRESHOLD;

    if (isScrolledDown) {
      navbar.classList.add("nav-hidden-up", "pointer-events-none");
    } else {
      navbar.classList.remove("nav-hidden-up", "pointer-events-none");
    }
  }

  function handleMouseMove(e) {
    lastMouseY = e.clientY;

    const isScrolledDown = window.scrollY > SCROLL_THRESHOLD;

    if (isScrolledDown) {
      if (e.clientY < MOUSE_TOP_THRESHOLD) {
        navbar.classList.remove("nav-hidden-up", "pointer-events-none");
      } else {
        navbar.classList.add("nav-hidden-up", "pointer-events-none");
      }
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navbar.classList.remove("nav-hidden-up", "pointer-events-none");
      isNavigating = true;

      setTimeout(() => {
        isNavigating = false;

        const isScrolledDown = window.scrollY > SCROLL_THRESHOLD;

        if (!(isScrolledDown && lastMouseY < MOUSE_TOP_THRESHOLD)) {
          handleScroll();
        }
      }, 800);
    });
  });

  window.addEventListener("scroll", handleScroll);
  document.body.addEventListener("mousemove", handleMouseMove);

  handleScroll();
});




// === ЛОГИКА ВЫДЕЛЕНИЯ ПЕРСОНАЖЕЙ В КОМАНДЕ ===
document.addEventListener("DOMContentLoaded", () => {
    const persons = [
        document.querySelectorAll('#person1')[0],
        document.querySelectorAll('#person2')[0],
        document.querySelectorAll('#person3')[0],
        document.querySelectorAll('#person4')[0],
    ];
    const descriptionItems = document.querySelectorAll('.description-item');

    let selectedIndex = 0;
    persons.forEach((person, index) => {
        person.addEventListener('mouseover', () => {
            selectedIndex = index;
            updateSelection();
        })});

    const updateSelection = () => {
        persons.forEach((person, index) => {
            if (index === selectedIndex) {
                person.classList.add('selected');
                descriptionItems[index].classList.add('description-item-active');
            } else {
                person.classList.remove('selected');
                descriptionItems[index].classList.remove('description-item-active');
            } 
        });
    }

});





// === ЗВЕЗДНОЕ ПОЛЕ ===

document.addEventListener('DOMContentLoaded', () => {
    // 1. Находим элементы слоев
    const farStars = document.getElementById('stars-far');
    const midStars = document.getElementById('stars-mid');
    const closeStars = document.getElementById('stars-close');
    
    // 2. Определяем коэффициенты движения (чем больше, тем быстрее движется фон)
    // Эти значения могут быть меньше, чем в предыдущем примере, 
    // так как мы управляем фоном, а не целым элементом.
    const speedFar = -0.02;  
    const speedMid = -0.2;  
    const speedClose = -0.6; 

    function handleScroll() {
        const scrollPosition = window.pageYOffset; 

        // 3. Вычисляем сдвиг и применяем его к background-position
        
        // Дальний слой (медленно)
        const yFar = scrollPosition * speedFar;
        // background-position: X-позиция Y-позиция
        farStars.style.backgroundPositionY = `${yFar}px`;

        // Средний слой (средняя скорость)
        const yMid = scrollPosition * speedMid;
        midStars.style.backgroundPositionY = `${yMid}px`;

        // Ближний слой (быстро)
        const yClose = scrollPosition * speedClose;
        closeStars.style.backgroundPositionY = `${yClose}px`;
    }

    // Добавляем обработчик события прокрутки
    window.addEventListener('scroll', handleScroll, { passive: true }); // passive: true для лучшей производительности
});


// === ПОЯВЛЕНИЕ ТЕКСТА В ОБЛАКЕ ===
document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);

    // 2. Находим все элементы, которые нужно анимировать
    const title = document.querySelector('#about h2');
    const star = document.querySelector('#star-2');
    const paragraphs = gsap.utils.toArray('#dialog-cloud p');
    const ar_paragraphs = gsap.utils.toArray(['#ar p','#ar a']);
    const hero_paragraph = gsap.utils.toArray('#hero p');
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#about",
            start: "top 50%",
            end: "bottom center",
            toggleActions: "play none none none",
        }
    });
    const ar_tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#ar",
            start: "top 10%",
            end: "bottom center",
            toggleActions: "play none none none",
        }
    });
    const hero_tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#hero",
            end: "bottom center",
            toggleActions: "play none none none",
        },
    });

    // tl.from(title, {
    //     opacity: 0,
    //     y: -30,
    //     duration: 0.5,
    //     ease: "power2.out"
    // });

    tl.to(paragraphs, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
        stagger: 0.6, 
        clearProps: "visibility",
    }, "<0.3");
    ar_tl.to(ar_paragraphs, {
        opacity: 0.8,
        y: 0,
        duration: 1,
        ease: "power2.out",
        clearProps: "visibility",
    }, "<0.3");
    hero_tl.to(hero_paragraph[0], {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
        clearProps: "visibility",
    }, "<0.3");
    hero_tl.to(hero_paragraph[1], {
        opacity: 0.7,
        y: 0,
        duration: 1,
        ease: "power2.out",
        clearProps: "visibility",
    }, "<0.5");

});




