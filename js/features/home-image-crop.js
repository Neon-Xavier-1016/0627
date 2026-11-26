(function () {
    'use strict';

    const maximumZoom = 4;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const numberOr = (value, fallback) => Number.isFinite(value) ? value : fallback;

    function normalize(crop) {
        return {
            zoom: clamp(numberOr(crop?.zoom, 1), 1, maximumZoom),
            x: clamp(numberOr(crop?.x, .5), 0, 1),
            y: clamp(numberOr(crop?.y, .5), 0, 1)
        };
    }

    function coveredSize(width, height, ratio, zoom) {
        const imageWidth = Math.max(width, height * ratio) * zoom;
        return { width: imageWidth, height: imageWidth / ratio };
    }

    function anchorAt(crop, frame, point) {
        const size = coveredSize(frame.width, frame.height, crop.ratio, crop.zoom);
        return {
            x: (point.x + (size.width - frame.width) * crop.x) / size.width,
            y: (point.y + (size.height - frame.height) * crop.y) / size.height
        };
    }

    function positionAt(crop, frame, anchor, point, zoom) {
        zoom = clamp(zoom, 1, maximumZoom);
        const size = coveredSize(frame.width, frame.height, crop.ratio, zoom);
        const horizontal = size.width - frame.width;
        const vertical = size.height - frame.height;
        return {
            ratio: crop.ratio, zoom,
            x: horizontal > 0.01 ? clamp((anchor.x * size.width - point.x) / horizontal, 0, 1) : crop.x,
            y: vertical > 0.01 ? clamp((anchor.y * size.height - point.y) / vertical, 0, 1) : crop.y
        };
    }

    function apply(target, savedCrop) {
        const crop = normalize(savedCrop);
        const ratio = savedCrop?.ratio;
        const { clientWidth: width, clientHeight: height } = target;
        const zoom = crop.zoom * 100 + '%';
        const size = width && height && Number.isFinite(ratio) && ratio > 0
            ? (width / height >= ratio ? zoom + ' auto' : 'auto ' + zoom)
            : 'cover';
        target.style.setProperty('--hs-image-size', size);
        target.style.setProperty('--hs-image-position', crop.x * 100 + '% ' + crop.y * 100 + '%');
    }

    async function edit(source, savedCrop, target, title) {
        const image = new Image();
        image.alt = '';
        image.draggable = false;
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('图片无法读取，请重新选择。'));
            image.src = source;
        });

        const ratio = image.naturalWidth / image.naturalHeight;
        let crop = { ...normalize(savedCrop), ratio };
        const dialog = document.createElement('dialog');
        dialog.className = 'hs-image-crop';
        dialog.setAttribute('aria-labelledby', 'hs-image-crop-title');
        dialog.innerHTML = `
            <form method="dialog">
                <h2 id="hs-image-crop-title"></h2>
                <div class="hs-crop-frame" tabindex="0" aria-label="取景预览，可用方向键移动图片"></div>
                <p>拖动调整位置，用双指或滑杆缩放。</p>
                <label class="hs-crop-zoom">缩放 <input type="range" min="100" max="400" step="1"><output></output></label>
                <div class="hs-crop-actions">
                    <button type="button" class="hs-crop-reset">重置</button>
                    <button value="cancel">取消</button>
                    <button value="save" class="hs-crop-save">保存取景</button>
                </div>
            </form>`;
        dialog.querySelector('h2').textContent = title;
        const frame = dialog.querySelector('.hs-crop-frame');
        const slider = dialog.querySelector('input');
        const output = dialog.querySelector('output');
        const fallbackAspect = target.id === 'hs-home' ? window.innerWidth / window.innerHeight : 1.8;
        const aspect = target.clientWidth && target.clientHeight ? target.clientWidth / target.clientHeight : fallbackAspect;
        frame.style.setProperty('--hs-crop-aspect', aspect);
        frame.append(image);

        const frameSize = () => ({ width: frame.clientWidth, height: frame.clientHeight });
        function render() {
            const { width, height } = frameSize();
            const size = coveredSize(width, height, ratio, crop.zoom);
            image.style.width = size.width + 'px';
            image.style.height = size.height + 'px';
            image.style.left = (width - size.width) * crop.x + 'px';
            image.style.top = (height - size.height) * crop.y + 'px';
            slider.value = Math.round(crop.zoom * 100);
            output.value = slider.value + '%';
        }

        const pointers = new Map();
        let gesture;
        function measure() {
            const [first, second] = pointers.values();
            if (!second) return { point: first, distance: 0 };
            return {
                point: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
                distance: Math.hypot(first.x - second.x, first.y - second.y)
            };
        }
        function rebaseGesture() {
            if (!pointers.size) { gesture = null; return; }
            const { point, distance } = measure();
            gesture = { anchor: anchorAt(crop, frameSize(), point), distance, zoom: crop.zoom };
        }
        function pointFrom(event) {
            const bounds = frame.getBoundingClientRect();
            return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        }
        frame.addEventListener('pointerdown', event => {
            if (event.button !== 0 || pointers.size === 2) return;
            pointers.set(event.pointerId, pointFrom(event));
            frame.setPointerCapture(event.pointerId);
            rebaseGesture();
        });
        frame.addEventListener('pointermove', event => {
            if (!pointers.has(event.pointerId)) return;
            pointers.set(event.pointerId, pointFrom(event));
            const { point, distance } = measure();
            const zoom = gesture.distance > 0 ? gesture.zoom * distance / gesture.distance : gesture.zoom;
            crop = positionAt(crop, frameSize(), gesture.anchor, point, zoom);
            render();
        });
        const release = event => {
            if (pointers.delete(event.pointerId)) rebaseGesture();
        };
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) frame.addEventListener(event, release);

        slider.addEventListener('input', () => {
            const size = frameSize();
            const center = { x: size.width / 2, y: size.height / 2 };
            crop = positionAt(crop, size, anchorAt(crop, size, center), center, Number(slider.value) / 100);
            rebaseGesture();
            render();
        });
        frame.addEventListener('keydown', event => {
            const offset = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, -.05], ArrowDown: [0, .05] }[event.key];
            if (!offset) return;
            event.preventDefault();
            crop = { ...normalize({ ...crop, x: crop.x + offset[0], y: crop.y + offset[1] }), ratio };
            render();
        });
        dialog.querySelector('.hs-crop-reset').addEventListener('click', () => {
            crop = { ...normalize(), ratio };
            rebaseGesture();
            render();
        });

        const observer = new ResizeObserver(() => { render(); rebaseGesture(); });
        document.body.append(dialog);
        dialog.showModal();
        observer.observe(frame);
        render();
        return new Promise(resolve => {
            dialog.addEventListener('close', () => {
                observer.disconnect();
                dialog.remove();
                resolve(dialog.returnValue === 'save' ? crop : null);
            }, { once: true });
        });
    }

    window.HomeImageCrop = { edit, apply };
})();
