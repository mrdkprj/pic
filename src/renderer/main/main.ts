import { ImageTransform } from "../imageTransform";
import { DomElement } from "../dom"
import { Orientations, FORWARD, BACKWARD } from "../../constants"

const State = {
    isMaximized:false,
    isPinned: false,
    mouseOnly: false,
}

const Dom = {
    title: new DomElement("title"),
    resizeBtn: new DomElement("resizeBtn"),
    img: new DomElement<HTMLImageElement>("img"),
    imageArea: new DomElement("imageArea"),
    loader: new DomElement("loader"),
    viewport: new DomElement("viewport"),
    history: new DomElement("history"),
    scaleRate: new DomElement("scaleRate"),
    counter: new DomElement("counter"),
    category: new DomElement("category"),
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
        window.api.send("restart", {})
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
        request("open-edit-dialog", {})
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
        window.api.send("open-main-context", {})
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
        window.api.send("open-main-context", {})
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
    Dom.viewport.element.classList.add("dragging");
}

const onImageDragEnd = () => {
    Dom.viewport.element.classList.remove("dragging");
}

const onDrop = (e:DragEvent) => {

    e.preventDefault();

    if(!e.dataTransfer) return;

    if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
        const fullPath = e.dataTransfer.items[0].getAsFile()?.path ?? ""
        dropFile(fullPath);
    }
}

const loadImage = (result:Pic.FetchResult) => {

    currentImageFile = result.image;

    const src = currentImageFile.type === "path" ? `${result.image.src}?${new Date().getTime()}` : "";
    Dom.img.element.src = src

    if(currentImageFile.type == "undefined"){
        Dom.imageArea.element.classList.add("no-image")
    }else{
        Dom.imageArea.element.classList.remove("no-image")
    }

    State.isPinned = result.pinned;
    changePinStatus();

    fileCount = result.fileCount;

    Dom.counter.element.textContent = `${result.currentIndex} / ${fileCount}`;

    setCategory(result.image.detail.category)
}

const onImageLoaded = () => {

    orientationIndex = Orientations.indexOf(currentImageFile.detail.orientation);

    imageTransform.setImage(currentImageFile)

    unlock();

}

const changeInfoTexts = () => {

    Dom.title.element.textContent = `${currentImageFile.fileName} (${currentImageFile.detail.renderedWidth} x ${currentImageFile.detail.renderedHeight})`;

    Dom.scaleRate.element.textContent = `${Math.floor(imageTransform.getImageRatio() * 100)}%`
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

    if(Dom.loader.element.style.display == "block"){
        return false;
    }

    if(isHistoryOpen()){
        closeHistory();
    }

    lock();
    return true;
}

const dropFile = (fullPath:string) => {
    if(prepare()){
        request("drop-file", {fullPath});
    }
}

const startFetch = (index:number) => {
    if(prepare()){
        request("fetch-image", {index});
    }
}

const deleteFile = () => {
    if(prepare()){
        request("delete", {});
    }
}

const pin = () => {
    request("pin", {});
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
        Dom.viewport.element.classList.add("pinned");
    }else{
        Dom.viewport.element.classList.remove("pinned");
    }
}

const changeMaximizeIcon = () => {
    if(State.isMaximized){
        Dom.resizeBtn.element.classList.remove("minbtn");
        Dom.resizeBtn.element.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.element.classList.remove("maxbtn");
        Dom.resizeBtn.element.classList.add("minbtn");
    }
}

const changeMode = (mode:Pic.Mode) => {

    State.mouseOnly = mode === "Mouse"

    if(State.mouseOnly){
        Dom.viewport.element.classList.add("mouse");
    }else{
        Dom.viewport.element.classList.remove("mouse");
    }

}

const applyTheme = (theme:Pic.Theme) => {
    if(theme === "Light"){
        Dom.viewport.element.classList.remove("dark");
    }else{
        Dom.viewport.element.classList.add("dark");
    }
}

const showActualSize = () => {
    imageTransform.showActualSize()
}

const changeHistory = (history:{[key:string]:string}) => {

    Dom.history.element.innerHTML = "";

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

    Dom.history.element.appendChild(fragment)
}

const onHistoryItemClick = (e:MouseEvent) => {
    const fullPath = (e.target as HTMLElement).textContent ?? ""
    window.api.send("restore", {fullPath});
}

const removeHistory = (e:MouseEvent) => {
    if(confirm("Remove history?")){
        const fullPath = (e.target as HTMLElement).nextElementSibling?.textContent ?? ""
        window.api.send("remove-history", {fullPath});
    }
}

const toggleHistory = () => {
    if(isHistoryOpen()){
        Dom.viewport.element.classList.remove("history-open");
    }else{
        Dom.viewport.element.classList.add("history-open");
    }
}

const isHistoryOpen = () => {
    return Dom.viewport.element.classList.contains("history-open");
}

const closeHistory = () => {
    Dom.viewport.element.classList.remove("history-open");
}

const minimize = () => {
    window.api.send("minimize", {})
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize", {})
}

const isFullScreen = () => {
    return Dom.viewport.element.classList.contains("full")
}

const toggleFullscreen = () => {
    if(isFullScreen()){
        Dom.viewport.element.classList.remove("full")
    }else{
        Dom.viewport.element.classList.add("full")
    }

    window.api.send("toggle-fullscreen", {})
}

const close = () => {
    window.api.send("close", {});
}

const lock = () => {
    Dom.loader.element.style.display = "block";
}

const unlock = () => {
    Dom.loader.element.style.display = "none";
}

const setCategory = (category:number | undefined) => {

    if(category){
        Dom.category.element.textContent = `- [ @${category} ]`;
    }else{
        Dom.category.element.textContent = ""
    }
}

const openFileDialog = () => {
    window.api.send("open-file-dialog", {})
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
    if(Dom.img.element.src){
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

    Dom.title.fill();
    Dom.resizeBtn.fill();
    Dom.viewport.fill();
    Dom.img.fill();
    Dom.imageArea.fill();
    Dom.loader.fill();
    Dom.history.fill();
    Dom.scaleRate.fill();
    Dom.counter.fill();
    Dom.category.fill();

    Dom.img.element.addEventListener("load", onImageLoaded)

    Dom.imageArea.element.addEventListener("wheel", imageTransform.onWheel);

    Dom.imageArea.element.addEventListener("mousedown", onMousedown)

    const imageContainer = new DomElement("imageContainer").fill();
    imageContainer.addEventListener("dragover", e => e.preventDefault())
    imageContainer.addEventListener("drop", onDrop);

    imageTransform.init(Dom.imageArea.element, Dom.img.element)
    imageTransform.on("transformchange", changeInfoTexts)
    imageTransform.on("dragstart", onImageDragStart)
    imageTransform.on("dragend", onImageDragEnd)

}

window.addEventListener("resize", imageTransform.onWindowResize)
document.addEventListener("keydown", onKeydown)
document.addEventListener("click", onClick)
document.addEventListener("mousemove", imageTransform.onMousemove)
document.addEventListener("mouseup", onMouseup)

export {}