const ORIENTATIONS = [1,6,3,8];
const BACKWARD = -1;
const FORWARD = 1;
const MIN_SCALE = 1;
const MousePosition = {x:0, y:0};
const ImagePosition = {x:0, y:0};
const ImagePadding = {x:0, y:0};
const Current= {x:0, y:0, orgX:0, orgY:1}
const State = {
    isMaximized:false,
    isPinned: false,
    mouseOnly: false,
    isDragging: false,
    isImageMoved: false,
    contextMenuOpening:false,
}

const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    img:null as HTMLImageElement,
    imageArea:null as HTMLElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    history:null as HTMLElement,
    counter:null as HTMLElement,
    category:null as HTMLElement,
}

let currentImageFile:Pic.ImageFile;
let fileCount = 0;
let containerRect :Rect;
let imgBoundRect :Rect;
let scale = 1;
let scaleDirection;
let previousScale = 1;
let angleIndex = 0;

window.onload = function(){

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn");
    Dom.viewport = document.getElementById("viewport");
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.history = document.getElementById("history")
    Dom.counter = document.getElementById("counter");
    Dom.category = document.getElementById("category");

    Dom.img.addEventListener("mousedown", e => onImageMousedown(e))
    Dom.img.addEventListener("load", onImageLoaded)

    Dom.imageArea.addEventListener("mousedown", () => {
        if(isHistoryOpen()){
            closeHistory();
        }
    })

    Dom.imageArea.addEventListener("wheel", e => {
        onZoom(e);
    })

    document.getElementById("imageContainer").addEventListener("dragover", (e) => {
        e.preventDefault();
    })

    document.getElementById("imageContainer").addEventListener("drop", (e) =>{

        e.preventDefault();

        if(!e.dataTransfer) return;

        if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
            dropFile(e.dataTransfer.items[0].getAsFile());
        }
    });

}

window.addEventListener("resize", () => {
    if(Dom.img && Dom.img.src){
        onResize();
    }
})

document.addEventListener("keydown", (e) => {

    if(e.ctrlKey){

        if(e.key == "ArrowRight"){
            rotateRight();
            return;
        }

        if(e.key == "ArrowLeft"){
            rotateLeft();
            return;
        }

        if(e.key == "ArrowUp"){
            angleIndex = 0;
            rotate();
            return;
        }

        if(e.key == "ArrowDown"){
            angleIndex = 2;
            rotate();
            return;
        }

    }

    if(e.key == "F1" || e.key == "Escape"){
        toggleFullscreen();
    }

    if(e.key == "F5"){
        window.api.send("restart")
    }

    if(e.ctrlKey && e.key == "r"){
        e.preventDefault();
    }

    if(e.ctrlKey && e.key == "h"){
        toggleHistory();
    }

    if(e.ctrlKey && e.key == "s"){
        e.preventDefault();
        pin();
    }

    if(e.key === "Escape"){
        closeHistory();
    }

    if(e.key === "Delete"){
        deleteFile();
    }

    if(e.key === "ArrowRight"){
        startFetch(FORWARD);
    }

    if(e.key === "ArrowLeft"){
        startFetch(BACKWARD);
    }

    if(isFinite(Number(e.key))){
        request<Pic.CategoryArgs>("set-category", {category:Number(e.key)})
        setCategory(Number(e.key));
    }

    if(e.key === "F12"){
        openFileDialog();
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

    if(e.target.id == "edit"){
        request("open-edit-dialog", null)
    }

    if(e.target.id == "deleteBtn"){
        deleteFile();
    }

    if(e.target.id == "rotateLeft"){
        rotateLeft();
    }

    if(e.target.id == "pinBtn"){
        pin();
    }

    if(e.target.id == "rotateRight"){
        rotateRight();
    }

    if(e.target.id == "setting"){
        window.api.send("open-main-context")
    }

    if(e.target.id == "previous"){
        startFetch(BACKWARD);
    }

    if(e.target.id == "next"){
        startFetch(FORWARD);
    }

    if(e.target.id == "closeHistoryBtn"){
        closeHistory();
    }

})

document.addEventListener("mousemove", e => onMousemove(e))

document.addEventListener("mouseup", e => onMouseup(e))

const onImageMousedown = (e:MouseEvent) => {

    State.isImageMoved = false;
    State.isDragging = true;

    if(scale != MIN_SCALE){
        Dom.viewport.classList.add("dragging");
    }

    if(isHistoryOpen()){
        closeHistory();
    }

    resetMousePosition(e);
}

const onMousemove = (e:MouseEvent) => {

    if(State.isDragging){
        State.isImageMoved = true;
        e.preventDefault();
        moveImage(e);
    }
}

const onMouseup = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(State.contextMenuOpening){
        e.preventDefault();
        State.contextMenuOpening = false;
        return;
    }

    if(e.button == 2 && e.buttons == 1){
        e.preventDefault();
        State.contextMenuOpening = true;
        window.api.send("open-main-context")
        return;
    }

    if(!State.isImageMoved && e.target.classList.contains("clickable")){

        if(State.mouseOnly){

            e.preventDefault();
            if(e.button == 0){
                startFetch(-1);
            }

            if(e.button == 2){
                startFetch(1);
            }
        }

    }

    Dom.viewport.classList.remove("dragging")
    State.isImageMoved = false;
    State.isDragging = false;
}

