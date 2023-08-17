import { ImageTransform } from "../imageTransform";
import { DomElement } from "../dom";
import { OrientationName } from "../../constants"

const Dom = {
    title: new DomElement("title"),
    resizeBtn: new DomElement("resizeBtn"),
    img: new DomElement<HTMLImageElement>("img"),
    imageArea: new DomElement("imageArea"),
    loader: new DomElement("loader"),
    viewport: new DomElement("viewport"),
    titleBar: new DomElement("titleBar"),
    scaleText: new DomElement("scaleText"),
    clipArea: new DomElement("clipArea"),
    canvas: new DomElement("clipCanvas"),
}

const imageTransform = new ImageTransform
const State = {
    isMaximized:false,
    editMode: "Resize" as Pic.EditMode,
    isClipping:false,
}
const clipState = {
    startX:0,
    startY:0,
}
const undoStack:Pic.ImageFile[] = []
const redoStack:Pic.ImageFile[] = []

let currentImageFile:Pic.ImageFile;

const onKeydown = (e:KeyboardEvent) => {

    if(e.key == "Escape"){
        close();
    }

    if(e.key == "F5"){
        window.api.send("restart", {})
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

    if(e.ctrlKey && e.key == "s"){
        saveImage(false);
    }

}

const onClick = (e:MouseEvent) =>{

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
        changeResizeMode(!imageTransform.isShrinkable());
    }

    if(e.target.id == "undo"){
        undo()
    }

    if(e.target.id == "redo"){
        redo();
    }

    if(e.target.id == "apply"){
        requestEdit();
    }

    if(e.target.id == "saveCopy"){
        saveImage(true);
    }

    if(e.target.id == "save"){
        saveImage(false);
    }

}

const onImageMousedown = (e:MouseEvent) => {

    if(State.editMode == "Clip") return;

    imageTransform.onMousedown(e)
}

const onmousedown  = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!e.target.classList.contains("clickable")) return;

    if(State.editMode == "Clip"){
        prepareClip();
        Dom.clipArea.element.style.transform = ""
        Dom.clipArea.element.style.width = "0px"
        Dom.clipArea.element.style.height = "0px"
        clipState.startX = e.clientX
        clipState.startY = e.clientY
        Dom.clipArea.element.style.top = clipState.startY + "px"
        Dom.clipArea.element.style.left = clipState.startX + "px"
        State.isClipping = true;
        Dom.canvas.element.style.display = "block"
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

        Dom.clipArea.element.style.transform = `scale(${scaleX}, ${scaleY})`
        Dom.clipArea.element.style.width = Math.abs(moveX) + "px"
        Dom.clipArea.element.style.height = Math.abs(moveY) + "px"
    }

    imageTransform.onMousemove(e);
}

const onMouseup = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(State.isClipping){
        State.isClipping = false;
        requestEdit();
        return;
    }

    Dom.viewport.element.classList.remove("dragging")
    imageTransform.onMouseup(e);
}

const onImageDragStart = () => {
    Dom.viewport.element.classList.add("dragging");
}

const onImageDragEnd = () => {
    Dom.viewport.element.classList.remove("dragging");
}

const loadImage = (data:Pic.ImageFile) => {

    currentImageFile = data;

    const src = currentImageFile.type === "path" ? `app://${data.fullPath}?${new Date().getTime()}` : `data:image/jpeg;base64,${data.fullPath}`;
    Dom.img.element.src = src

}

const onImageLoaded = () => {

    imageTransform.setImage(currentImageFile)

}

const changeTitle = () => {

    const size = {
        width: Math.floor(currentImageFile.detail.renderedWidth * imageTransform.getScale()),
        height: Math.floor(currentImageFile.detail.renderedHeight * imageTransform.getScale()),
    }
    Dom.title.element.textContent = `${currentImageFile.fileName} (${size.width} x ${size.height})`;

    Dom.scaleText.element.textContent = `${Math.floor(imageTransform.getImageRatio() * 100)}%`

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
    Dom.titleBar.element.classList.remove("clipping")

    if(State.editMode == "Clip"){
        Dom.titleBar.element.classList.add("clipping")
    }

}

const changeResizeMode = (shrinkable:boolean) => {

    imageTransform.enableShrink(shrinkable);
    if(shrinkable){
        Dom.titleBar.element.classList.add("shrink")
    }else{
        Dom.titleBar.element.classList.remove("shrink")
    }
}

