const ORIENTATIONS = [1,6,3,8];
const BACKWARD = -1;
const FORWARD = 1;
const MIN_SCALE = 1;
const MousePosition = {x:0, y:0};
const ImagePosition = {x:0, y:0};
const ImagePadding = {x:0, y:0};
const Current= {x:0, y:0, orgX:0, orgY:0}
const State = {
    isMaximized:false,
    isImageLoaded:false,
    isFileListOpen:false,
    isSaved: false,
    mouseOnly: false,
    doFlip: false,
    isDark:false,
    isDragging: false,
    isImageMoved: false,
    isFullScreen: false,
}

const Dom = {
    title: null as HTMLElement | null,
    resizeBtn:null as HTMLElement | null,
    img:null as HTMLImageElement | null,
    imageArea:null as HTMLElement | null,
    loader:null as HTMLElement | null,
    viewport:null as HTMLElement | null,
    fileList:null as HTMLElement | null,
    themeCheckbox:null as HTMLInputElement | null,
    counter:null as HTMLElement | null,
    category:null as HTMLElement | null,
}

let currentDirectory = "";
let containerRect :Rect;
let imgBoundRect :Rect;
let scale = 1;
let scaleDirection;
let previousScale: number;
let angleIndex = 0;

window.onload = function(){

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn");
    Dom.viewport = document.getElementById("viewport");
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.themeCheckbox = (document.getElementById("theme") as HTMLInputElement);
    Dom.fileList = document.getElementById("fileList")
    Dom.counter = document.getElementById("counter");
    Dom.category = document.getElementById("category");

    Dom.img.addEventListener("mousedown", e => {
        State.isImageMoved = false;
        State.isDragging = true;

        if(scale != MIN_SCALE){
            Dom.viewport.classList.add("dragging");
        }

        if(State.isFileListOpen){
            hideFileList();
        }

        resetMousePosition(e);
    })

    Dom.imageArea.addEventListener("mousedown", () => {
        if(State.isFileListOpen){
            hideFileList();
        }
    })

    Dom.imageArea.addEventListener("wheel", e => {
        zoom(e);
    })

    Dom.themeCheckbox.addEventListener("change", e =>{
        State.isDark = (<HTMLInputElement>e.target).checked;
        applyTheme();
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
    if(State.isImageLoaded){
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
        toggleFullScreen();
    }

    if(e.ctrlKey && e.key == "s"){
        e.preventDefault();
        save();
    }

    if(e.ctrlKey && e.key == "z"){
        e.preventDefault();
        restore();
    }

    if(e.ctrlKey && e.key == "t"){
        e.preventDefault();
        State.isDark = !State.isDark;
        applyTheme();
    }

    if(e.key === "Escape"){
        hideFileList();
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
        window.api.send<Pic.CategoryArgs>("set-category", {category:Number(e.key)})
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

    if(e.target.id == "deleteBtn"){
        deleteFile();
    }

    if(e.target.id == "rotateLeft"){
        rotateLeft();
    }

    if(e.target.id == "rotateRight"){
        rotateRight();
    }

    if(e.target.id == "reveal"){
        reveal();
    }

    if(e.target.id == "fileListBtn"){
        toggleFileList();
    }

    if(e.target.id == "openFile"){
        open();
    }

    if(e.target.id == "saveFile"){
        save();
    }

    if(e.target.id == "restoreFile"){
        restore();
    }

    if(e.target.id == "mode"){
        State.mouseOnly = !State.mouseOnly;
        changeMode();
    }

    if(e.target.id == "orientation"){
        State.doFlip = !State.doFlip;
        changeOrientation();
    }

    if(e.target.id == "previous"){
        startFetch(BACKWARD);
    }

    if(e.target.id == "next"){
        startFetch(FORWARD);
    }

})

document.addEventListener("mousemove", e => {
    if(State.isDragging){
        State.isImageMoved = true;
        e.preventDefault();
        moveImage(e);
    }
})

document.addEventListener("mouseup", e => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

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
})

function onResize(){
    setScale(MIN_SCALE);
    previousScale = scale;
    resetImage();
}

function onImageLoaded(data:Pic.FetchResult, dummy:HTMLImageElement){

    State.isImageLoaded = true;

    setScale(MIN_SCALE);
    previousScale = scale;

    if(data){
        currentDirectory = data.image.directory;
        const angle = data.image.angle ? data.image.angle : ORIENTATIONS[0];
        angleIndex = ORIENTATIONS.indexOf(angle);
        State.isSaved = data.saved;
        changeSaveStatus();
        Dom.title.textContent = `Picture - ${data.image.fileName} (${dummy.width} x ${dummy.height})`;
        Dom.counter.textContent = data.counter;
        Dom.loader.style.display = "none";
        setCategory(data.image.category)
    }

    resetImage();

}

function resetPosition(){
    ImagePosition.y = 0;
    ImagePosition.x = 0;
    Current.x = 0;
    Current.y = 0;
    Current.orgX = 0;
    Current.orgY = 1;
}

type Rect = {
    top: number;
    left: number;
    width: number;
    height: number;
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

    if(!Dom.img) return;

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

    const dx = e.x - MousePosition.x;
    MousePosition.x = e.x;

    const dy = e.y - MousePosition.y;
    MousePosition.y = e.y;

    if(ImagePosition.y + dy > 0 || ImagePosition.y + dy < imgBoundRect.top * -1){
        //
    }else{
        ImagePosition.y += dy;
        Current.y += dy
    }

    if(ImagePosition.x + dx > 0 || ImagePosition.x + dx < imgBoundRect.left * -1){
        //
    }else{
        ImagePosition.x += dx;
        Current.x += dx
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
    window.api.send("rotate", {orientation:ORIENTATIONS[angleIndex]});
}

function setScale(newScale:number){
    previousScale = scale;
    scale = newScale;
    changeTransform();
}

function changeTransform(){
    if(!Dom.img) return;

    Dom.img.style.transformOrigin = `${Current.orgX}px ${Current.orgY}px`;
    Dom.img.style.transform = `matrix(${scale},0,0,${scale}, ${Current.x},${Current.y})`;
}

function createRect(base:DOMRect | undefined){

    if(!base) return new DOMRect();

    return {
            top: base.top,
            left: base.left,
            width: base.width,
            height: base.height,
    }
}

function isPrepared(){

    if(Dom.loader.style.display == "block"){
        return false;
    }

    if(State.isFileListOpen){
        hideFileList();
    }

    lock();
    return true;
}

function dropFile(file:File | null){
    if(isPrepared()){
        window.api.send<Pic.DropRequest>("drop-file", {fullPath:file?.path});
    }
}

function startFetch(index:number){
    if(Dom.img.src){
        if(isPrepared()){
            window.api.send<Pic.FetchRequest>("fetch-image", {index});
        }
    }
}

function deleteFile(){
    if(isPrepared()){
        window.api.send("delete");
    }
}

function save(){
    const config = {isDark:State.isDark, mouseOnly:State.mouseOnly, flip:State.doFlip, history:{}};
    window.api.send<Pic.SaveRequest>("save", config);
}

function open(){
    window.api.send("open");
}

function reveal(){
    window.api.send("reveal");
}

function restore(){
    window.api.send<Pic.RestoreRequest>("restore", {directory:currentDirectory, fullPath:""});
}

function applyConfig(data:Pic.Config){

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    State.mouseOnly = data.mode == "mouse";
    changeMode();

    State.isDark = data.theme == "dark";
    if(Dom.themeCheckbox) Dom.themeCheckbox.checked = State.isDark;
    applyTheme();

    changeFileList(data.history);
}

function changeSaveStatus(){
    if(State.isSaved){
        Dom.viewport.classList.add("saved");
    }else{
        Dom.viewport.classList.remove("saved");
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

function changeMode(){
    if(State.mouseOnly){
        Dom.viewport.classList.add("mouse");
    }else{
        Dom.viewport.classList.remove("mouse");
    }
}

async function changeOrientation(){
    if(State.doFlip){
        Dom.viewport.classList.add("flip");
    }else{
        Dom.viewport.classList.remove("flip");
    }

    if(isPrepared()){
        window.api.send<Pic.FlipRequest>("change-flip", {flip:State.doFlip});
    }

}

function changeFileList(history:{[key:string]:string}){

    if(!Dom.fileList) return;

    Dom.fileList.innerHTML = "";

    const fragment = document.createDocumentFragment();

    Object.keys(history).forEach(key => {
        const item = document.createElement("li");
        const remIcon = document.createElement("span");
        remIcon.innerHTML = "&times;";
        remIcon.classList.add("remove-history-btn");
        remIcon.addEventListener("click", removeHistory);
        const text = document.createElement("span");
        text.textContent = `${key}\\${history[key]}`;
        text.addEventListener("dblclick", onFileListItemClicked);
        item.append(remIcon, text);
        fragment.appendChild(item);
    });

    Dom.fileList.appendChild(fragment)
}

function onFileListItemClicked(e:MouseEvent){
    window.api.send<Pic.RestoreRequest>("restore", {directory:currentDirectory, fullPath: (e.target as HTMLElement).textContent});
}

function removeHistory(e:MouseEvent){
    if(confirm("Remove history?")){
        window.api.send<Pic.RemoveHistoryRequest>("remove-history", {fullPath: (e.target as HTMLElement).nextElementSibling.textContent});
    }
}

function applyTheme(){
    if(State.isDark == false){
        Dom.viewport.classList.remove("dark");
    }else{
        Dom.viewport.classList.add("dark");
    }
}

function toggleFileList(){
    if(State.isFileListOpen){
        Dom.viewport.classList.remove("file-list-open");
        State.isFileListOpen = false;
    }else{
        Dom.viewport.classList.add("file-list-open");
        State.isFileListOpen = true;
    }
}

function hideFileList(){
    Dom.viewport.classList.remove("file-list-open");
    State.isFileListOpen = false;
}

function minimize(){
    window.api.send("minimize")
}

function toggleMaximize(){
    window.api.send("toggle-maximize")
}

function toggleFullScreen(){
    if(State.isFullScreen){
        Dom.viewport.classList.remove("full")
        State.isFullScreen = false
    }else{
        Dom.viewport.classList.add("full")
        State.isFullScreen = true
    }

    window.api.send("toggle-fullscreen")
}

function close(){
    const config = {isDark:State.isDark, mouseOnly:State.mouseOnly, flip:State.doFlip, history:{}};
    window.api.send<Pic.SaveRequest>("close", config);
}

function lock(){
    if(!Dom.loader) return
    Dom.loader.style.display = "block";
}

function unlock(){
    if(!Dom.loader) return
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

window.api.receive<Pic.Config>("config-loaded", data => {
    applyConfig(data);
})

window.api.receive<Pic.FetchResult>("after-fetch", data => {

    if(data.image){
        const src = data.image.static ? data.image.fullPath : `app://${data.image.fullPath}?${new Date().getTime()}`;
        if(Dom.img) Dom.img.src = src
        const dummy = new Image();
        dummy.src = src;
        dummy.onload = function(){
            onImageLoaded(data, dummy);
        };
    }else{
        unlock();
    }

});

window.api.receive<Pic.SaveResult>("after-save", data => {
    State.isSaved = data.success;
    changeSaveStatus();
    changeFileList(data.history)
});

window.api.receive<Pic.RemoveHistoryResult>("after-remove-history", data => {
    changeFileList(data.history);
})

window.api.receive<Pic.Config>("after-toggle-maximize", data => {
    console.log(data)
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
})

window.api.receive<Pic.ErrorArgs>("error", data => {
    alert(data.message);
    unlock();
})

export {}