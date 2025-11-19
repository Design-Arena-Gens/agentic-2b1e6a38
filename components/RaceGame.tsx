"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Car = {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
};

export type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  hue: number;
};

export type Stripe = {
  y: number;
};

export type Track = {
  laneCount: number;
  left: number;
  right: number;
  width: number;
  laneWidth: number;
};

export type BoostState = {
  value: number;
  active: boolean;
};

export type WorldState = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  car: Car;
  track: Track;
  stripes: Stripe[];
  obstacles: Obstacle[];
  lastTimestamp: number;
  spawnElapsed: number;
  speed: number;
  baseSpeed: number;
  targetSpeed: number;
  distance: number;
  boost: BoostState;
  flashTimer: number;
};

const INITIAL_HIGH_SCORE = 0;

const detectCollision = (car: Car, obstacle: Obstacle) => {
  return !(
    car.x + car.width < obstacle.x + 6 ||
    car.x > obstacle.x + obstacle.width - 6 ||
    car.y + car.height < obstacle.y + 6 ||
    car.y > obstacle.y + obstacle.height - 6
  );
};

const spawnObstacle = (state: WorldState) => {
  const { laneWidth, left, laneCount } = state.track;
  const lane = Math.floor(Math.random() * laneCount);
  const width = laneWidth * (0.5 + Math.random() * 0.08);
  const height = width * (1.4 + Math.random() * 0.2);
  const x = left + lane * laneWidth + laneWidth / 2 - width / 2;
  const speed = state.speed * (1.05 + Math.random() * 0.15);
  const hue = Math.floor(200 + Math.random() * 120);
  state.obstacles.push({ x, y: -height - 20, width, height, speed, hue });
};

