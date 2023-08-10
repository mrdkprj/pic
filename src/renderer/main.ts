import { ImageTransform } from "./imageTransform";
import { Orientations } from "../constants"

const BACKWARD = -1;
const FORWARD = 1;

const State = {
    isMaximized:false,
    isPinned: false,
    mouseOnly: false,
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
    scaleRate:null as HTMLElement,
    counter:null as HTMLElement,
    category:null as HTMLElement,
}

const imageTransform = new ImageTransform()

let currentImageFile:Pic.ImageFile;
let fileCount = 0;
let orientationIndex = 0;

window.onload = () => {

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn");
    Dom.viewport = document.getElementById("viewport");
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.history = document.getElementById("history")
    Dom.scaleRate = document.getElementById("scaleRate")
    Dom.counter = document.getElementById("counter");
    Dom.category = document.getElementById("category");

    Dom.img.addEventListener("load", onImageLoaded)

    Dom.img.addEventListener("mousedown", onImageMousedown)

    Dom.imageArea.addEventListener("mousedown", () => {
        if(isHistoryOpen()){
            closeHistory();
        }
    })

    Dom.imageArea.addEventListener("wheel", imageTransform.onWheel);

    document.getElementById("imageContainer").addEventListener("dragover", e => e.preventDefault())

    document.getElementById("imageContainer").addEventListener("drop", onDrop);

    imageTransform.init(Dom.imageArea, Dom.img)
    imageTransform.on("transformchange", changeInfoTexts)
    imageTransform.on("dragstart", onImageDragStart)
    imageTransform.on("dragend", onImageDragEnd)

}

window.addEventListener("resize", imageTransform.onWindowResize)
document.addEventListener("keydown", e => onKeydown(e))
document.addEventListener("click", e => onClick(e))
document.addEventListener("mousemove", e => imageTransform.onMousemove(e))
document.addEventListener("mouseup", e => onMouseup(e))
document.addEventListener("mouseup", e => onMouseup(e))

const onKeydown = (e:KeyboardEvent) => {

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
            orientationIndex = 0;
            rotate();
            return;
        }

        if(e.key == "ArrowDown"){
            orientationIndex = 2;
            rotate();
            return;
        }

    }

    if(e.key == "F1" || e.key == "Escape"){
        toggleFullscreen();
    }

    if(e.key == "F5"){
        request("restart", null)
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
        request("set-category", {category:Number(e.key)})
        setCategory(Number(e.key));
    }

    if(e.key === "F12"){
        openFileDialog();
    }
}

const onClick = (e:MouseEvent) => {

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
        request("open-main-context", null)
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

}

const onImageMousedown = (e:MouseEvent) => {
    imageTransform.onMousedown(e);
    if(isHistoryOpen()){
        closeHistory();
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
        request("open-main-context", null)
        return;
    }

    if(!imageTransform.isImageMoved() && e.target.classList.contains("clickable")){

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

    imageTransform.onMouseup(e)
}

const onImageDragStart = () => {
    Dom.viewport.classList.add("dragging");
}

const onImageDragEnd = () => {
    Dom.viewport.classList.remove("dragging");
}

const onDrop = (e:DragEvent) => {

    e.preventDefault();

    if(!e.dataTransfer) return;

    if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
        dropFile(e.dataTransfer.items[0].getAsFile());
    }
}

const loadImage = (result:Pic.FetchResult) => {
    currentImageFile = result.image;

    const src = currentImageFile.type === "path" ? `app://${result.image.fullPath}?${new Date().getTime()}` : "";
    Dom.img.src = src

    if(src){
        Dom.imageArea.classList.remove("no-image")
    }else{
        Dom.imageArea.classList.add("no-image")
    }

    State.isPinned = result.pinned;
    changePinStatus();

    fileCount = result.fileCount;

    Dom.counter.textContent = `${result.currentIndex} / ${fileCount}`;

    setCategory(result.image.detail.category)
}

const onImageLoaded = () => {

    orientationIndex = Orientations.indexOf(currentImageFile.detail.orientation);

    imageTransform.setImage(currentImageFile)

    unlock();

}

const changeInfoTexts = () => {

    Dom.title.textContent = `${currentImageFile.fileName} (${currentImageFile.detail.renderedWidth} x ${currentImageFile.detail.renderedHeight})`;

    Dom.scaleRate.textContent = `${Math.floor(imageTransform.getImageRatio() * 100)}%`
}


const rotateLeft = () => {
    orientationIndex--;
    if(orientationIndex < 0){
        orientationIndex = Orientations.length - 1;
    }

    rotate();
}

const rotateRight = () => {
    orientationIndex++;
    if(orientationIndex > Orientations.length - 1){
        orientationIndex = 0;
    }

    rotate();
}

