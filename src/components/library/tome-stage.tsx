import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  cover: string;
  leather: string;
  title: string;
  pages: number;
  rot: { current: { x: number; y: number } };
};

function depthFor(pages: number) {
  return Math.min(0.28, Math.max(0.1, 0.08 + pages / 1400));
}

function pageCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4ead2";
  g.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 3) {
    g.fillStyle = y % 6 === 0 ? "#e2d3ae" : "#fbf6e8";
    g.fillRect(0, y, 64, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function spineCanvas(title: string, leather: HTMLImageElement | null) {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 1024;
  const g = c.getContext("2d")!;
  if (leather) {
    g.drawImage(leather, 0, 0, 160, 1024);
    g.fillStyle = "rgba(20,10,6,0.35)";
    g.fillRect(0, 0, 160, 1024);
  } else {
    g.fillStyle = "#3a2218";
    g.fillRect(0, 0, 160, 1024);
  }
  g.fillStyle = "#c4a15a";
  g.fillRect(8, 70, 144, 18);
  g.fillRect(8, 936, 144, 18);
  g.save();
  g.translate(92, 512);
  g.rotate(-Math.PI / 2);
  g.fillStyle = "#f3e6c4";
  g.font = "600 42px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const label = title.length > 28 ? `${title.slice(0, 27)}…` : title;
  g.fillText(label.toUpperCase(), 0, 0);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function TomeStage({ cover, leather, title, pages, rot }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef(rot);
  rotRef.current = rot;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let ro: ResizeObserver | null = null;
    const trash: THREE.Object3D[] = [];
    const mats: THREE.Material[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const texs: THREE.Texture[] = [];

    const boot = () => {
      if (dead) return;
      const w0 = Math.max(2, host.clientWidth);
      const h0 = Math.max(2, host.clientHeight);
      if (w0 < 48 || h0 < 48) {
        frame = requestAnimationFrame(boot);
        return;
      }

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w0, h0, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      host.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w0 / h0, 0.1, 40);
      camera.position.set(0, 0.08, 5.2);
      camera.lookAt(0, 0, 0);

      const key = new THREE.DirectionalLight(0xfff1d6, 2.1);
      key.position.set(2.2, 3.2, 4.2);
      key.castShadow = true;
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xc8b89a, 0.55));
      const rim = new THREE.DirectionalLight(0x9bb6ff, 0.45);
      rim.position.set(-3, 1.4, -2);
      scene.add(rim);

      const book = new THREE.Group();
      scene.add(book);

      const d = depthFor(pages);
      const bw = 1.05;
      const bh = 1.58;
      const board = 0.03;
      const pageW = bw - 0.06;
      const pageH = bh - 0.06;
      const pageD = Math.max(0.06, d - board * 2);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -bh / 2 - 0.02;
      scene.add(floor);
      trash.push(book, floor);

      void (async () => {
        let coverImg: HTMLImageElement | null = null;
        let leatherImg: HTMLImageElement | null = null;
        try {
          coverImg = await loadImage(cover);
        } catch {
          coverImg = null;
        }
        try {
          leatherImg = await loadImage(leather);
        } catch {
          leatherImg = null;
        }
        if (dead) return;

        const coverTex = coverImg ? new THREE.Texture(coverImg) : null;
        if (coverTex) {
          coverTex.needsUpdate = true;
          coverTex.colorSpace = THREE.SRGBColorSpace;
          coverTex.anisotropy = 8;
          texs.push(coverTex);
        }
        const leatherTex = leatherImg ? new THREE.Texture(leatherImg) : null;
        if (leatherTex) {
          leatherTex.needsUpdate = true;
          leatherTex.colorSpace = THREE.SRGBColorSpace;
          leatherTex.wrapS = THREE.RepeatWrapping;
          leatherTex.wrapT = THREE.RepeatWrapping;
          texs.push(leatherTex);
        }
        const pagesTex = pageCanvas();
        texs.push(pagesTex);
        const spineTex = spineCanvas(title, leatherImg);
        texs.push(spineTex);

        const leatherMat = new THREE.MeshStandardMaterial({
          map: leatherTex,
          color: leatherTex ? 0xffffff : 0x4a2c1e,
          roughness: 0.72,
          metalness: 0.04,
        });
        const coverMat = new THREE.MeshStandardMaterial({
          map: coverTex,
          color: coverTex ? 0xffffff : 0x2a1810,
          roughness: 0.48,
          metalness: 0.02,
        });
        const pageMat = new THREE.MeshStandardMaterial({
          map: pagesTex,
          roughness: 0.9,
          metalness: 0,
        });
        const spineMat = new THREE.MeshStandardMaterial({
          map: spineTex,
          roughness: 0.65,
          metalness: 0.06,
        });
        const cream = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.92, metalness: 0 });
        mats.push(leatherMat, coverMat, pageMat, spineMat, cream);

        const frontGeo = new THREE.BoxGeometry(bw, bh, board);
        const backGeo = new THREE.BoxGeometry(bw, bh, board);
        const spineGeo = new THREE.BoxGeometry(d, bh, board * 1.1);
        const blockGeo = new THREE.BoxGeometry(pageW, pageH, pageD);
        geos.push(frontGeo, backGeo, spineGeo, blockGeo);

        const front = new THREE.Mesh(frontGeo, coverMat);
        front.position.set(0.015, 0, pageD / 2 + board / 2);
        front.castShadow = true;
        const back = new THREE.Mesh(backGeo, leatherMat);
        back.position.set(0.015, 0, -(pageD / 2 + board / 2));
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.rotation.y = Math.PI / 2;
        spine.position.set(-bw / 2 + 0.01, 0, 0);
        const block = new THREE.Mesh(blockGeo, [pageMat, cream, cream, cream, cream, cream]);
        block.position.set(0.03, 0, 0);

        book.add(front, back, spine, block);
        book.updateMatrixWorld(true);
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(book).getBoundingSphere(sphere);
        const radius = Math.max(0.95, sphere.radius);
        const fov = (camera.fov * Math.PI) / 180;
        const dist = (radius / Math.sin(fov / 2)) * 1.42;
        camera.position.set(0, 0.06, dist);
        camera.near = dist / 40;
        camera.far = dist * 12;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      })();

      const tick = () => {
        frame = requestAnimationFrame(tick);
        const { x, y } = rotRef.current.current;
        book.rotation.x = THREE.MathUtils.degToRad(x);
        book.rotation.y = THREE.MathUtils.degToRad(y);
        renderer?.render(scene, camera);
      };
      tick();

      const onResize = () => {
        if (!renderer) return;
        const w = Math.max(2, host.clientWidth);
        const h = Math.max(2, host.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      ro = new ResizeObserver(onResize);
      ro.observe(host);
    };

    boot();

    return () => {
      dead = true;
      cancelAnimationFrame(frame);
      ro?.disconnect();
      renderer?.dispose();
      renderer?.domElement.remove();
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
      for (const t of texs) t.dispose();
      for (const o of trash) {
        o.parent?.remove(o);
      }
    };
  }, [cover, leather, title, pages]);

  return <div ref={hostRef} className="tome-stage-webgl" />;
}