const drawScene = (state: WorldState) => {
  const { ctx, width, height, car, track } = state;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#06061e");
  gradient.addColorStop(0.4, "#0b0d25");
  gradient.addColorStop(1, "#02010d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Track
  const trackGradient = ctx.createLinearGradient(0, 0, 0, height);
  trackGradient.addColorStop(0, "rgba(8, 22, 54, 0.9)");
  trackGradient.addColorStop(1, "rgba(7, 12, 32, 0.95)");
  ctx.fillStyle = trackGradient;
  ctx.fillRect(track.left, 0, track.width, height);

  // Track edge glow
  const edgeGlow = ctx.createLinearGradient(track.left, 0, track.left + 20, 0);
  edgeGlow.addColorStop(0, "rgba(72, 111, 255, 0.65)");
  edgeGlow.addColorStop(1, "transparent");
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(track.left - 14, 0, 30, height);
  const edgeGlowRight = ctx.createLinearGradient(track.right, 0, track.right - 20, 0);
  edgeGlowRight.addColorStop(0, "rgba(207, 88, 255, 0.55)");
  edgeGlowRight.addColorStop(1, "transparent");
  ctx.fillStyle = edgeGlowRight;
  ctx.fillRect(track.right - 16, 0, 28, height);

  // Lane markers
  ctx.lineWidth = Math.max(4, track.laneWidth * 0.06);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.setLineDash([30, 30]);
  for (let i = 1; i < track.laneCount; i += 1) {
    const x = track.left + i * track.laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Road stripes
  const stripeWidth = Math.max(22, track.laneWidth * 0.18);
  const stripeHeight = Math.max(36, track.laneWidth * 0.42);
  const laneCenters = Array.from({ length: track.laneCount }).map(
    (_, index) => track.left + track.laneWidth * index + track.laneWidth / 2
  );
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#f8f9ff";
  state.stripes.forEach((stripe) => {
    laneCenters.forEach((center) => {
      ctx.fillRect(center - stripeWidth / 2, stripe.y, stripeWidth, stripeHeight);
    });
  });
  ctx.globalAlpha = 1;

  // Rival cars
  state.obstacles.forEach((obstacle) => {
    const carBody = ctx.createLinearGradient(
      obstacle.x,
      obstacle.y,
      obstacle.x + obstacle.width,
      obstacle.y + obstacle.height
    );
    carBody.addColorStop(0, `hsla(${obstacle.hue}, 80%, 62%, 0.92)`);
    carBody.addColorStop(1, `hsla(${obstacle.hue + 40}, 85%, 52%, 0.86)`);
    ctx.fillStyle = carBody;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    const windowHeight = obstacle.height * 0.35;
    const windowY = obstacle.y + obstacle.height * 0.18;
    ctx.fillRect(
      obstacle.x + obstacle.width * 0.18,
      windowY,
      obstacle.width * 0.64,
      windowHeight
    );

    ctx.fillStyle = "rgba(255, 198, 90, 0.85)";
    const headlightWidth = obstacle.width * 0.22;
    const headlightHeight = obstacle.height * 0.12;
    ctx.fillRect(
      obstacle.x + obstacle.width * 0.12,
      obstacle.y + obstacle.height - headlightHeight - 4,
      headlightWidth,
      headlightHeight
    );
    ctx.fillRect(
      obstacle.x + obstacle.width - headlightWidth - obstacle.width * 0.12,
      obstacle.y + obstacle.height - headlightHeight - 4,
      headlightWidth,
      headlightHeight
    );
  });

  // Player car glow
  if (state.boost.active) {
    ctx.save();
    const glow = ctx.createRadialGradient(
      car.x + car.width / 2,
      car.y + car.height * 0.9,
      10,
      car.x + car.width / 2,
      car.y + car.height,
      120
    );
    glow.addColorStop(0, "rgba(86, 204, 255, 0.58)");
    glow.addColorStop(1, "rgba(86, 204, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(track.left - 80, car.y - 20, track.width + 160, 200);
    ctx.restore();
  }

  // Player car
  ctx.save();
  ctx.translate(car.x, car.y);
  const playerGradient = ctx.createLinearGradient(0, 0, car.width, car.height);
  playerGradient.addColorStop(0, "rgba(95, 255, 200, 0.95)");
  playerGradient.addColorStop(1, "rgba(137, 92, 255, 0.95)");
  ctx.fillStyle = playerGradient;
  ctx.beginPath();
  const radius = car.width * 0.18;
  ctx.moveTo(radius, 0);
  ctx.lineTo(car.width - radius, 0);
  ctx.quadraticCurveTo(car.width, 0, car.width, radius);
  ctx.lineTo(car.width, car.height - radius);
  ctx.quadraticCurveTo(car.width, car.height, car.width - radius, car.height);
  ctx.lineTo(radius, car.height);
  ctx.quadraticCurveTo(0, car.height, 0, car.height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Roof
  ctx.fillStyle = "rgba(20, 28, 46, 0.9)";
  ctx.fillRect(
    car.width * 0.22,
    car.height * 0.2,
    car.width * 0.56,
    car.height * 0.48
  );

  // Tail lights
  ctx.fillStyle = "rgba(255, 75, 137, 0.95)";
  const tailHeight = car.height * 0.18;
  const tailWidth = car.width * 0.22;
  ctx.fillRect(car.width * 0.12, car.height - tailHeight - 4, tailWidth, tailHeight);
  ctx.fillRect(
    car.width - tailWidth - car.width * 0.12,
    car.height - tailHeight - 4,
    tailWidth,
    tailHeight
  );
  ctx.restore();

  if (state.flashTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, state.flashTimer / 120);
    ctx.fillStyle = "rgba(255, 72, 110, 0.4)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

function createStripes(trackHeight: number, spacing: number): Stripe[] {
  const stripes: Stripe[] = [];
  const count = Math.ceil(trackHeight / spacing) + 2;
  for (let i = 0; i < count; i += 1) {
    stripes.push({ y: i * spacing });
  }
  return stripes;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function RaceGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const keyStateRef = useRef<Record<string, boolean>>({});
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 640,
    height: 880,
    dpr: 1
  });
  const hudRef = useRef({ score: 0, speed: 0, boost: 100 });

  const [score, setScore] = useState(0);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [highScore, setHighScore] = useState(INITIAL_HIGH_SCORE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [boostValue, setBoostValue] = useState(100);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const updateTrackGeometry = useCallback(
    (state: WorldState, preserveLane: boolean) => {
      const { width, height } = sizeRef.current;
      const laneCount = state.track.laneCount;

      const prevTrack = state.track;
      const prevLaneWidth = prevTrack.laneWidth;
      const prevLeft = prevTrack.left;

      const trackWidth = width * 0.62;
      const left = (width - trackWidth) / 2;
      const laneWidth = trackWidth / laneCount;

      let laneIndex = Math.floor(laneCount / 2);
      if (preserveLane) {
        const carCenter = state.car.x + state.car.width / 2;
        laneIndex = clamp(
          Math.floor((carCenter - prevLeft) / prevLaneWidth),
          0,
          laneCount - 1
        );
      }

      const carWidth = laneWidth * 0.58;
      const carHeight = carWidth * 1.6;
      state.car.width = carWidth;
      state.car.height = carHeight;
      state.car.x = left + laneWidth * laneIndex + laneWidth / 2 - carWidth / 2;
      state.car.y = height - carHeight - Math.max(40, height * 0.05);
      state.car.velocityX = 0;

      state.track = {
        laneCount,
        left,
        right: width - left,
        width: trackWidth,
        laneWidth
      };

      state.stripes = state.stripes.map((stripe) => ({
        y: (stripe.y / state.height) * height
      }));

      state.obstacles = state.obstacles.map((obstacle) => {
        const carCenter =
          obstacle.x + obstacle.width / 2 - prevLeft + prevLaneWidth / 2;
        const lane = clamp(
          Math.floor(carCenter / prevLaneWidth),
          0,
          laneCount - 1
        );
        const widthScaled = laneWidth * 0.54;
        const heightScaled = widthScaled * 1.55;
        return {
          ...obstacle,
          width: widthScaled,
          height: heightScaled,
          x: left + laneWidth * lane + laneWidth / 2 - widthScaled / 2,
          y: (obstacle.y / state.height) * height
        };
      });

      state.width = width;
      state.height = height;
    },
    []
  );

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.min(wrapper.clientWidth, 760);
    const minHeight = 520;
    const computedHeight = Math.round(width * 1.4);
    const height = clamp(computedHeight, minHeight, 900);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    sizeRef.current = { width, height, dpr };

    const state = worldRef.current;
    if (state) {
      state.ctx = ctx;
      updateTrackGeometry(state, true);
    }
  }, [updateTrackGeometry]);

  const stopGame = useCallback(() => {
    cancelAnimation();
    setIsPlaying(false);
    setIsGameOver(true);
    const currentScore = Math.floor(worldRef.current?.distance ?? 0);
    setScore(currentScore);
    setDisplaySpeed(0);
    setBoostValue(100);
    if (currentScore > highScore) {
      setHighScore(currentScore);
      if (typeof window !== "undefined") {
        localStorage.setItem("neon-sprint::highscore", `${currentScore}`);
      }
    }
  }, [cancelAnimation, highScore]);

  const loop = useCallback(
    (timestamp: number) => {
      const state = worldRef.current;
      if (!state) return;

      const delta = state.lastTimestamp ? timestamp - state.lastTimestamp : 16.666;
      state.lastTimestamp = timestamp;
      const dt = clamp(delta / 16.666, 0.4, 1.8);

      const keys = keyStateRef.current;

      const boostPressed = keys[" "] || keys.space;
      const leftPressed = keys.arrowleft || keys.a;
      const rightPressed = keys.arrowright || keys.d;

      const acceleration = state.track.laneWidth * 0.012;
      const maxVelocity = state.track.laneWidth * 0.22;
      const friction = 0.86;

      if (leftPressed) {
        state.car.velocityX -= acceleration * dt;
      } else if (rightPressed) {
        state.car.velocityX += acceleration * dt;
      } else {
        state.car.velocityX *= friction;
      }

      state.car.velocityX = clamp(state.car.velocityX, -maxVelocity, maxVelocity);
      state.car.x += state.car.velocityX * dt;

      const leftLimit = state.track.left + state.car.width * 0.1;
      const rightLimit =
        state.track.right - state.car.width * 1.1;
      if (state.car.x < leftLimit) {
        state.car.x = leftLimit;
        state.car.velocityX *= -0.25;
      } else if (state.car.x > rightLimit) {
        state.car.x = rightLimit;
        state.car.velocityX *= -0.25;
      }

      const boost = state.boost;
      if (boostPressed && boost.value > 0) {
        boost.active = true;
        boost.value = clamp(boost.value - dt * 2.2, 0, 100);
      } else {
        boost.active = false;
        boost.value = clamp(boost.value + dt * 0.9, 0, 100);
      }

      const distanceFactor = clamp(state.distance / 2200, 0, 8);
      const boostBonus = boost.active ? 5.2 : 0;
      state.targetSpeed = state.baseSpeed + distanceFactor + boostBonus;
      state.speed += (state.targetSpeed - state.speed) * 0.06 * dt;

      const trackMovement = state.speed * dt * 12;
      state.distance += state.speed * dt * 0.95;

      const stripeSpacing = state.track.laneWidth * 2.2;
      const stripeLength = stripeSpacing * 0.52;
      state.stripes.forEach((stripe) => {
        stripe.y += trackMovement;
        if (stripe.y - stripeLength > state.height) {
          stripe.y -= stripeSpacing * state.stripes.length;
        }
      });

      state.spawnElapsed += delta;
      const spawnInterval = clamp(900 - state.distance * 0.45, 380, 900);
      if (state.spawnElapsed >= spawnInterval) {
        state.spawnElapsed = 0;
        spawnObstacle(state);
      }

      const safeSpeed = Math.max(state.speed, 0.1);
      state.obstacles = state.obstacles.filter((obstacle) => {
        obstacle.y += trackMovement * (0.82 + obstacle.speed / (safeSpeed * 4));
        return obstacle.y < state.height + obstacle.height;
      });

      let collisionDetected = false;
      for (let i = 0; i < state.obstacles.length; i += 1) {
        if (detectCollision(state.car, state.obstacles[i])) {
          collisionDetected = true;
          break;
        }
      }

      if (collisionDetected) {
        state.flashTimer = 220;
        drawScene(state);
        stopGame();
        return;
      }

      if (state.flashTimer > 0) {
        state.flashTimer = Math.max(0, state.flashTimer - delta);
      }

      drawScene(state);

      const numericScore = Math.floor(state.distance);
      if (numericScore !== hudRef.current.score) {
        hudRef.current.score = numericScore;
        setScore(numericScore);
      }

      const speedDisplay = Math.round(state.speed * 12);
      if (speedDisplay !== hudRef.current.speed) {
        hudRef.current.speed = speedDisplay;
        setDisplaySpeed(speedDisplay);
      }

      const boostRounded = Math.round(state.boost.value);
      if (boostRounded !== hudRef.current.boost) {
        hudRef.current.boost = boostRounded;
        setBoostValue(boostRounded);
      }

      animationRef.current = requestAnimationFrame(loop);
    },
    [stopGame]
  );

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, dpr } = sizeRef.current;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const trackWidth = width * 0.62;
    const laneCount = 3;
    const laneWidth = trackWidth / laneCount;
    const trackLeft = (width - trackWidth) / 2;

    const carWidth = laneWidth * 0.58;
    const carHeight = carWidth * 1.6;

    const car: Car = {
      x: trackLeft + laneWidth * 1 + laneWidth / 2 - carWidth / 2,
      y: height - carHeight - Math.max(40, height * 0.05),
      width: carWidth,
      height: carHeight,
      velocityX: 0
    };

    worldRef.current = {
      ctx,
      width,
      height,
      dpr,
      car,
      track: {
        laneCount,
        left: trackLeft,
        right: width - trackLeft,
        width: trackWidth,
        laneWidth
      },
      stripes: createStripes(height, laneWidth * 2.2),
      obstacles: [],
      lastTimestamp: performance.now(),
      spawnElapsed: 0,
      speed: 6.2,
      baseSpeed: 6.2,
      targetSpeed: 6.2,
      distance: 0,
      boost: { value: 100, active: false },
      flashTimer: 0
    };

    hudRef.current = { score: 0, speed: 0, boost: 100 };
    setScore(0);
    setDisplaySpeed(0);
    setIsPlaying(true);
    setIsGameOver(false);
    setBoostValue(100);

    cancelAnimation();
    animationRef.current = requestAnimationFrame(loop);
  }, [cancelAnimation, loop]);

  useEffect(() => {
    const storedHighScore =
      typeof window !== "undefined"
        ? parseInt(localStorage.getItem("neon-sprint::highscore") || "0", 10)
        : 0;
    setHighScore(Number.isNaN(storedHighScore) ? 0 : storedHighScore);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keyStateRef.current[key] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
      }
      if (!isPlaying && key === "enter") {
        startGame();
      }
      if (isGameOver && key === "r") {
        startGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keyStateRef.current[key] = false;
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isGameOver, isPlaying, startGame]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    return () => {
      cancelAnimation();
    };
  }, [cancelAnimation]);

  const handleReset = useCallback(() => {
    startGame();
  }, [startGame]);

  return (
    <div className="game-container">
      <div className="hud">
        <div className="hud-item">
          <span className="hud-label">Distance</span>
          <span className="hud-value">{score.toLocaleString()} m</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Speed</span>
          <span className="hud-value">{displaySpeed} km/h</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Best</span>
          <span className="hud-value">{highScore.toLocaleString()} m</span>
        </div>
      </div>

      <div className="boost-bar">
        <div
          className="boost-bar__fill"
          style={{ width: `${boostValue}%` }}
        />
        <span className="boost-bar__label">Phase Drive {boostValue}%</span>
      </div>

      <div className="canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} className="game-canvas" />
        {!isPlaying && (
          <div className="overlay">
            <div className="overlay-card">
              <h2>{isGameOver ? "Crash Detected" : "Neon Sprint"}</h2>
              <p>
                {isGameOver
                  ? "You collided with a rival. Strap in and try again."
                  : "Dodge rival racers, survive the neon highway, and push your distance record."}
              </p>
              <ul>
                <li>W / ↑ to accelerate lanes</li>
                <li>A / ← and D / → to steer</li>
                <li>Space to engage Phase Drive boost</li>
                <li>R to reset instantly</li>
              </ul>
              <button onClick={handleReset}>
                {isGameOver ? "Race Again" : "Start Race"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
