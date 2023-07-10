const MIN_SCALE = 1;
const MousePosition = {x:0, y:0};
const ImagePosition = {x:0, y:0};
const ImagePadding = {x:0, y:0};
const Current= {x:0, y:0, orgX:0, orgY:0}
const State = {
    isMaximized:false,
    isDragging: false,
    isImageMoved: false,
    editMode: "Resize" as Pic.EditMode,
    isClipping:false,
    isShrinkable:false,
}
const clipState = {
    startX:0,
    startY:0,
}
const undoStack:Pic.ImageFile[] = []
const redoStack:Pic.ImageFile[] = []

const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    img:null as HTMLImageElement,
    imageArea:null as HTMLElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    titleBar:null as HTMLElement,
    scaleText:null as HTMLElement,
    clipArea:null as HTMLElement,
    canvas:null as HTMLElement,
}

let currentImageFile:Pic.ImageFile;
let containerRect :Rect;
let imgBoundRect :Rect;
let scale = 1;
let scaleDirection;
let previousScale = 1;

window.onload = function(){

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn")
    Dom.viewport = document.getElementById("viewport");
    Dom.titleBar = document.getElementById("titleBar")
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.scaleText = document.getElementById("scaleText")
    Dom.clipArea = document.getElementById("clipArea")
    Dom.canvas = document.getElementById("clipCanvas")

    Dom.img.addEventListener("mousedown", e => onImageMousedown(e))
    Dom.img.addEventListener("load", onImageLoaded)

    Dom.imageArea.addEventListener("wheel", e => {
        onZoom(e);
    })
}

window.addEventListener("Resize", () => {
    if(Dom.img.src){
        onResize();
    }
})

document.addEventListener("keydown", (e) => {

    if(e.key == "Escape"){
        close();
    }

    if(e.key == "F5"){
        window.api.send("restart")
    }

    if(e.ctrlKey && e.key == "r"){
        e.preventDefault();
    }

    if(e.ctrlKey && e.key == "z"){
        undo();
    }

    if(e.ctrlKey && e.key == "y"){
        redo();
    }

})

document.addEventListener("click", (e) =>{

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id == "minimize"){
        minimize();
    }

    if(e.target.id == "maximize"){
        toggleMaximize();
    }

    if(e.target.id == "close"){
        close();
    }

    if(e.target.id == "clip"){
        changeEditMode("Clip");
    }

    if(e.target.id == "resize"){
        resizeImage();
    }

    if(e.target.id == "shrink"){
        changeResizeMode(!State.isShrinkable);
    }

    if(e.target.id == "undo"){
        undo()
    }

    if(e.target.id == "redo"){
        redo();
    }

    if(e.target.id == "cancel"){
        cancel();
    }

    if(e.target.id == "apply"){
        applyEdit();
    }

    if(e.target.id == "saveCopy"){
        saveImage(true);
    }

    if(e.target.id == "save"){
        saveImage(false);
    }

})

document.addEventListener("mousedown", e => onmousedown(e))
document.addEventListener("mousemove", e => onMousemove(e))

document.addEventListener("mouseup", e => onMouseup(e))

const onImageMousedown = (e:MouseEvent) => {

    if(State.editMode == "Clip") return;

    State.isImageMoved = false;
    State.isDragging = true;

    if(scale != MIN_SCALE){
        Dom.viewport.classList.add("dragging");
    }

    resetMousePosition(e);
}

const onmousedown  = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!e.target.classList.contains("clickable")) return;

    if(State.editMode == "Clip"){
        prepareClip();
        Dom.clipArea.style.transform = ""
        Dom.clipArea.style.width = "0px"
        Dom.clipArea.style.height = "0px"
        clipState.startX = e.clientX
        clipState.startY = e.clientY
        Dom.clipArea.style.top = clipState.startY + "px"
        Dom.clipArea.style.left = clipState.startX + "px"
        State.isClipping = true;
        Dom.canvas.style.display = "block"
    }
}

