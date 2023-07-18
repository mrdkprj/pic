export class ImageTransform{

    private container:HTMLElement;
    private img:HTMLImageElement;
    private state = {
        isDragging:false,
        isImageMoved:false,
    }
    private mousePosition = {x:0, y:0};
    private imagePosition = {x:0, y:0};
    private imagePadding = {x:0, y:0};
    private currentTransform= {x:0, y:0, orgX:0, orgY:1}
    private defaultScale = 1;
    private imageFile:Pic.ImageFile
    private containerRect :Pic.ImageRectangle;
    private imgBoundRect :Pic.ImageRectangle;
    private scale = 1;
    private previousScale = 0;
    private scaleForActualSize = 1;
    private shrinkable = false;

    private eventHandlers = {
        onTransformChange: ():void => undefined,
        onDragstart: ():void => undefined,
        onDragend: ():void => undefined,

    }

    init(container:HTMLElement, img:HTMLImageElement){
        this.container = container;
        this.img = img;
    }

    setImage(imageFile:Pic.ImageFile){
        this.imageFile = imageFile;
        this.resetImage();
        this.scaleForActualSize = Math.max(this.imageFile.detail.width / this.imgBoundRect.width, this.imageFile.detail.height / this.imgBoundRect.height);
    }

    getImageRatio(){
        return Math.max(this.imgBoundRect.width * this.scale / this.imageFile.detail.width, this.imgBoundRect.height * this.scale / this.imageFile.detail.height);
    }

    showActualSize(){

        if(this.scaleForActualSize == this.defaultScale) return;

        this.scale = this.scaleForActualSize
        this.changeTransform();
    }

    isImageMoved(){
        return this.state.isImageMoved
    }

    getScale(){
        return this.scale;
    }

    isResized(){
        return this.scale != this.defaultScale;
    }

    resetScale(){
        this.previousScale = this.scale;
        this.scale = this.defaultScale;
    }

    enableShrink(enable:boolean){

        this.shrinkable = enable;

        if(!this.shrinkable && this.scale < this.defaultScale){
            this.resetImage();
        }

    }

    isShrinkable(){
        return this.shrinkable
    }

    on(eventName:Pic.ImageTransformEvent, handler: () => void){

        switch(eventName){
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
        if(this.img && this.img.src){
            this.resetImage();
        }
    }

    onMousedown = (e:MouseEvent) => {
        this.state.isImageMoved = false;
        this.state.isDragging = true;

        if(this.scale != this.defaultScale){
            this.eventHandlers.onDragstart()
        }

        this.resetMousePosition(e);
    }

    onMousemove = (e:MouseEvent) => {

        if(e.button != 0) return;

        if(this.state.isDragging){
            this.state.isImageMoved = true;
            e.preventDefault();
            this.moveImage(e);
        }
    }

    onMouseup = (_e:MouseEvent) => {
        this.eventHandlers.onDragend();
        this.state.isDragging = false;
    }

    onWheel = (e:WheelEvent) => {
        if(!this.img.src){
            return;
        }

        e.preventDefault();

        this.previousScale = this.scale;
        this.scale += e.deltaY * -0.002;

        if(e.deltaY < 0){
            this.scale = Math.max(.125, this.scale);
        }else{
            this.scale = this.shrinkable ? Math.max(.125, this.scale) : Math.max(Math.max(.125, this.scale), this.defaultScale)
        }

        this.zoom(e);
    }

    private zoom(e:WheelEvent){

        if(this.scale == this.defaultScale){
            this.resetImage();
            return;
        }

        this.calculateBound();

        this.calculateTransform(e);

        this.adjustTransform();

        this.changeTransform();
    }

    private calculateTransform(e:WheelEvent){

        const rect = this.img.getBoundingClientRect();

        const left = rect.left
        const top = rect.top

        const mouseX = e.pageX - left;
        const mouseY = e.pageY - top;

        const prevOrigX = this.currentTransform.orgX * this.previousScale
        const prevOrigY = this.currentTransform.orgY * this.previousScale

        let translateX = this.currentTransform.x;
        let translateY = this.currentTransform.y;

        let newOrigX = mouseX / this.previousScale
        let newOrigY = mouseY / this.previousScale

        if ((Math.abs(mouseX-prevOrigX) > 1 || Math.abs(mouseY-prevOrigY) > 1)) {
            translateX = translateX + (mouseX-prevOrigX) * (1-1 / this.previousScale);
            translateY = translateY + (mouseY-prevOrigY) * (1-1 / this.previousScale);
        }else if(this.previousScale != 1 || (mouseX != prevOrigX && mouseY != prevOrigY)) {
            newOrigX = prevOrigX / this.previousScale;
            newOrigY = prevOrigY / this.previousScale;
        }

        if(this.imgBoundRect.top == 0){
            translateY = 0;
            newOrigY =  this.imgBoundRect.height / 2;
        }

        if(this.imgBoundRect.left == 0){
            translateX = 0;
            newOrigX = this.imgBoundRect.width / 2;
        }

        this.currentTransform.x = translateX;
        this.currentTransform.y = translateY;
        this.currentTransform.orgX = newOrigX;
        this.currentTransform.orgY = newOrigY;

        this.imagePosition.y = this.imagePadding.y + (newOrigY - newOrigY * this.scale) + translateY
        this.imagePosition.x = this.imagePadding.x + (newOrigX - newOrigX * this.scale) + translateX

    }

    private adjustTransform(){

        if(this.imgBoundRect.top == 0){
            this.currentTransform.y = 0;
        } else if(this.imagePosition.y > 0){
            this.currentTransform.y -= this.imagePosition.y;
        } else if(this.imagePosition.y < this.imgBoundRect.top * -1){
            this.currentTransform.y += Math.abs(this.imagePosition.y) - this.imgBoundRect.top;
        }

        if(this.imgBoundRect.left == 0 ){
            this.currentTransform.x = 0;
        }else if(this.imagePosition.x > 0){
            this.currentTransform.x -= this.imagePosition.x;
        } else if(this.imagePosition.x < this.imgBoundRect.left * -1){
            this.currentTransform.x += Math.abs(this.imagePosition.x) - this.imgBoundRect.left;
        }

    }

    private calculateBound(){

        const newHeight = Math.floor(this.imgBoundRect.height * this.scale)
        const newWidth = Math.floor(this.imgBoundRect.width * this.scale)

        this.imgBoundRect.top = Math.max(Math.floor((newHeight - this.containerRect.height) / 1),0);
        this.imgBoundRect.left = Math.max(Math.floor((newWidth - this.containerRect.width) / 1),0);
    }

    private resetMousePosition(e:MouseEvent){
        this.mousePosition.x = e.x;
        this.mousePosition.y = e.y;
    }

    private moveImage(e:MouseEvent){

        const mouseMoveX = e.x - this.mousePosition.x;
        this.mousePosition.x = e.x;

        const mouseMoveY = e.y - this.mousePosition.y;
        this.mousePosition.y = e.y;

        if(this.imagePosition.y + mouseMoveY > 0 || this.imagePosition.y + mouseMoveY < this.imgBoundRect.top * -1){
            //
        }else{
            this.imagePosition.y += mouseMoveY;
            this.currentTransform.y += mouseMoveY
        }

        if(this.imagePosition.x + mouseMoveX > 0 || this.imagePosition.x + mouseMoveX < this.imgBoundRect.left * -1){
            //
        }else{
            this.imagePosition.x += mouseMoveX;
            this.currentTransform.x += mouseMoveX
        }

        this.changeTransform();

    }

    private changeTransform(){

        this.img.style.transformOrigin = `${this.currentTransform.orgX}px ${this.currentTransform.orgY}px`;
        this.img.style.transform = `matrix(${this.scale},0,0,${this.scale}, ${this.currentTransform.x},${this.currentTransform.y})`;

        this.eventHandlers.onTransformChange();
    }

    private resetPosition(){
        this.imagePosition.y = 0;
        this.imagePosition.x = 0;
        this.currentTransform.x = 0;
        this.currentTransform.y = 0;
        this.currentTransform.orgX = 0;
        this.currentTransform.orgY = 1;
    }

    private resetImage(){

        this.resetScale();

        this.containerRect = this.toImageRectangle(this.container.getBoundingClientRect());

        this.resetPosition();

        this.imgBoundRect = this.toImageRectangle(this.img.getBoundingClientRect());

        this.imagePadding.x = (this.containerRect.width - this.imgBoundRect.width) / 2;
        this.imagePadding.y = (this.containerRect.height - this.imgBoundRect.height) / 2;

        this.currentTransform.orgX = this.imgBoundRect.width / 2;
        this.currentTransform.orgY = this.imgBoundRect.height / 2;

        this.calculateBound();

        this.changeTransform();

        this.scaleForActualSize = Math.max(this.imageFile.detail.width / this.imgBoundRect.width, this.imageFile.detail.height / this.imgBoundRect.height);
    }

    private toImageRectangle(rect:DOMRect):Pic.ImageRectangle{

        return {
            width:rect.width,
            height:rect.height,
            top:rect.top,
            left:rect.left,
            right:rect.right,
            bottom:rect.bottom
        }
    }
}