<script lang="ts">
    import { onMount } from "svelte";
    import Loader from "../Loader.svelte";
    import History from "./History.svelte";
    import icon from "../../assets/icon.ico";
    import { appState, dispatch } from "./appStateReducer";
    import { ImageTransform } from "../imageTransform";
    import { ContextMenu } from "../contextmenu";
    import { Orientations, FORWARD, BACKWARD } from "../../constants";

    const menu = new ContextMenu();

    let orientationIndex = 0;
    let imageArea: HTMLDivElement;
    let img: HTMLImageElement;

    const imageTransform = new ImageTransform();

    const onKeydown = (e: KeyboardEvent) => {
        if (e.ctrlKey) {
            if (e.key == "ArrowRight") {
                rotateRight();
                return;
            }

            if (e.key == "ArrowLeft") {
                rotateLeft();
                return;
            }

            if (e.key == "ArrowUp") {
                orientationIndex = 0;
                rotate();
                return;
            }

            if (e.key == "ArrowDown") {
                orientationIndex = 2;
                rotate();
                return;
            }

            if (e.key == "r") {
                e.preventDefault();
            }

            if (e.key == "h") {
                toggleHistory();
            }

            if (e.key == "s") {
                e.preventDefault();
                pin();
            }
        }

        if (e.key == "F11") {
            e.preventDefault();
            toggleFullscreen();
        }

        if (e.key == "Escape") {
            exitFullscreen();
        }

        if (e.key == "F5") {
            window.api.send("restart", {});
        }

        if (e.key === "Delete") {
            deleteFile();
        }

        if (e.key === "ArrowRight") {
            startFetch(FORWARD);
        }

        if (e.key === "ArrowLeft") {
            startFetch(BACKWARD);
        }
    };

    const shouldCloseHistory = (e: MouseEvent) => {
        if (!$appState.isHistoryOpen) return false;

        return !e.composedPath().some((target) => target instanceof HTMLElement && target.classList.contains("history"));
    };

    const onImageAreaMousedown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).classList.contains("clickable")) {
            imageTransform.onMousedown(e);
        }
    };

    const onMouseup = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (shouldCloseHistory(e)) {
            return closeHistory();
        }

        if (e.button == 2 && !$appState.isMouseOnly) {
            menu.popup(e);
            return;
        }

        if (!imageTransform.isImageMoved() && e.target.classList.contains("clickable")) {
            if ($appState.isMouseOnly) {
                e.preventDefault();
                if (e.button == 0) {
                    startFetch(-1);
                }

                if (e.button == 2) {
                    startFetch(1);
                }
            }
        }

        imageTransform.onMouseup(e);
    };

    const onImageDragStart = () => {
        dispatch({ type: "dragging", value: true });
    };

    const onImageDragEnd = () => {
        dispatch({ type: "dragging", value: false });
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();

        if (!e.dataTransfer) return;

        if (e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")) {
            const fullPath = e.dataTransfer.items[0].getAsFile()?.path ?? "";
            dropFile(fullPath);
        }
    };

    const loadImage = (result: Pic.FetchResult) => {
        dispatch({ type: "loadImage", value: result });
        setCategory(result.image.detail.category);
    };

    const onImageLoaded = () => {
        orientationIndex = Orientations.indexOf($appState.currentImageFile.detail.orientation);

        imageTransform.setImage($appState.currentImageFile);

        unlock();
    };

    const changeInfoTexts = () => {
        const scaleRate = `${Math.floor(imageTransform.getImageRatio() * 100)}%`;
        dispatch({ type: "scaleRate", value: scaleRate });
    };

    const rotateLeft = () => {
        orientationIndex--;
        if (orientationIndex < 0) {
            orientationIndex = Orientations.length - 1;
        }

        rotate();
    };

    const rotateRight = () => {
        orientationIndex++;
        if (orientationIndex > Orientations.length - 1) {
            orientationIndex = 0;
        }

        rotate();
    };

    const rotate = () => {
        request("rotate", { orientation: Orientations[orientationIndex] });
    };

    const beforeRequest = () => {
        if ($appState.locked) {
            return false;
        }

        if ($appState.isHistoryOpen) {
            closeHistory();
        }

        lock();
        return true;
    };

    const dropFile = (fullPath: string) => {
        if (beforeRequest()) {
            window.api.send("drop-file", { fullPath });
        }
    };

    const startFetch = (index: number) => {
        if (beforeRequest()) {
            window.api.send("fetch-image", { index });
        }
    };

    const deleteFile = () => {
        if (beforeRequest()) {
            request("delete", {});
        }
    };

    const pin = () => {
        request("pin", {});
    };

    const prepare = (e: Pic.ReadyEvent) => {
        dispatch({ type: "isMaximized", value: e.settings.isMaximized });

        changeMode(e.settings.preference.mode);

        dispatch({ type: "history", value: e.settings.history });

        menu.build(e.menu);
        menu.onClick((e) => window.api.send("menu-click", e));
    };

    const changeMode = (mode: Pic.Mode) => {
        dispatch({ type: "isMouseOnly", value: mode === "Mouse" });
    };

    const showActualSize = () => {
        imageTransform.showActualSize();
    };

    const toggleHistory = () => {
        dispatch({ type: "isHistoryOpen", value: !$appState.isHistoryOpen });
    };

    const closeHistory = () => {
        dispatch({ type: "isHistoryOpen", value: false });
    };

    const minimize = () => {
        window.api.send("minimize", {});
    };

    const toggleMaximize = () => {
        window.api.send("toggle-maximize", {});
    };

    const exitFullscreen = () => {
        dispatch({ type: "isFullscreen", value: false });
        window.api.send("toggle-fullscreen", {
            fullscreen: $appState.isFullscreen,
        });
    };

    const toggleFullscreen = () => {
        dispatch({ type: "isFullscreen", value: !$appState.isFullscreen });
        window.api.send("toggle-fullscreen", {
            fullscreen: $appState.isFullscreen,
        });
    };

    const close = () => {
        window.api.send("close", {});
    };

    const lock = () => {
        dispatch({ type: "locked", value: true });
    };

    const unlock = () => {
        dispatch({ type: "locked", value: false });
    };

    const setCategory = (categoryNumber: number | undefined) => {
        const category = categoryNumber ? `- [ @${categoryNumber} ]` : "";
        dispatch({ type: "category", value: category });
    };

    const onAfterPin = (data: Pic.PinResult) => {
        dispatch({ type: "isPinned", value: data.success });
        dispatch({ type: "history", value: data.history });
    };

    const onAfterToggleMaximize = (data: Pic.Settings) => {
        dispatch({ type: "isMaximized", value: data.isMaximized });
    };

    const request = <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => {
        if ($appState.imageSrc) {
            window.api.send(channel, data);
        } else {
            unlock();
        }
    };

    const onResponse = (callback: () => void) => {
        unlock();
        callback();
    };

    onMount(() => {
        imageTransform.init(imageArea, img);
        imageTransform.on("transformchange", changeInfoTexts);
        imageTransform.on("dragstart", onImageDragStart);
        imageTransform.on("dragend", onImageDragEnd);

        window.api.receive("ready", (data) => onResponse(() => prepare(data)));
        window.api.receive("after-fetch", (data) => onResponse(() => loadImage(data)));
        window.api.receive("after-pin", (data) => onResponse(() => onAfterPin(data)));
        window.api.receive("show-actual-size", () => onResponse(() => showActualSize()));
        window.api.receive("toggle-mode", (data) => onResponse(() => changeMode(data.preference.mode)));
        window.api.receive("open-history", () => onResponse(() => toggleHistory()));
        window.api.receive("after-remove-history", (data) => onResponse(() => dispatch({ type: "history", value: data.history })));
        window.api.receive("after-toggle-maximize", (data) => onResponse(() => onAfterToggleMaximize(data)));

        return () => {
            window.api.removeAllListeners("ready");
            window.api.removeAllListeners("after-fetch");
            window.api.removeAllListeners("after-pin");
            window.api.removeAllListeners("show-actual-size");
            window.api.removeAllListeners("toggle-mode");
            window.api.removeAllListeners("open-history");
            window.api.removeAllListeners("after-remove-history");
            window.api.removeAllListeners("after-toggle-maximize");
        };
    });

    const handelKeydown = () => {};