const onMousemove = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.button != 0) return;

    if(State.isClipping){
        const moveX = e.clientX - clipState.startX;
        const moveY = e.clientY - clipState.startY
        const scaleX = moveX >= 0 ? 1 : -1
        const scaleY = moveY >=0 ? 1 : -1

        Dom.clipArea.style.transform = `scale(${scaleX}, ${scaleY})`
        Dom.clipArea.style.width = Math.abs(moveX) + "px"
        Dom.clipArea.style.height = Math.abs(moveY) + "px"
    }

    if(State.isDragging){
        State.isImageMoved = true;
        e.preventDefault();
        moveImage(e);
    }
}

const onMouseup = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(State.isClipping){
        State.isClipping = false;
        applyEdit();
        return;
    }

    Dom.viewport.classList.remove("dragging")
    State.isImageMoved = false;
    State.isDragging = false;
}

const changeEditMode = (mode:Pic.EditMode) => {

    if(State.editMode == mode){
        State.editMode = "Resize"
    }else{
        State.editMode = mode
    }

    afterToggleMode();
}

const afterToggleMode = () => {

    celarClip();
    Dom.titleBar.classList.remove("clipping")

    if(State.editMode == "Clip"){
        Dom.titleBar.classList.add("clipping")
    }

}

const changeResizeMode = (shrinkable:boolean) => {

    State.isShrinkable = shrinkable;
    if(State.isShrinkable){
        Dom.titleBar.classList.add("shrink")
    }else{
        Dom.titleBar.classList.remove("shrink")
    }
}

const prepareClip = () => {
    const padding = 15;
    const titlebarHeight = 30 + padding;
    const rect = Dom.img.getBoundingClientRect();
    Dom.canvas.style.width = rect.width + "px"
    Dom.canvas.style.height = rect.height + "px"
    Dom.canvas.style.top = (rect.top - titlebarHeight) + "px"
    Dom.canvas.style.left = (rect.left - padding) + "px"
}

const celarClip = () => {
    Dom.canvas.style.display = "none"
}

const resizeImage = () => {
    changeEditMode("Resize")
    applyEdit();
}

const changeEditButtonState = () =>{
    Dom.titleBar.classList.remove("can-undo");
    Dom.titleBar.classList.remove("can-redo");

    if(undoStack.length){
        Dom.titleBar.classList.add("can-undo");
    }

    if(redoStack.length){
        Dom.titleBar.classList.add("can-redo");
    }

}

const undo = () => {
    if(undoStack.length){
        const stack = undoStack.pop()
        redoStack.push(currentImageFile);
        loadImage(stack);
    }
    changeEditButtonState();
}

const redo = () => {
    if(redoStack.length){
        const stack = redoStack.pop()
        undoStack.push(currentImageFile);
        loadImage(stack);
    }
    changeEditButtonState();
}

const cancel = () => {
    if(undoStack.length){
        const firstStac = undoStack[0];
        loadImage(firstStac)
    }

    undoStack.length = 0;
    redoStack.length = 0;

    changeEditButtonState();
}

const ORIENTATIONS = [1,6,3,8];
const OrientationName = {
    "None":1,
    "Clock90deg":6,
    "Clock180deg":3,
    "Clock270deg":8
}

const getActualRect = (rect:Pic.ImageRectangle) => {

    const x = 0;
    if(x > 0) return rect;
    console.log(rect)
    const orientation = ORIENTATIONS[ORIENTATIONS.indexOf(currentImageFile.detail.orientation)];

    const rotated = orientation % 2 == 0;

    const width = rotated ? rect.height : rect.width
    const height = rotated ? rect.width : rect.height

    let top = rect.top;
    let left = rect.left;

    if(orientation === OrientationName.Clock90deg){
        //top = rect.right
        //left = rect.top
        // right = rect.bottom
        // bottom = rect.left
    }

    if(orientation == OrientationName.Clock180deg){

        top = rect.bottom + rect.height
        left = rect.left + rect.right;
    }

    if(orientation == OrientationName.Clock270deg){
        top = rect.left
        left = rect.bottom
        // right = rect.top
        // bottom = rect.right
    }


    console.log(orientation)

    /*
    {
    "width": 298,
    "height": 149,
    "top": 414,
    "right": 998,
    "bottom": 563,
    "left": 700
}
    */
   /*
   corret
   {
    "top": 627,
    "left": 499,
    "width": 142,
    "height": 436
}
   */

    return {
        top,
        left,
        // right,
        // bottom,
        width,
        height,
    }
}