const prepareClip = () => {
    const padding = 15;
    const titlebarHeight = 30 + padding;
    const rect = Dom.img.element.getBoundingClientRect();
    Dom.canvas.element.style.width = rect.width + "px"
    Dom.canvas.element.style.height = rect.height + "px"
    Dom.canvas.element.style.top = (rect.top - titlebarHeight) + "px"
    Dom.canvas.element.style.left = (rect.left - padding) + "px"
}

const celarClip = () => {
    Dom.canvas.element.style.display = "none"
}

const resizeImage = () => {
    changeEditMode("Resize")
    requestEdit();
}

const changeButtonState = () =>{
    Dom.titleBar.element.classList.remove("can-undo", "can-redo", "resized", "edited");

    if(undoStack.length){
        Dom.titleBar.element.classList.add("can-undo");
    }

    if(redoStack.length){
        Dom.titleBar.element.classList.add("can-redo");
    }

    if(imageTransform.isResized()){
        Dom.titleBar.element.classList.add("resized");
    }

    if(currentImageFile.type === "buffer"){
        Dom.titleBar.element.classList.add("edited");
    }
}

const undo = () => {

    const stack = undoStack.pop()

    if(stack){
        redoStack.push(currentImageFile);
        loadImage(stack);
    }

    changeButtonState();
}

const redo = () => {

    const stack = redoStack.pop()

    if(stack){
        undoStack.push(currentImageFile);
        loadImage(stack);
    }

    changeButtonState();
}

const getActualRect = (rect:Pic.ImageRectangle) => {

    const orientation = currentImageFile.detail.orientation;
    const rotated = orientation % 2 == 0;

    const width = rotated ? rect.height : rect.width
    const height = rotated ? rect.width : rect.height

    let top = rect.top;
    let left = rect.left;

    if(orientation === OrientationName.Clock90deg){
        top = rect.right
        left = rect.top
    }

    if(orientation == OrientationName.Clock180deg){
        top = rect.bottom
        left = rect.right;
    }

    if(orientation == OrientationName.Clock270deg){
        top = rect.left
        left = rect.bottom
    }

    return {
        top,
        left,
        width,
        height,
    }
}

const getClipInfo = () => {

    const clip = Dom.clipArea.element.getBoundingClientRect()

    if(clip.width < 5 || clip.height < 5) return null;

    const imageRect = Dom.img.element.getBoundingClientRect()

    if(clip.left > imageRect.right || clip.right < imageRect.left) return null

    if(clip.top > imageRect.bottom || clip.bottom < imageRect.top) return null

    const rate = Math.max(imageRect.width / currentImageFile.detail.renderedWidth, imageRect.height / currentImageFile.detail.renderedHeight);

    const clipLeft = Math.floor((clip.left - imageRect.left) / rate);
    const clipRight = Math.floor((imageRect.right - clip.right) / rate);
    const clipTop = Math.floor((clip.top - imageRect.top) / rate);
    const clipBottom = Math.floor((imageRect.bottom - clip.bottom) / rate);

    const clipWidth = Math.floor(clip.width / rate);
    const clipHeight = Math.floor(clip.height / rate);

    const left = clipLeft < 0 ? 0 : clipLeft;
    const top = clipTop < 0 ? 0 : clipTop;
    const right = clipRight < 0 ? 0 : clipRight;
    const bottom = clipBottom < 0 ? 0 : clipBottom

    let width = clipLeft < 0 ? Math.floor(clipWidth + clipLeft) : clipWidth
    width = clipRight < 0 ? Math.floor(width + clipRight) : width

    let height = clipTop < 0 ? Math.floor(clipHeight + clipTop) : clipHeight
    height = clipBottom < 0 ? Math.floor(height + clipBottom) : height

    const rect = getActualRect({
            top,
            left,
            right,
            bottom,
            width,
            height
    })

    return {
        image:currentImageFile,
        rect
    }
}

const requestEdit = () => {

    if(State.editMode === "Clip"){

        const clipInfo = getClipInfo();

        if(!clipInfo) return celarClip();

        request("clip",  clipInfo)
    }

    if(State.editMode === "Resize" && imageTransform.isResized()){

        const scale = imageTransform.getScale();

        const size = {
            width: Math.floor(currentImageFile.detail.width * scale),
            height: Math.floor(currentImageFile.detail.height * scale),
        }

        request("resize", {image:currentImageFile, size} )
    }

}

