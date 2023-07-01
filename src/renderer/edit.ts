const MIN_SCALE = 1;
const MousePosition = {x:0, y:0};
const ImagePosition = {x:0, y:0};
const ImagePadding = {x:0, y:0};
const Current= {x:0, y:0, orgX:0, orgY:0}
const State = {
    isMaximized:false,
    isDragging: false,
    isImageMoved: false,
    editMode: "none" as Pic.EditMode,
    isClipping:false,
}
const clipState = {
    startX:0,
    startY:0,
}

const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    img:null as HTMLImageElement,
    imageArea:null as HTMLElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    btnArea:null as HTMLElement,
    clipArea:null as HTMLElement,
    canvas:null as HTMLElement,
}

let currentImageFile:Pic.ImageFile;
let originalImageFile:Pic.ImageFile;
let containerRect :Rect;
let imgBoundRect :Rect;
let scale = 1;
let scaleDirection;
let previousScale = 1;

window.onload = function(){

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn")
    Dom.viewport = document.getElementById("viewport");
    Dom.btnArea = document.getElementById("btnArea")
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.clipArea = document.getElementById("clipArea")
    Dom.canvas = document.getElementById("clipCanvas")

    Dom.img.addEventListener("mousedown", e => onImageMousedown(e))

    Dom.imageArea.addEventListener("wheel", e => {
        zoom(e);
    })
}

window.addEventListener("resize", () => {
    if(Dom.img.src){
        onResize();
    }
})

document.addEventListener("keydown", (e) => {

    if(e.key == "Escape"){
        undo();
    }

    if(e.key == "F5"){
        window.api.send("restart")
    }

    if(e.ctrlKey && e.key == "r"){
        e.preventDefault();
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
        changeEditMode("clip");
    }

    if(e.target.id == "cancel"){
        undo();
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

    if(State.editMode == "clip") return;

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

    if(State.editMode == "clip"){
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

    if(State.isClipping){
        const dx = e.clientX - clipState.startX;
        const dy = e.clientY - clipState.startY
        const hor = dx >= 0 ? 1 : -1
        const ver = dy >=0 ? 1 : -1

        Dom.clipArea.style.transform = `scale(${hor}, ${ver})`
        Dom.clipArea.style.width = Math.abs(dx) + "px"
        Dom.clipArea.style.height = Math.abs(dy) + "px"
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
        return;
    }

    Dom.viewport.classList.remove("dragging")
    State.isImageMoved = false;
    State.isDragging = false;
}

const changeEditMode = (mode:Pic.EditMode) => {

    if(State.editMode == mode){
        State.editMode = "none"
    }else{
        State.editMode = mode
    }

    afterToggleMode();
}

const afterToggleMode = () => {

    celarClip();
    Dom.btnArea.classList.remove("clipping")
    Dom.btnArea.classList.remove("resizing")

    if(State.editMode == "clip"){
        Dom.btnArea.classList.add("clipping")
    }

    if(State.editMode == "resize"){
        Dom.btnArea.classList.add("resizing")
    }
}

const prepareClip = () => {
    const rect = Dom.img.getBoundingClientRect();
    Dom.canvas.style.width = rect.width + "px"
    Dom.canvas.style.height = rect.height + "px"
    Dom.canvas.style.top = (rect.top - 30) + "px"
    Dom.canvas.style.left = rect.left + "px"
}

const celarClip = () => {
    Dom.canvas.style.display = "none"
}

const undo = () => {
    loadImage(originalImageFile)
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

    imgBoundRect = createRect(Dom.img.getBoundingClientRect())

    setScale(MIN_SCALE);
    previousScale = scale;

    changeTitle();

    resetImage();

    unlock();

}

const changeTitle = () => {
    const size = {
        width: scale > MIN_SCALE ? Math.floor(currentImageFile.detail.width * scale) : currentImageFile.detail.width,
        height: scale > MIN_SCALE ? Math.floor(currentImageFile.detail.height * scale) : currentImageFile.detail.height,
    }

    Dom.title.textContent = `${currentImageFile.fileName} (${size.width} x ${size.height})`;

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

function zoom(e:WheelEvent) {

    if(State.editMode == "clip"){
        return;
    }

    e.preventDefault();

    previousScale = scale;
    scale += e.deltaY * -0.002;

    if(e.deltaY < 0){
        scale = Math.max(.125, scale);
        scaleDirection = 1;
    }else{
        scale = Math.max(Math.max(.125, scale), MIN_SCALE);
        scaleDirection = -1;
    }

    afterZooom(e, scaleDirection);

}

function afterZooom(e:WheelEvent, scaleDirection:number){

    if(scale == MIN_SCALE){
        setScale(MIN_SCALE);
        resetImage();
        return;
    }

    calculateBound(scale);

    calc(e);

    if(scaleDirection < 0){
        adjustCalc();
    }

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
    imgBoundRect.top = Math.max((imgBoundRect.height * newScale - containerRect.height),0);
    imgBoundRect.left = Math.max((imgBoundRect.width * newScale - containerRect.width),0);
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

    const executeSave = saveCopy ? true : window.confirm("Overwrite image?")
    if(executeSave){
        window.api.send<Pic.SaveImageRequest>("save-image", {image:currentImageFile, saveCopy})
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

const getClipInfo = () => {
    const imgBoundRect = Dom.img.getBoundingClientRect();
    const wration = imgBoundRect.width / currentImageFile.detail.width;
    const hration = imgBoundRect.height / currentImageFile.detail.height;
    const ration = Math.max(wration, hration);

    const clip = Dom.clipArea.getBoundingClientRect()

    return {
        image:currentImageFile,
        rect:{
            left: Math.floor((clip.left - imgBoundRect.left) / ration),
            top: Math.floor((clip.top - imgBoundRect.top) / ration),
            width: Math.floor(clip.width / ration),
            height: Math.floor(clip.height / ration)
        }
    }
}

const applyEdit = () => {

    if(State.editMode === "clip"){
        request<Pic.ClipRequest>("clip", getClipInfo() )
    }

    if(State.editMode !== "clip" && scale != MIN_SCALE){
        request<Pic.ResizeRequest>("resize", {image:currentImageFile, scale} )
    }

}

const showEditResult = (data:Pic.EditResult) => {

    if(State.editMode === "clip"){
        celarClip();
    }

    loadImage(data.image)
}

function close(){
    changeEditMode(State.editMode)
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
    originalImageFile = data.file;
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

window.api.receive<Pic.Config>("after-toggle-maximize", data => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
})

export {}