const toRect = (rect:DOMRect) => {

    function radians(deg:number) {
        return deg * (Math.PI / 180);
    }

    console.log(currentImageFile.detail.orientation)
    const orientation = ORIENTATIONS[ORIENTATIONS.indexOf(currentImageFile.detail.orientation)];

    const Xos = -rect.width / 2;
    const Yos = rect.height / 2
    const rotatedX = Math.ceil(rect.x + Xos * Math.cos(radians(90)) - Yos * Math.sin(radians(90)))
    const rotatedY = Math.ceil(rect.y + Xos * Math.sin(radians(90)) + Yos * Math.cos(radians(90)))

        return {
          x: rotatedX,
          y: rotatedY
        };


}

const getClipInfo = () => {

    const clip = Dom.clipArea.getBoundingClientRect()
console.log(toRect(clip))
    if(clip.width < 5 || clip.height < 5) return null;

    const imageRect = Dom.img.getBoundingClientRect()
console.log(clip)
console.log(imageRect)
    if(clip.left > imageRect.right || clip.right < imageRect.left) return null

    if(clip.top > imageRect.bottom || clip.bottom < imageRect.top) return null

    const rate = Math.max(imageRect.width / currentImageFile.detail.width, imageRect.height / currentImageFile.detail.height);

    const clipLeft = Math.floor((clip.left - imageRect.left) / rate);
    const clipRight = Math.floor((imageRect.right - clip.right) / rate);
    const clipTop = Math.floor((clip.top - imageRect.top) / rate);
    const clipBottom = Math.floor((imageRect.bottom - clip.bottom) / rate);

    const clipWidth = Math.floor(clip.width / rate);
    const clipHeight = Math.floor(clip.height / rate);

    const left = clipLeft < 0 ? 0 : clipLeft;
    const top = clipTop < 0 ? 0 : clipTop;

    let width = clipLeft < 0 ? Math.floor(clipWidth + clipLeft) : clipWidth
    width = clipRight < 0 ? Math.floor(width + clipRight) : width

    let height = clipTop < 0 ? Math.floor(clipHeight + clipTop) : clipHeight
    height = clipBottom < 0 ? Math.floor(height + clipBottom) : height

    const rect = getActualRect({
        top,
        left,
        right:clipRight,
        bottom:clipBottom,
        width,
        height
    })
   /*
   const rect = getActualRect({
    "left": 725,
    "top": Math.floor((imageRect.bottom - clip.bottom) / rate),//404,
    "width": 346,
    "height": 174
})
*/
clip.x = clipLeft;
clip.y = clipTop;
    rect.left = toRect(clip).x
    rect.top = toRect(clip).y
console.log(rect)
    return {
        image:currentImageFile,
        rect
    }
}

const applyEdit = () => {

    if(State.editMode === "Clip"){

        const clipInfo = getClipInfo();

        if(!clipInfo) return celarClip();

        request<Pic.ClipRequest>("clip",  clipInfo)
    }

    if(State.editMode === "Resize" && scale != MIN_SCALE){
        request<Pic.ResizeRequest>("resize", {image:currentImageFile, scale} )
    }

}

const showEditResult = (data:Pic.EditResult) => {

    if(redoStack.length){
        redoStack.length = 0;
    }

    undoStack.push(currentImageFile);

    changeEditButtonState();

    if(State.editMode == "Clip"){
        celarClip();
    }

    changeResizeMode(false)

    loadImage(data.image)

}

function onResize(){
    setScale(MIN_SCALE);
    previousScale = scale;
    celarClip();
    resetImage();
}

function minimize(){
    window.api.send("minimize")
}

function toggleMaximize(){
    window.api.send("toggle-maximize")
}

function loadImage(data:Pic.ImageFile){

    currentImageFile = data;

    const src = currentImageFile.exists ? `app://${data.fullPath}?${new Date().getTime()}` : `data:image/jpeg;base64,${data.fullPath}`;
    Dom.img.src = src

}

