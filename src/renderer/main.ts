import { ImageTransform } from "./imageTransform";
import { Orientations, FORWARD, BACKWARD } from "../constants"

const State = {
    isMaximized:false,
    isPinned: false,
    mouseOnly: false,
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
        window.api.send("restart", null)
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
        window.api.send("open-main-context", null)
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

const onMousedown = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.classList.contains("clickable")){
        imageTransform.onMousedown(e);
    }

    if(isHistoryOpen()){
        closeHistory();
    }
}

const onMouseup = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.button == 2 && !State.mouseOnly){
        window.api.send("open-main-context", null)
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
    console.log(currentImageFile)

    const src = currentImageFile.type === "path" ? `${result.image.src}?${new Date().getTime()}` : "";
    Dom.img.src = src

    if(currentImageFile.type == "undefined"){
        Dom.imageArea.classList.add("no-image")
    }else{
        Dom.imageArea.classList.remove("no-image")
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

    changeHistory(data.history);
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

const showActualSize = () => {
    imageTransform.showActualSize()
}

const changeHistory = (history:{[key:string]:string}) => {

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
        text.addEventListener("dblclick", onHistoryItemClick);
        item.append(remIcon, text);
        fragment.appendChild(item);
    });

    Dom.history.appendChild(fragment)
}

const onHistoryItemClick = (e:MouseEvent) => {
    window.api.send("restore", {fullPath: (e.target as HTMLElement).textContent});
}

const removeHistory = (e:MouseEvent) => {
    if(confirm("Remove history?")){
        window.api.send("remove-history", {fullPath: (e.target as HTMLElement).nextElementSibling.textContent});
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
    window.api.send("minimize", null)
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize", null)
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

    window.api.send("toggle-fullscreen", null)
}

const close = () => {
    window.api.send("close", null);
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
    window.api.send("open-file-dialog", null)
}

const onAfterPin = (data:Pic.PinResult) => {
    State.isPinned = data.success;
    changePinStatus();
    changeHistory(data.history)
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
window.api.receive("show-actual-size", () => onResponse(() => showActualSize()));
window.api.receive("toggle-mode", (data) => onResponse(() => changeMode(data.preference.mode)))
window.api.receive("toggle-theme", (data) => onResponse(() => applyTheme(data.preference.theme)))
window.api.receive("open-history", () => onResponse(() => toggleHistory()));
window.api.receive("after-remove-history", data => onResponse(() => changeHistory(data.history)))
window.api.receive("after-toggle-maximize", data => onResponse(() => onAfterToggleMaximize(data)))


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

    Dom.imageArea.addEventListener("wheel", imageTransform.onWheel);

    Dom.imageArea.addEventListener("mousedown", onMousedown)

    document.getElementById("imageContainer").addEventListener("dragover", e => e.preventDefault())

    document.getElementById("imageContainer").addEventListener("drop", onDrop);

    imageTransform.init(Dom.imageArea, Dom.img)
    imageTransform.on("transformchange", changeInfoTexts)
    imageTransform.on("dragstart", onImageDragStart)
    imageTransform.on("dragend", onImageDragEnd)

}

window.addEventListener("resize", imageTransform.onWindowResize)
document.addEventListener("keydown", onKeydown)
document.addEventListener("click", onClick)
//document.addEventListener("mousedown", onMousedown)
document.addEventListener("mousemove", imageTransform.onMousemove)
document.addEventListener("mouseup", onMouseup)

export {}