function onResize(){
    setScale(MIN_SCALE);
    previousScale = scale;
    resetImage();
}

function loadImage(data:Pic.FetchResult){
    currentImageFile = data.image;

    const src = currentImageFile.exists ? `app://${data.image.fullPath}?${new Date().getTime()}` : "";
    Dom.img.src = src

    if(currentImageFile.exists){
        Dom.imageArea.classList.remove("no-image")
    }else{
        Dom.imageArea.classList.add("no-image")
    }

    State.isPinned = data.pinned;
    changePinStatus();

    fileCount = data.fileCount;

    Dom.counter.textContent = `${data.currentIndex} / ${fileCount}`;

    setCategory(data.image.detail.category)
}

function onImageLoaded(){

    setScale(MIN_SCALE);
    previousScale = scale;

    const angle = currentImageFile.detail.orientation ?? ORIENTATIONS[0];
    angleIndex = ORIENTATIONS.indexOf(angle);

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

function onZoom(e:WheelEvent) {

    if(!currentImageFile.exists){
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

    zoom(e, scaleDirection);

}

function zoom(e:WheelEvent, _scaleDirection:number){

    if(scale == MIN_SCALE){
        setScale(MIN_SCALE);
        resetImage();
        return;
    }

    calculateBound(scale);

    calc(e);

    //if(scaleDirection < 0){
        adjustCalc();
    //}

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
        newOrigY =  imgBoundRect.height / 2;
    }

    if(imgBoundRect.left == 0){
        translateX = 0;
        newOrigX = imgBoundRect.width / 2;
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

function rotateLeft(){
    angleIndex--;
    if(angleIndex < 0){
        angleIndex = ORIENTATIONS.length - 1;
    }

    rotate();
}

function rotateRight(){
    angleIndex++;
    if(angleIndex > ORIENTATIONS.length - 1){
        angleIndex = 0;
    }

    rotate();
}

function rotate(){
    request("rotate", {orientation:ORIENTATIONS[angleIndex]});
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

    if(isHistoryOpen()){
        closeHistory();
    }

    lock();
    return true;
}

function dropFile(file:File | null){
    if(prepare()){
        window.api.send<Pic.DropRequest>("drop-file", {fullPath:file?.path});
    }
}

function startFetch(index:number){
    if(prepare()){
        request<Pic.FetchRequest>("fetch-image", {index});
    }
}

function deleteFile(){
    if(prepare()){
        request("delete", null);
    }
}

function pin(){
    request("pin", null);
}

function applyConfig(data:Pic.Config){

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    changeMode(data.preference.mode);

    applyTheme(data.preference.theme);

    changeFileList(data.history);
}

function changePinStatus(){
    if(State.isPinned){
        Dom.viewport.classList.add("pinned");
    }else{
        Dom.viewport.classList.remove("pinned");
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

function changeMode(mode:Pic.Mode){

    State.mouseOnly = mode === "Mouse"

    if(State.mouseOnly){
        Dom.viewport.classList.add("mouse");
    }else{
        Dom.viewport.classList.remove("mouse");
    }

}

function applyTheme(theme:Pic.Theme){
    if(theme === "Light"){
        Dom.viewport.classList.remove("dark");
    }else{
        Dom.viewport.classList.add("dark");
    }
}

function changeFileList(history:{[key:string]:string}){

    Dom.history.innerHTML = "";

    const fragment = document.createDocumentFragment();

    Object.keys(history).forEach(key => {
        const item = document.createElement("li");
        const remIcon = document.createElement("div");
        remIcon.innerHTML = "&times;";
        remIcon.classList.add("remove-history-btn");
        remIcon.addEventListener("click", removeHistory);
        const text = document.createElement("div");
        text.classList.add("history-item")
        const fullPath = `${key}\\${history[key]}`;
        text.textContent = fullPath
        text.title = fullPath;
        text.addEventListener("dblclick", onFileListItemClicked);
        item.append(remIcon, text);
        fragment.appendChild(item);
    });

    Dom.history.appendChild(fragment)
}

function onFileListItemClicked(e:MouseEvent){
    window.api.send<Pic.RestoreRequest>("restore", {fullPath: (e.target as HTMLElement).textContent});
}

function removeHistory(e:MouseEvent){
    if(confirm("Remove history?")){
        window.api.send<Pic.RemoveHistoryRequest>("remove-history", {fullPath: (e.target as HTMLElement).nextElementSibling.textContent});
    }
}

function toggleHistory(){
    if(isHistoryOpen()){
        Dom.viewport.classList.remove("history-open");
    }else{
        Dom.viewport.classList.add("history-open");
    }
}

function isHistoryOpen(){
    return Dom.viewport.classList.contains("history-open");
}

function closeHistory(){
    Dom.viewport.classList.remove("history-open");
}

function minimize(){
    window.api.send("minimize")
}

function toggleMaximize(){
    window.api.send("toggle-maximize")
}

function isFullScreen(){
    return Dom.viewport.classList.contains("full")
}

function toggleFullscreen(){
    if(isFullScreen()){
        Dom.viewport.classList.remove("full")
    }else{
        Dom.viewport.classList.add("full")
    }

    window.api.send("toggle-fullscreen")
}

function close(){
    window.api.send("close");
}

function lock(){
    Dom.loader.style.display = "block";
}

function unlock(){
    Dom.loader.style.display = "none";
}

function setCategory(category:number){

    if(category){
        Dom.category.textContent = `- [ @${category} ]`;
    }else{
        Dom.category.textContent = ""
    }
}

function openFileDialog(){
    window.api.send("open-file-dialog")
}

const request = <T extends Pic.Args>(channel:MainChannel, data:T) => {
    if(Dom.img.src){
        window.api.send(channel, data);
    }
}

window.api.receive<Pic.Config>("config-loaded", data => {
    applyConfig(data);
})

window.api.receive<Pic.FetchResult>("after-fetch", data => loadImage(data))

window.api.receive<Pic.PinResult>("after-pin", data => {
    State.isPinned = data.success;
    changePinStatus();
    changeFileList(data.history)
});

window.api.receive<Pic.ChangePreferenceArgs>("toggle-mode", (data) => changeMode(data.preference.mode))
window.api.receive<Pic.ChangePreferenceArgs>("toggle-theme", (data) => applyTheme(data.preference.theme))

window.api.receive("open-history", toggleHistory);
window.api.receive<Pic.RemoveHistoryResult>("after-remove-history", data => {
    changeFileList(data.history);
})

window.api.receive<Pic.Config>("after-toggle-maximize", data => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
})

window.api.receive<Pic.ErrorArgs>("error", data => {
    alert(data.message);
    unlock();
})

export {}