function onImageLoaded(){

    setScale(MIN_SCALE);
    previousScale = scale;

    changeTitle();

    resetImage();

    unlock();

}

const changeTitle = () => {

    const size = {
        width: Math.floor(currentImageFile.detail.width * scale),
        height: Math.floor(currentImageFile.detail.height * scale),
    }
    Dom.title.textContent = `${currentImageFile.fileName} (${size.width} x ${size.height})`;

    const imageRect = Dom.img.getBoundingClientRect();
    const ratio = Math.max(imageRect.width / currentImageFile.detail.width, imageRect.height / currentImageFile.detail.height);
    Dom.scaleText.textContent = `${Math.ceil(ratio * 100)}%`

}

function resetPosition(){
    ImagePosition.y = 0;
    ImagePosition.x = 0;
    Current.x = 0;
    Current.y = 0;
    Current.orgX = 0;
    Current.orgY = 1;
}

function resetImage(){

    containerRect = createRect(Dom.imageArea.getBoundingClientRect());

    resetPosition();

    imgBoundRect = createRect(Dom.img.getBoundingClientRect());

    ImagePadding.x = (containerRect.width - imgBoundRect.width) / 2;
    ImagePadding.y = (containerRect.height - imgBoundRect.height) / 2;

    Current.orgX = imgBoundRect.width / 2;
    Current.orgY = imgBoundRect.height / 2;

    calculateBound();

    changeTransform();
}

function onZoom(e:WheelEvent) {

    if(State.editMode == "Clip"){
        changeEditMode("Resize")
    }

    e.preventDefault();

    previousScale = scale;
    scale += e.deltaY * -0.002;

    if(e.deltaY < 0){
        scale = Math.max(.125, scale);
        scaleDirection = 1;
    }else{
        scale = State.isShrinkable ? Math.max(.125, scale) : Math.max(Math.max(.125, scale), MIN_SCALE) ;
        scaleDirection = -1;
    }

    zoom(e, scaleDirection);

}

function zoom(e:WheelEvent, _scaleDirection:number){

    calculateBound(scale);

    calc(e);

    adjustCalc();

    changeTransform();
}

function calc(e:WheelEvent){

    const rect = Dom.img.getBoundingClientRect();

    const left = rect.left
    const top = rect.top
    const mouseX = e.pageX - left;
    const mouseY = e.pageY - top;

    const prevOrigX = Current.orgX*previousScale
    const prevOrigY = Current.orgY*previousScale

    let translateX = Current.x;
    let translateY = Current.y;

    let newOrigX = mouseX/previousScale
    let newOrigY = mouseY/previousScale

    if ((Math.abs(mouseX-prevOrigX)>1 || Math.abs(mouseY-prevOrigY)>1)) {
        translateX = translateX + (mouseX-prevOrigX)*(1-1/previousScale);
        translateY = translateY + (mouseY-prevOrigY)*(1-1/previousScale);
    }else if(previousScale != 1 || (mouseX != prevOrigX && mouseY != prevOrigY)) {
        newOrigX = prevOrigX/previousScale;
        newOrigY = prevOrigY/previousScale;
    }

    if(imgBoundRect.top == 0){
        translateY = 0;
        newOrigY =  (imgBoundRect.height / 2);
    }

    if(imgBoundRect.left == 0){
        translateX = 0;
        newOrigX = (imgBoundRect.width / 2);
    }

    Current.x = translateX;
    Current.y = translateY;
    Current.orgX = newOrigX;
    Current.orgY = newOrigY;

    ImagePosition.y = ImagePadding.y + (newOrigY - newOrigY*scale)+translateY ;
    ImagePosition.x = ImagePadding.x + (newOrigX - newOrigX*scale)+translateX;

}

function adjustCalc(){

    if(imgBoundRect.top == 0){
        Current.y = 0;
    } else if(ImagePosition.y > 0){
        Current.y -= ImagePosition.y;
    } else if(ImagePosition.y < imgBoundRect.top * -1){
        Current.y += Math.abs(ImagePosition.y) - imgBoundRect.top;
    }

    if(imgBoundRect.left == 0 ){
        Current.x = 0;
    }else if(ImagePosition.x > 0){
        Current.x -= ImagePosition.x;
    } else if(ImagePosition.x < imgBoundRect.left * -1){
        Current.x += Math.abs(ImagePosition.x) - imgBoundRect.left;
    }

}

