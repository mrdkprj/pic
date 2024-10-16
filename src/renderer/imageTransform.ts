export class ImageTransform {
    private container: HTMLElement;
    private img: HTMLImageElement;
    private dragState = {
        isDragging: false,
        isImageMoved: false,
    };
    private mousePosition = { x: 0, y: 0 };
    private imagePosition = { x: 0, y: 0 };
    private imagePadding = { x: 0, y: 0 };
    private currentTransform = { x: 0, y: 0, orgX: 0, orgY: 1 };
    private defaultScale = 1;
    private imageFile: Pic.ImageFile;
    private containerRect: Pic.ImageRectangle;
    private imageRect: Pic.ImageRectangle;
    private scale = 1;
    private previousScale = 0;
    private scaleForActualSize = 1;
    private shrinkable = false;

    private eventHandlers = {
        onTransformChange: (): void => undefined,
        onDragstart: (): void => undefined,
        onDragend: (): void => undefined,
    };

    init(container: HTMLElement, img: HTMLImageElement) {
        this.container = container;
        this.img = img;
    }

    setImage(imageFile: Pic.ImageFile) {
        this.imageFile = imageFile;
        this.resetImage();
        this.scaleForActualSize = Math.max(this.imageFile.detail.width / this.imageRect.width, this.imageFile.detail.height / this.imageRect.height);
    }

    getImageRatio() {
        return Math.max((this.imageRect.width * this.scale) / this.imageFile.detail.width, (this.imageRect.height * this.scale) / this.imageFile.detail.height);
    }

    showActualSize() {
        if (this.scaleForActualSize == this.defaultScale) return;

        if (this.scaleForActualSize == this.scale) return;

        this.scale = this.scaleForActualSize;
        this.zoom(this.imageRect.width / 2, this.imageRect.height / 2);
    }

    isImageMoved() {
        return this.dragState.isImageMoved;
    }

    getScale() {
        return this.scale;
    }

    isResized() {
        return this.scale != this.defaultScale;
    }

    resetScale() {
        this.previousScale = this.scale;
        this.scale = this.defaultScale;
    }

    enableShrink(enable: boolean) {
        this.shrinkable = enable;

        if (!this.shrinkable && this.scale < this.defaultScale) {
            this.resetImage();
        }
    }

    isShrinkable() {
        return this.shrinkable;
    }

    on(eventName: Pic.ImageTransformEvent, handler: () => void) {
        switch (eventName) {
            case "transformchange":
                this.eventHandlers.onTransformChange = handler;
                break;
            case "dragstart":
                this.eventHandlers.onDragstart = handler;
                break;
            case "dragend":
                this.eventHandlers.onDragend = handler;
                break;
        }
    }

    onWindowResize = () => {
        if (this.imageFile) {
            this.resetImage();
        }
    };

    onMousedown = (e: MouseEvent) => {
        if (!this.imageFile) return;

        this.dragState.isImageMoved = false;
        this.dragState.isDragging = true;

        if (this.scale != this.defaultScale) {
            this.eventHandlers.onDragstart();
        }

        this.resetMousePosition(e);
    };

    onMousemove = (e: MouseEvent) => {
        if (!this.imageFile) return;

        if (this.dragState.isDragging && e.buttons == 1) {
            this.dragState.isImageMoved = true;
            e.preventDefault();
            this.moveImage(e);
        }
    };

    onMouseup = (_e: MouseEvent) => {
        if (!this.imageFile) return;

        this.eventHandlers.onDragend();
        this.dragState.isDragging = false;
        this.dragState.isImageMoved = false;
    };

    onWheel = (e: WheelEvent) => {
        if (!this.img.src) {
            return;
        }

        e.preventDefault();

        this.previousScale = this.scale;
        this.scale += e.deltaY * -0.002;

        if (e.deltaY < 0) {
            this.scale = Math.max(0.125, this.scale);
        } else {
            this.scale = this.shrinkable ? Math.max(0.125, this.scale) : Math.max(Math.max(0.125, this.scale), this.defaultScale);
        }

        this.zoom(e.pageX, e.pageY);
    };

    private zoom(x: number, y: number) {
        if (this.scale == this.previousScale) {
            return;
        }

        this.calculateBound();

        this.calculateTransform(x, y);

        this.adjustTransform();

        this.changeTransform();
    }

    private calculateTransform(x: number, y: number) {
        const rect = this.img.getBoundingClientRect();

        const mouseX = x - rect.left;
        const mouseY = y - rect.top;

        const prevOrigX = this.currentTransform.orgX * this.previousScale;
        const prevOrigY = this.currentTransform.orgY * this.previousScale;

        let translateX = this.currentTransform.x;
        let translateY = this.currentTransform.y;

        let newOrigX = mouseX / this.previousScale;
        let newOrigY = mouseY / this.previousScale;

        if (Math.abs(mouseX - prevOrigX) > 1 || Math.abs(mouseY - prevOrigY) > 1) {
            translateX = translateX + (mouseX - prevOrigX) * (1 - 1 / this.previousScale);
            translateY = translateY + (mouseY - prevOrigY) * (1 - 1 / this.previousScale);
        } else if (this.previousScale != 1 || (mouseX != prevOrigX && mouseY != prevOrigY)) {
            newOrigX = prevOrigX / this.previousScale;
            newOrigY = prevOrigY / this.previousScale;
        }

        if (this.imageRect.top == 0) {
            translateY = 0;
            newOrigY = this.imageRect.height / 2;
        }

        if (this.imageRect.left == 0) {
            translateX = 0;
            newOrigX = this.imageRect.width / 2;
        }

        this.currentTransform.x = translateX;
        this.currentTransform.y = translateY;
        this.currentTransform.orgX = newOrigX;
        this.currentTransform.orgY = newOrigY;

        this.imagePosition.y = this.imagePadding.y + (newOrigY - newOrigY * this.scale) + translateY;
        this.imagePosition.x = this.imagePadding.x + (newOrigX - newOrigX * this.scale) + translateX;
    }

    private adjustTransform() {
        let adjustY;
        let adjustX;

        if (this.imageRect.top == 0) {
            adjustY = 0;
        } else if (this.imagePosition.y > 0) {
            adjustY = -this.imagePosition.y;
        } else if (this.imagePosition.y < this.imageRect.top * -1) {
            adjustY = Math.abs(this.imagePosition.y) - this.imageRect.top;
        }

        if (adjustY) {
            this.currentTransform.y += adjustY;
            this.imagePosition.y += adjustY;
        }

        if (this.imageRect.left == 0) {
            adjustX = 0;
        } else if (this.imagePosition.x > 0) {
            adjustX = -this.imagePosition.x;
        } else if (this.imagePosition.x < this.imageRect.left * -1) {
            adjustX = Math.abs(this.imagePosition.x) - this.imageRect.left;
        }

        if (adjustX) {
            this.currentTransform.x += adjustX;
            this.imagePosition.x += adjustX;
        }
    }

    private calculateBound() {
        const newHeight = Math.floor(this.imageRect.height * this.scale);
        const newWidth = Math.floor(this.imageRect.width * this.scale);

        this.imageRect.top = Math.max(Math.floor((newHeight - this.containerRect.height) / 1), 0);
        this.imageRect.left = Math.max(Math.floor((newWidth - this.containerRect.width) / 1), 0);
    }

    private moveImage(e: MouseEvent) {
        const mouseMoveX = e.x - this.mousePosition.x;
        this.mousePosition.x = e.x;

        const mouseMoveY = e.y - this.mousePosition.y;
        this.mousePosition.y = e.y;

        if (this.canMoveVertical(mouseMoveY)) {
            this.imagePosition.y += mouseMoveY;
            this.currentTransform.y += mouseMoveY;
        }

        if (this.canMoveHorizontal(mouseMoveX)) {
            this.imagePosition.x += mouseMoveX;
            this.currentTransform.x += mouseMoveX;
        }

        this.changeTransform();
    }

    private canMoveVertical(mouseMoveY: number) {
        if (this.imageRect.top === 0) return false;

        if (mouseMoveY < 0) {
            return this.imagePosition.y + mouseMoveY >= -this.imageRect.top;
        }

        if (mouseMoveY > 0) {
            return this.imagePosition.y + mouseMoveY <= 0;
        }

        return false;
    }

    private canMoveHorizontal(mouseMoveX: number) {
        if (this.imageRect.left == 0) return false;

        if (mouseMoveX < 0) {
            return this.imagePosition.x + mouseMoveX >= -this.imageRect.left;
        }

        if (mouseMoveX > 0) {
            return this.imagePosition.x + mouseMoveX <= 0;
        }

        return false;
    }

    private changeTransform() {
        this.img.style.transformOrigin = `${this.currentTransform.orgX}px ${this.currentTransform.orgY}px`;
        this.img.style.transform = `matrix(${this.scale},0,0,${this.scale}, ${this.currentTransform.x},${this.currentTransform.y})`;

        this.eventHandlers.onTransformChange();
    }

    private clearTransform() {
        this.img.style.transformOrigin = "";
        this.img.style.transform = "";
    }

    private resetMousePosition(e: MouseEvent) {
        this.mousePosition.x = e.x;
        this.mousePosition.y = e.y;
    }

    private resetPosition() {
        this.imagePosition.y = 0;
        this.imagePosition.x = 0;
        this.currentTransform.x = 0;
        this.currentTransform.y = 0;
        this.currentTransform.orgX = 0;
        this.currentTransform.orgY = 1;
    }

    private resetImage() {
        this.resetScale();

        this.clearTransform();

        this.containerRect = this.toImageRectangle(this.container.getBoundingClientRect());

        this.resetPosition();

        this.imageRect = this.toImageRectangle(this.img.getBoundingClientRect());

        this.imagePadding.x = (this.containerRect.width - this.imageRect.width) / 2;
        this.imagePadding.y = (this.containerRect.height - this.imageRect.height) / 2;

        this.currentTransform.orgX = this.imageRect.width / 2;
        this.currentTransform.orgY = this.imageRect.height / 2;

        this.calculateBound();

        this.changeTransform();

        this.scaleForActualSize = Math.max(this.imageFile.detail.width / this.imageRect.width, this.imageFile.detail.height / this.imageRect.height);
    }

    private toImageRectangle(rect: DOMRect): Pic.ImageRectangle {
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
        };
    }
}