const rotate = () => {
    request("rotate", {orientation:Orientations[orientationIndex]});
}


const prepare = () => {

    if(Dom.loader.style.display == "block"){
        return false;
    }

    if(isHistoryOpen()){
        closeHistory();
    }

    lock();
    return true;
}

const dropFile = (file:File | null) => {
    if(prepare()){
        request("drop-file", {fullPath:file?.path});
    }
}

const startFetch = (index:number) => {
    if(prepare()){
        request("fetch-image", {index});
    }
}

const deleteFile = () => {
    if(prepare()){
        request("delete", null);
    }
}

const pin = () => {
    request("pin", null);
}

const applyConfig = (data:Pic.Config) => {

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    changeMode(data.preference.mode);

    applyTheme(data.preference.theme);

    changeFileList(data.history);
}

const changePinStatus = () => {
    if(State.isPinned){
        Dom.viewport.classList.add("pinned");
    }else{
        Dom.viewport.classList.remove("pinned");
    }
}

const changeMaximizeIcon = () => {
    if(State.isMaximized){
        Dom.resizeBtn.classList.remove("minbtn");
        Dom.resizeBtn.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.classList.remove("maxbtn");
        Dom.resizeBtn.classList.add("minbtn");
    }
}

const changeMode = (mode:Pic.Mode) => {

    State.mouseOnly = mode === "Mouse"

    if(State.mouseOnly){
        Dom.viewport.classList.add("mouse");
    }else{
        Dom.viewport.classList.remove("mouse");
    }

}

const applyTheme = (theme:Pic.Theme) => {
    if(theme === "Light"){
        Dom.viewport.classList.remove("dark");
    }else{
        Dom.viewport.classList.add("dark");
    }
}

const changeFileList = (history:{[key:string]:string}) => {

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

const onFileListItemClicked = (e:MouseEvent) => {
    request("restore", {fullPath: (e.target as HTMLElement).textContent});
}

const removeHistory = (e:MouseEvent) => {
    if(confirm("Remove history?")){
        request("remove-history", {fullPath: (e.target as HTMLElement).nextElementSibling.textContent});
    }
}

const toggleHistory = () => {
    if(isHistoryOpen()){
        Dom.viewport.classList.remove("history-open");
    }else{
        Dom.viewport.classList.add("history-open");
    }
}

const isHistoryOpen = () => {
    return Dom.viewport.classList.contains("history-open");
}

const closeHistory = () => {
    Dom.viewport.classList.remove("history-open");
}

const minimize = () => {
    request("minimize", null)
}

const toggleMaximize = () => {
    request("toggle-maximize", null)
}

const isFullScreen = () => {
    return Dom.viewport.classList.contains("full")
}

const toggleFullscreen = () => {
    if(isFullScreen()){
        Dom.viewport.classList.remove("full")
    }else{
        Dom.viewport.classList.add("full")
    }

    request("toggle-fullscreen", null)
}

const close = () => {
    request("close", null);
}

const lock = () => {
    Dom.loader.style.display = "block";
}

const unlock = () => {
    Dom.loader.style.display = "none";
}

const setCategory = (category:number) => {

    if(category){
        Dom.category.textContent = `- [ @${category} ]`;
    }else{
        Dom.category.textContent = ""
    }
}

const openFileDialog = () => {
    request("open-file-dialog", null)
}

const onAfterPin = (data:Pic.PinResult) => {
    State.isPinned = data.success;
    changePinStatus();
    changeFileList(data.history)
}

const onAfterToggleMaximize = (data:Pic.Config) => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
}

const request = <K extends keyof MainChannelEventMap>(channel:K, data:MainChannelEventMap[K]) => {
    if(Dom.img.src){
        window.api.send(channel, data);
    }
}

const onResponse = (callback:() => void) => {
    unlock();
    callback();
}

window.api.receive("config-loaded", data => onResponse(() => applyConfig(data)))

window.api.receive("after-fetch", data => onResponse(() => loadImage(data)))

window.api.receive("after-pin", data => onResponse(() => onAfterPin(data)))

window.api.receive("show-actual-size", () => onResponse(() => imageTransform.showActualSize()));

window.api.receive("toggle-mode", (data) => onResponse(() => changeMode(data.preference.mode)))

window.api.receive("toggle-theme", (data) => onResponse(() => applyTheme(data.preference.theme)))

window.api.receive("open-history", () => onResponse(() => toggleHistory()));

window.api.receive("after-remove-history", data => onResponse(() => changeFileList(data.history)))

window.api.receive("after-toggle-maximize", data => onResponse(() => onAfterToggleMaximize(data)))

export {}