function calculateBound(applicableScale?:number){
    const newScale = applicableScale ? applicableScale : 1;
    const newHeight = Math.floor(imgBoundRect.height * newScale)
    const newWidth = Math.floor(imgBoundRect.width * newScale)

    imgBoundRect.top = Math.max(Math.floor((newHeight - containerRect.height) / 1),0);
    imgBoundRect.left = Math.max(Math.floor((newWidth - containerRect.width) / 1),0);
}

function resetMousePosition(e:MouseEvent){
    MousePosition.x = e.x;
    MousePosition.y = e.y;
}

function moveImage(e:MouseEvent){

    const mouseMoveX = e.x - MousePosition.x;
    MousePosition.x = e.x;

    const mouseMoveY = e.y - MousePosition.y;
    MousePosition.y = e.y;

    if(ImagePosition.y + mouseMoveY > 0 || ImagePosition.y + mouseMoveY < imgBoundRect.top * -1){
        //
    }else{
        ImagePosition.y += mouseMoveY;
        Current.y += mouseMoveY
    }

    if(ImagePosition.x + mouseMoveX > 0 || ImagePosition.x + mouseMoveX < imgBoundRect.left * -1){
        //
    }else{
        ImagePosition.x += mouseMoveX;
        Current.x += mouseMoveX
    }

    changeTransform();

}

function setScale(newScale:number){
    previousScale = scale;
    scale = newScale;
    changeTransform();
}

function changeTransform(){

    Dom.img.style.transformOrigin = `${Current.orgX}px ${Current.orgY}px`;
    Dom.img.style.transform = `matrix(${scale},0,0,${scale}, ${Current.x},${Current.y})`;

    changeTitle();
}

function createRect(base:DOMRect){

    return {
        top: base.top,
        left: base.left,
        width: base.width,
        height: base.height,
    }
}

function prepare(){

    if(Dom.loader.style.display == "block"){
        return false;
    }
    lock();
    return true;
}

function saveImage(saveCopy:boolean){

    if(!undoStack.length) return;

    const executeSave = saveCopy ? true : window.confirm("Overwrite image?")
    if(executeSave){
        request<Pic.SaveImageRequest>("save-image", {image:currentImageFile, saveCopy})
    }

}

const afterSaveImage = (data:Pic.SaveImageResult) => {
    if(data.message){
        alert(data.message)
    }else{
        close();
    }

}
function applyConfig(data:Pic.Config){

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    applyTheme(data.preference.theme);

}

function applyTheme(theme:Pic.Theme){
    if(theme === "Light"){
        Dom.viewport.classList.remove("dark");
    }else{
        Dom.viewport.classList.add("dark");
    }
}

function changeMaximizeIcon(){
    if(State.isMaximized){
        Dom.resizeBtn.classList.remove("minbtn");
        Dom.resizeBtn.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.classList.remove("maxbtn");
        Dom.resizeBtn.classList.add("minbtn");
    }
}

function clear(){
    unlock();
    Dom.img.src = "";
    changeEditMode(State.editMode)
}

function close(){
    clear();
    window.api.send("close-edit-dialog");
}

function lock(){
    Dom.loader.style.display = "block";
}

function unlock(){
    Dom.loader.style.display = "none";
}

const request = <T extends Pic.Args>(channel:MainChannel, data:T) => {
    if(prepare()){
        window.api.send(channel, data);
    }
}

window.api.receive<Pic.OpenEditArg>("edit-dialog-opened", data => {
    applyConfig(data.config);
    loadImage(data.file)
})

window.api.receive<Pic.EditResult>("after-edit", data => {
    if(data.message){
        alert(data.message);
    }else{
        showEditResult(data);
    }
    unlock();
})

window.api.receive<Pic.SaveImageResult>("after-save-image", data => afterSaveImage(data))

window.api.receive<Pic.Config>("after-toggle-maximize", data => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
})

export {}