</script>

<svelte:window on:resize={imageTransform.onWindowResize} />
<svelte:document on:keydown={onKeydown} on:mousemove={imageTransform.onMousemove} on:mouseup={onMouseup} />

<div
    class="viewport"
    class:dragging={$appState.dragging}
    class:pinned={$appState.isPinned}
    class:mouse={$appState.isMouseOnly}
    class:history-open={$appState.isHistoryOpen}
    class:full={$appState.isFullscreen}
>
    <div class="title-bar">
        <div class="icon-area">
            <img class="ico" src={icon} alt="" />
            <div class="title">
                {$appState.currentImageFile.fileName}
            </div>
            <div class="category">{$appState.category}</div>
        </div>
        <div class="menu header">
            <div class="btn-area">
                <div class="btn can-focus" on:click={() => request("open-edit-dialog", {})} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path
                            d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"
                        />
                        <path
                            fill-rule="evenodd"
                            d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"
                        />
                    </svg>
                </div>
                <div class="btn can-focus" on:click={rotateLeft} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="rotate-btn" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z" />
                        <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z" />
                    </svg>
                </div>
                <div class="btn can-focus" on:click={deleteFile} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path
                            fill-rule="evenodd"
                            d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                        />
                    </svg>
                </div>
                <div class="btn can-focus" on:click={rotateRight} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="rotate-btn" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                    </svg>
                </div>
                <div class="btn can-focus" on:click={pin} on:keydown={handelKeydown} role="button" tabindex="-1">
                    {#if $appState.isPinned}
                        <svg xmlns="http://www.w3.org/2000/svg" class="pinned-btn" viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z"
                            />
                        </svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" class="unpinned-btn" viewBox="0 0 16 16" fill="currentColor">
                            <path
                                d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.122 2.112v-.002.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a4.507 4.507 0 0 0-.288-.076 4.922 4.922 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a4.924 4.924 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034.114 0 .23-.011.343-.04L9.927 2.028c-.029.113-.04.23-.04.343a1.779 1.779 0 0 0 .062.46z"
                            />
                        </svg>
                    {/if}
                </div>
                <div class="btn can-focus" on:click={(e) => menu?.toggle(e)} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                    </svg>
                </div>
            </div>
        </div>
        <div class="window-area">
            <div class="info-area">
                <div class="text">{`${$appState.currentImageFile.detail.renderedWidth} x ${$appState.currentImageFile.detail.renderedHeight}`}</div>
                <div class="text">{$appState.scaleRate}</div>
                <div class="text">{$appState.counter}</div>
            </div>
            <div class="control-area">
                <div class="minimize" on:click={minimize} on:keydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
                <div class="maximize" on:click={toggleMaximize} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <div class:maxbtn={$appState.isMaximized} class:minbtn={!$appState.isMaximized}></div>
                </div>
                <div class="close" on:click={close} on:keydown={handelKeydown} role="button" tabindex="-1">&times;</div>
            </div>
        </div>
    </div>

    <div class="container">
        <Loader show={$appState.locked} />
        {#if $appState.isHistoryOpen}
            <History history={$appState.history} onClose={closeHistory} />
        {/if}

        <div class="image-container can-focus" on:dragover={(e) => e.preventDefault()} on:drop={onDrop} role="button" tabindex="-1" draggable="false">
            <div class="prev-area prev" on:click={() => startFetch(BACKWARD)} on:keydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow left"></span>
            </div>
            <div
                bind:this={imageArea}
                class="image-area clickable current"
                on:mousedown={onImageAreaMousedown}
                on:wheel={imageTransform.onWheel}
                on:keydown={handelKeydown}
                role="button"
                tabindex="-1"
            >
                <img src={$appState.imageSrc} bind:this={img} class="pic clickable" alt="" on:load={onImageLoaded} draggable="false" />
                {#if $appState.currentImageFile.type == "undefined"}
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" style="color:#727070;" viewBox="0 0 16 16">
                        <path
                            d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"
                        />
                    </svg>
                {/if}
            </div>
            <div class="next-area next" on:click={() => startFetch(FORWARD)} on:keydown={handelKeydown} role="button" tabindex="-1">
                <span class="arrow right"></span>
            </div>
        </div>
    </div>
</div>