const showEditResult = (data:Pic.EditResult) => {

    if(redoStack.length){
        redoStack.length = 0;
    }

    undoStack.push(currentImageFile);

    changeButtonState();

    if(State.editMode == "Clip"){
        celarClip();
    }

    changeResizeMode(false)

    loadImage(data.image)

}

const onWindowResize = () => {
    if(Dom.img.element.src){
        imageTransform.onWindowResize();
        celarClip();
    }
}

const minimize = () => {
    window.api.send("minimize", {})
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize", {})
}

const onTransformChange = () => {

    if(imageTransform.isResized() && State.editMode == "Clip"){
        changeEditMode("Resize")
    }

    changeButtonState();

    changeTitle();
}

const prepare = () => {

    if(Dom.loader.element.style.display == "block"){
        return false;
    }
    lock();
    return true;
}

const saveImage = (saveCopy:boolean) => {

    if(!undoStack.length) return;

    const executeSave = saveCopy ? true : window.confirm("Overwrite image?")
    if(executeSave){
        request("save-image", {image:currentImageFile, saveCopy})
    }

}

const afterSaveImage = (data:Pic.SaveImageResult) => {

    if(data.status == "Error"){
        alert(data.message)
    }

    if(data.status == "Done"){
        close();
    }

}

const applyConfig = (data:Pic.Config) => {

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    applyTheme(data.preference.theme);

    undoStack.length = 0;
    redoStack.length = 0;
}

const applyTheme = (theme:Pic.Theme) => {
    if(theme === "Light"){
        Dom.viewport.element.classList.remove("dark");
    }else{
        Dom.viewport.element.classList.add("dark");
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

const clear = () => {
    unlock();
    Dom.img.element.src = "";
    changeEditMode(State.editMode)
}

const close = () => {
    clear();
    window.api.send("close-edit-dialog", {});
}

const lock = () => {
    Dom.loader.element.style.display = "block";
}

const unlock = () => {
    Dom.loader.element.style.display = "none";
}

const onOpen = (data:Pic.OpenEditEvent) => {
    applyConfig(data.config);
    loadImage(data.file)
}

const onAfterEdit = (data:Pic.EditResult) => {
    if(data.message){
        alert(data.message);
    }else{
        showEditResult(data);
    }
}

const onAfterToggleMaximize = (data:Pic.Config) => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
}

const request = <K extends keyof MainChannelEventMap>(channel:K, data:MainChannelEventMap[K]) => {
    if(prepare()){
        window.api.send(channel, data);
    }
}

const onResponse = (callback:() => void) => {
    unlock();
    callback();
}

window.api.receive("edit-dialog-opened", data => onResponse(() => onOpen(data)))
window.api.receive("after-edit", data => onResponse(() => onAfterEdit(data)))
window.api.receive("after-save-image", data => onResponse(() => afterSaveImage(data)))
window.api.receive("after-toggle-maximize", data => onResponse(() => onAfterToggleMaximize(data)))

window.onload = () => {

    Dom.title.fill();
    Dom.resizeBtn.fill();
    Dom.viewport.fill();
    Dom.titleBar.fill();
    Dom.img.fill();
    Dom.imageArea.fill();
    Dom.loader.fill();
    Dom.scaleText.fill();
    Dom.clipArea.fill();
    Dom.canvas.fill();

    Dom.img.element.addEventListener("mousedown", onImageMousedown)
    Dom.img.element.addEventListener("load", onImageLoaded)

    Dom.imageArea.element.addEventListener("wheel", imageTransform.onWheel)

    imageTransform.init(Dom.imageArea.element, Dom.img.element)
    imageTransform.on("transformchange", onTransformChange)
    imageTransform.on("dragstart", onImageDragStart)
    imageTransform.on("dragend", onImageDragEnd)
}

window.addEventListener("resize", onWindowResize)

document.addEventListener("keydown", onKeydown)
document.addEventListener("click", onClick)
document.addEventListener("mousedown", onmousedown)
document.addEventListener("mousemove", onMousemove)
document.addEventListener("mouseup", onMouseup)

export {}