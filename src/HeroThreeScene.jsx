import {useEffect, useRef} from "react";
import {createTimeline, cubicBezier, spring} from "animejs";
import * as THREE from "three";

export const DEFAULT_SCENE_TUNING = Object.freeze({
  x: -114,
  y: -31,
  z: -156,
  scale: .97,
  rx: -4.9,
  ry: -30,
  rz: 0,
});

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const asset = (path) => `${import.meta.env.BASE_URL}assets/${path}`;
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function plane(width, height, material) {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function textureSettings(texture, renderer) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function makePanel(texture, width, height, selected = false) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const artwork = plane(width, height, material);
  artwork.renderOrder = 10;
  group.add(artwork);

  const adornments = [];
  if (selected) {
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
      borderMaterial,
    );
    border.position.z = 4;
    border.renderOrder = 11;
    group.add(border);
    adornments.push(borderMaterial);

    const handleGeometry = new THREE.PlaneGeometry(9, 9);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([x, y]) => {
      const handleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthTest: false,
      });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.set(x * width / 2, y * height / 2, 6);
      handle.renderOrder = 12;
      group.add(handle);
      adornments.push(handleMaterial);
    });
  }

  return {group, material, adornments};
}

export function HeroThreeScene({tuning = DEFAULT_SCENE_TUNING}) {
  const containerRef = useRef(null);
  const tuningRef = useRef(tuning);

  useEffect(() => {
    tuningRef.current = tuning;
  }, [tuning]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x050507, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 4000);
    const world = new THREE.Group();
    scene.add(world);

    const manager = new THREE.LoadingManager();
    let loadedAt = null;
    manager.onLoad = () => { loadedAt = performance.now(); };
    const loader = new THREE.TextureLoader(manager);
    const workspaceTexture = textureSettings(loader.load(asset("hero-workspace-v3.webp")), renderer);
    const timelineTexture = textureSettings(loader.load(asset("hero-timeline-v4.webp")), renderer);
    const visualTexture = textureSettings(loader.load(asset("hero-visual-v2.webp")), renderer);
    const clipTexture = textureSettings(loader.load(asset("hero-clip-v2.webp")), renderer);

    const workspace = new THREE.Group();
    const workspaceWidth = 1050;
    const workspaceHeight = 450;
    const workspaceShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const workspaceShadow = plane(workspaceWidth + 26, workspaceHeight + 26, workspaceShadowMaterial);
    workspaceShadow.position.set(20, -24, -12);
    workspace.add(workspaceShadow);
    const workspaceMaterial = new THREE.MeshBasicMaterial({
      map: workspaceTexture,
      transparent: true,
      opacity: 0,
    });
    workspace.add(plane(workspaceWidth, workspaceHeight, workspaceMaterial));
    const playerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const playerGlow = plane(455, 318, playerGlowMaterial);
    playerGlow.position.set(86, -34, 14);
    workspace.add(playerGlow);
    workspace.position.set(315, 98, -105);
    world.add(workspace);

    const timeline = new THREE.Group();
    const timelineWidth = 1360;
    const timelineHeight = 310;
    const timelineShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const timelineShadow = plane(timelineWidth + 28, timelineHeight + 28, timelineShadowMaterial);
    timelineShadow.position.set(18, -22, -12);
    timeline.add(timelineShadow);
    const timelineMaterial = new THREE.MeshBasicMaterial({
      map: timelineTexture,
      transparent: true,
      opacity: 0,
    });
    timeline.add(plane(timelineWidth, timelineHeight, timelineMaterial));
    const timelinePlayheadMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const timelinePlayheadGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-250, timelineHeight / 2 - 4, 18),
      new THREE.Vector3(-250, -timelineHeight / 2 - 8, 18),
    ]);
    timeline.add(new THREE.Line(timelinePlayheadGeometry, timelinePlayheadMaterial));
    timeline.position.set(150, -276, 48);
    world.add(timeline);

    const cardWidth = 330;
    const cardHeight = 220;
    const source = makePanel(visualTexture, cardWidth, cardHeight, true);
    const duplicate = makePanel(visualTexture, cardWidth, cardHeight, true);
    const sourcePosition = new THREE.Vector3(260, 55, 172);
    const liftedPosition = new THREE.Vector3(260, 55, 265);
    const playerPosition = new THREE.Vector3(401, 64, -82);
    const playerScale = 1.24;
    source.group.position.copy(sourcePosition);
    duplicate.group.position.copy(sourcePosition);
    world.add(source.group, duplicate.group);

    const clipWidth = 940;
    const clipHeight = 253;
    const clipAnchor = new THREE.Group();
    const clipMaterial = new THREE.MeshBasicMaterial({
      map: clipTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const clipMesh = plane(clipWidth, clipHeight, clipMaterial);
    clipAnchor.add(clipMesh);
    clipAnchor.position.set(-5, 60, 20);
    clipAnchor.scale.x = 0.001;
    timeline.add(clipAnchor);

    const landingPoint = new THREE.Vector3(145, -216, 86);
    const guideLandingPoint = new THREE.Vector3(90, -178, 90);
    const motionCurve = new THREE.CubicBezierCurve3(
      liftedPosition,
      new THREE.Vector3(252, -4, 246),
      new THREE.Vector3(166, -132, 132),
      landingPoint,
    );
    const floatingGuideStart = new THREE.Vector3(110, -60, 256);
    const guideCurve = new THREE.CubicBezierCurve3(
      floatingGuideStart,
      new THREE.Vector3(62, -102, 224),
      new THREE.Vector3(72, -152, 134),
      guideLandingPoint,
    );
    const guideSamplePoints = guideCurve.getSpacedPoints(72);
    const svgNamespace = "http://www.w3.org/2000/svg";
    const guideOverlay = document.createElementNS(svgNamespace, "svg");
    guideOverlay.setAttribute("aria-hidden", "true");
    Object.assign(guideOverlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "4",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "opacity",
    });
    const guidePathOverlay = document.createElementNS(svgNamespace, "path");
    guidePathOverlay.setAttribute("fill", "none");
    guidePathOverlay.setAttribute("stroke", "#ffffff");
    guidePathOverlay.setAttribute("stroke-width", "4");
    guidePathOverlay.setAttribute("stroke-dasharray", "8 10");
    guidePathOverlay.setAttribute("stroke-linecap", "round");
    guidePathOverlay.setAttribute("stroke-linejoin", "round");
    const arrowPath = document.createElementNS(svgNamespace, "path");
    arrowPath.setAttribute("fill", "none");
    arrowPath.setAttribute("stroke", "#ffffff");
    arrowPath.setAttribute("stroke-width", "4");
    arrowPath.setAttribute("stroke-linecap", "round");
    arrowPath.setAttribute("stroke-linejoin", "round");
    guideOverlay.append(guidePathOverlay, arrowPath);
    container.appendChild(guideOverlay);

    const trackGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trackGlow = plane(clipWidth + 26, 72, trackGlowMaterial);
    trackGlow.position.set(-5, 60, 15);
    timeline.add(trackGlow);

    const impactMaterial = new THREE.MeshBasicMaterial({
      color: 0x64d2ff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const impactRing = new THREE.Mesh(new THREE.RingGeometry(12, 16, 48), impactMaterial);
    impactRing.position.copy(landingPoint);
    world.add(impactRing);

    const introEase = spring({duration: 1100, bounce: -.08}).ease;
    const motion = {lift: 0, guide: 0, travel: 0, compress: 0, clip: 0, settle: 0};
    const motionTimeline = createTimeline({autoplay: false})
      .add(motion, {lift: 1, ease: spring({duration: 700, bounce: -.12})}, 850)
      .add(motion, {guide: 1, duration: 900, ease: cubicBezier(.16, 1, .3, 1)}, 950)
      .add(motion, {travel: 1, duration: 1650, ease: cubicBezier(.22, 1, .36, 1)}, 1350)
      .add(motion, {compress: 1, ease: spring({duration: 420, bounce: -.14})}, 2580)
      .add(motion, {clip: 1, ease: spring({duration: 620, bounce: .04})}, 2920)
      .add(motion, {settle: 1, ease: spring({duration: 1000, bounce: -.08})}, 3500)
      .add({duration: 10800}, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fixedMotionParam = new URLSearchParams(window.location.search).get("motion");
    const fixedMotion = fixedMotionParam === null ? null : Number(fixedMotionParam);

    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    const onPointerMove = (event) => {
      const bounds = container.getBoundingClientRect();
      pointerTarget.set(
        ((event.clientX - bounds.left) / bounds.width - .5) * 2,
        ((event.clientY - bounds.top) / bounds.height - .5) * 2,
      );
    };
    const onPointerLeave = () => pointerTarget.set(0, 0);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    let baseScale = 1;
    let baseX = 0;
    let baseY = 0;
    let guideOffsetX = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      viewportWidth = width;
      viewportHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, 0, height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
      camera.updateProjectionMatrix();
      if (width <= 760) {
        baseScale = .44;
        baseX = -34;
        baseY = -100;
        guideOffsetX = 80;
      } else if (width <= 1080) {
        baseScale = .72;
        baseX = -52;
        baseY = -162;
        guideOffsetX = 0;
      } else {
        baseScale = Math.min(1.14, Math.max(.96, width / 1536));
        baseX = 0;
        baseY = baseScale > 1 ? 18 : 0;
        guideOffsetX = 0;
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const setPanelOpacity = (panel, opacity) => {
      panel.material.opacity = opacity;
      panel.adornments.forEach((material) => { material.opacity = opacity; });
    };

    let previousFrame = performance.now();
    let averageFrameMs = 16.67;
    let maxFrameMs = 0;
    let droppedFrames = 0;
    const render = (now) => {
      const frameMs = now - previousFrame;
      previousFrame = now;
      averageFrameMs = averageFrameMs * .94 + frameMs * .06;
      maxFrameMs = Math.max(maxFrameMs, frameMs);
      if (frameMs > 28) droppedFrames += 1;
      if (loadedAt === null) {
        renderer.render(scene, camera);
        return;
      }

      const elapsed = reducedMotion ? 6.6 : Number.isFinite(fixedMotion) ? fixedMotion : (now - loadedAt) / 1000;
      const intro = introEase(clamp01(elapsed / 1.05));
      const cycle = Number.isFinite(fixedMotion) || reducedMotion ? elapsed : Math.max(0, elapsed - .45) % 10.8;
      motionTimeline.seek(cycle * 1000, true);
      const lift = motion.lift;
      const guideReveal = motion.guide;
      const travelRaw = clamp01((cycle - 1.35) / 1.65);
      const travel = motion.travel;
      const impactRaw = clamp01((cycle - 2.9) / .62);
      const clipRaw = clamp01((cycle - 2.92) / .62);
      const clipProgress = clipRaw >= 1 ? 1 : clamp01(motion.clip);
      const settleRaw = clamp01((cycle - 3.5) / 1);
      const settle = settleRaw >= 1 ? 1 : clamp01(motion.settle);
      const playerConfirmRaw = clamp01((cycle - 4.28) / .5);
      const resetOut = smooth((cycle - 9.15) / .48);
      const resetIn = smooth((cycle - 9.78) / .76);

      const controls = tuningRef.current;
      pointer.lerp(pointerTarget, .065);
      world.scale.setScalar(baseScale * controls.scale);
      world.position.set(
        baseX + controls.x,
        baseY + controls.y,
        controls.z - 82 * (1 - intro),
      );
      world.rotation.set(
        THREE.MathUtils.degToRad(controls.rx) - pointer.y * .012,
        THREE.MathUtils.degToRad(controls.ry) + pointer.x * .018,
        THREE.MathUtils.degToRad(controls.rz),
      );

      workspaceMaterial.opacity = intro * .84;
      workspaceShadowMaterial.opacity = intro * .58;
      playerGlowMaterial.opacity = Math.sin(Math.PI * playerConfirmRaw) * .13;
      timelineMaterial.opacity = intro * .94;
      timelineShadowMaterial.opacity = intro * .6;
      timelinePlayheadMaterial.opacity = intro * .82;
      workspace.position.x = 315 + 130 * (1 - intro);
      timeline.position.x = 150 - 110 * (1 - intro);
      timeline.position.y = -276 - 55 * (1 - intro);

      const sourceOpacity = cycle >= 9.15 ? resetIn : 1 - resetOut;
      const sourcePanelOpacity = intro * sourceOpacity;
      setPanelOpacity(source, sourcePanelOpacity);
      const sourceSelection = cycle >= 9.15 ? resetIn : 1 - smooth(settleRaw / .72);
      source.adornments.forEach((material) => { material.opacity = sourcePanelOpacity * sourceSelection; });
      if (cycle >= 9.15) {
        source.group.position.copy(sourcePosition);
        source.group.scale.setScalar(1);
        source.group.rotation.set(0, 0, 0);
      } else {
        source.group.position.lerpVectors(sourcePosition, playerPosition, settle);
        source.group.scale.setScalar(THREE.MathUtils.lerp(1, playerScale, settle));
        source.group.rotation.set(0, 0, 0);
      }

      const duplicateOpacity = smooth((cycle - .78) / .18) * (1 - smooth((cycle - 3.02) / .24));
      duplicate.group.visible = duplicateOpacity > .002;
      setPanelOpacity(duplicate, intro * duplicateOpacity);
      if (travelRaw > 0) {
        duplicate.group.position.copy(motionCurve.getPointAt(travel));
        const compress = clamp01(motion.compress);
        duplicate.group.scale.setScalar(THREE.MathUtils.lerp(1.035, .13, compress));
        duplicate.group.rotation.set(0, 0, 0);
      } else {
        duplicate.group.position.set(
          sourcePosition.x,
          sourcePosition.y,
          THREE.MathUtils.lerp(sourcePosition.z, liftedPosition.z, lift),
        );
        duplicate.group.scale.setScalar(THREE.MathUtils.lerp(1, 1.045, lift));
        duplicate.group.rotation.set(0, 0, 0);
      }

      const guidePresence = motion.guide * (1 - smooth((cycle - 3.02) / .36));
      const arrowProgress = THREE.MathUtils.clamp(guideReveal, .04, 1);
      world.updateMatrixWorld(true);
      const projectGuidePoint = (point) => {
        const projected = point.clone();
        projected.x += guideOffsetX;
        projected.applyMatrix4(world.matrixWorld).project(camera);
        return new THREE.Vector2(
          (projected.x * .5 + .5) * viewportWidth,
          (-projected.y * .5 + .5) * viewportHeight,
        );
      };
      const lineProgress = Math.max(0, arrowProgress - .075);
      const lastSampleIndex = Math.max(1, Math.floor(lineProgress * (guideSamplePoints.length - 1)));
      const visibleGuidePoints = guideSamplePoints.slice(0, lastSampleIndex + 1).map(projectGuidePoint);
      visibleGuidePoints.push(projectGuidePoint(guideCurve.getPointAt(lineProgress)));
      guidePathOverlay.setAttribute(
        "d",
        visibleGuidePoints.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" "),
      );
      guidePathOverlay.setAttribute("stroke-dashoffset", String(-cycle * 18));
      guidePathOverlay.style.opacity = String(guidePresence * .94);

      const arrowTip = projectGuidePoint(guideCurve.getPointAt(arrowProgress));
      const tangentStart = projectGuidePoint(guideCurve.getPointAt(Math.max(0, arrowProgress - .025)));
      const tangent = arrowTip.clone().sub(tangentStart).normalize();
      const perpendicular = new THREE.Vector2(-tangent.y, tangent.x);
      const arrowBack = arrowTip.clone().addScaledVector(tangent, -20);
      const arrowLeft = arrowBack.clone().addScaledVector(perpendicular, 10);
      const arrowRight = arrowBack.clone().addScaledVector(perpendicular, -10);
      arrowPath.setAttribute(
        "d",
        `M ${arrowLeft.x.toFixed(2)} ${arrowLeft.y.toFixed(2)} L ${arrowTip.x.toFixed(2)} ${arrowTip.y.toFixed(2)} L ${arrowRight.x.toFixed(2)} ${arrowRight.y.toFixed(2)}`,
      );
      arrowPath.style.opacity = String(guidePresence * smooth((guideReveal - .04) / .16));

      const impactPulse = Math.sin(Math.PI * impactRaw);
      impactRing.scale.setScalar(THREE.MathUtils.lerp(.7, 1.9, impactRaw));
      impactMaterial.opacity = impactPulse * .22;
      trackGlowMaterial.opacity = impactPulse * .2;
      timelinePlayheadMaterial.opacity = intro * (.62 + impactPulse * .38);

      clipAnchor.scale.x = Math.max(.001, clipProgress);
      clipMaterial.opacity = clipRaw > 0 ? Math.min(1, clipProgress) * (1 - resetOut) : 0;

      let phase = "ready";
      if (cycle >= .85 && cycle < 1.35) phase = "lift";
      else if (cycle >= 1.35 && cycle < 2.9) phase = "follow-guide";
      else if (cycle >= 2.9 && cycle < 3.5) phase = "land-track";
      else if (cycle >= 3.5 && cycle < 4.5) phase = "settle-player";
      else if (cycle >= 4.5 && cycle < 9.15) phase = "complete";
      else if (cycle >= 9.15) phase = "reset";
      renderer.domElement.dataset.motionPhase = phase;
      renderer.domElement.dataset.duplicateX = duplicate.group.position.x.toFixed(2);
      renderer.domElement.dataset.duplicateY = duplicate.group.position.y.toFixed(2);
      renderer.domElement.dataset.duplicateZ = duplicate.group.position.z.toFixed(2);
      renderer.domElement.dataset.sourceX = source.group.position.x.toFixed(2);
      renderer.domElement.dataset.sourceY = source.group.position.y.toFixed(2);
      renderer.domElement.dataset.sourceZ = source.group.position.z.toFixed(2);
      renderer.domElement.dataset.averageFrameMs = averageFrameMs.toFixed(2);
      renderer.domElement.dataset.maxFrameMs = maxFrameMs.toFixed(2);
      renderer.domElement.dataset.droppedFrames = String(droppedFrames);
      renderer.domElement.dataset.sceneScale = controls.scale.toFixed(2);
      renderer.domElement.dataset.sceneX = controls.x.toFixed(0);
      renderer.domElement.dataset.sceneY = controls.y.toFixed(0);
      renderer.domElement.dataset.sceneZ = controls.z.toFixed(0);
      renderer.domElement.dataset.sceneRx = controls.rx.toFixed(1);
      renderer.domElement.dataset.sceneRy = controls.ry.toFixed(1);
      renderer.domElement.dataset.sceneRz = controls.rz.toFixed(1);
      renderer.domElement.dataset.sceneLiveRx = THREE.MathUtils.radToDeg(world.rotation.x).toFixed(3);
      renderer.domElement.dataset.sceneLiveRy = THREE.MathUtils.radToDeg(world.rotation.y).toFixed(3);
      renderer.domElement.dataset.playerAnchorError = source.group.position.distanceTo(playerPosition).toFixed(3);
      renderer.domElement.dataset.trackAnchorError = duplicate.group.position.distanceTo(landingPoint).toFixed(3);
      renderer.domElement.dataset.playerTarget = `${playerPosition.x},${playerPosition.y},${playerPosition.z}`;
      renderer.domElement.dataset.trackTarget = `${landingPoint.x},${landingPoint.y},${landingPoint.z}`;
      renderer.domElement.dataset.motionLift = motion.lift.toFixed(3);
      renderer.domElement.dataset.motionTravel = motion.travel.toFixed(3);
      renderer.domElement.dataset.motionCompress = motion.compress.toFixed(3);
      renderer.domElement.dataset.motionClip = motion.clip.toFixed(3);
      renderer.domElement.dataset.motionSettle = motion.settle.toFixed(3);
      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(render);
    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose?.();
      });
      workspaceTexture.dispose();
      timelineTexture.dispose();
      visualTexture.dispose();
      clipTexture.dispose();
      renderer.dispose();
      motionTimeline.cancel();
      guideOverlay.remove();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="hero-product-stage three-scene" ref={containerRef} aria-label="三维演示：图片复制层沿引导线进入轨道，原画面随后落入剪映播放器" />;
}
