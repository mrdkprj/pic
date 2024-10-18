<script lang="ts">
    import { onMount } from "svelte";
    import { appState, dispatch } from "./appStateReducer";

    export let onApply: (width: number, height: number, format: Pic.ImageFormat) => void;
    let width = 0;
    let height = 0;
    let format: Pic.ImageFormat = undefined;
    let keepRatio = true;
    let widthRatio = 1;
    let heightRatio = 1;
    let isIcon = false;

    const close = () => {
        dispatch({ type: "toggleSizeDialog", value: false });
    };

    const calculateWidth = () => {
        if (keepRatio) {
            width = Math.ceil(height * widthRatio);
        }
    };

    const calculateHeight = () => {
        if (keepRatio) {
            height = Math.ceil(width * heightRatio);
        }
    };

    const beforeApply = () => {
        onApply(width, height, format);
        dispatch({ type: "toggleSizeDialog", value: false });
    };

    onMount(() => {
        width = $appState.currentImageFile.detail.width;
        height = $appState.currentImageFile.detail.height;
        widthRatio = $appState.currentImageFile.detail.width / $appState.currentImageFile.detail.height;
        heightRatio = $appState.currentImageFile.detail.height / $appState.currentImageFile.detail.width;
        isIcon = $appState.currentImageFile.detail.format == "ico";
    });
</script>

<div class="size-container">
    <div class="size">
        <div class="top">Size & Format</div>
        <div class="middle">
            <div class="row" style="margin: 10px 0px 0px 0px;justify-content:center;">
                <label>
                    <input type="checkbox" bind:checked={keepRatio} disabled={isIcon} />
                    Keep aspect ratio
                </label>
            </div>
            <div class="row">
                <div class="label">Width</div>
                <input type="number" min="1" bind:value={width} on:input={calculateHeight} disabled={isIcon} />
                <div class="label">px</div>
                <div class="x"></div>
                <div class="label">Height</div>
                <input type="number" min="1" bind:value={height} on:input={calculateWidth} disabled={isIcon} />
                <div class="label">px</div>
            </div>
            <div class="row">
                <div class="label">Format</div>
                <select bind:value={format}>
                    <option value=""></option>
                    <option value="jpeg">JPG</option>
                    <option value="png">PNG</option>
                    <option value="ico">ICO</option>
                </select>
            </div>
        </div>
        <div class="space"></div>
        <div class="buttons">
            <button on:click={beforeApply}>Apply</button><button on:click={close}>Close</button>
        </div>
    </div>
</div>

<style>
    .size-container {
        position: absolute;
        left: 0px;
        top: 35px;
        width: 100%;
        height: calc(100% - 35px);
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgb(0 0 0 / 30%);
        z-index: 888;
    }

    .size {
        width: 500px;
        height: 320px;
        padding: 20px;
        display: flex;
        z-index: 999;
        background-color: var(--img-bgcolor);
        border-radius: 8px;
        color: #fff;
        flex-direction: column;
        align-items: center;
        justify-content: space-evenly;
        border: 1px solid #000;
        box-shadow: 0px 0px 2px 2px rgba(0, 0, 0, 0.3);
        user-select: none;
    }

    .top {
        height: 50px;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .middle {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .row {
        width: 100%;
        display: flex;
        margin: 20px 0;
    }

    .label {
        margin-right: 10px;
        margin-right: 10px;
        padding: 10px;
    }

    .x {
        margin: 0px 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
    }

    input[type="number"] {
        width: 100px;
        padding: 10px;
        outline: none;
        font-size: 16px;
        border-radius: 3px;
    }

    input[type="checkbox"] {
        outline: none;
    }

    select {
        padding: 10px;
        border-radius: 3px;
        appearance: button;
        font-size: 16px;
        outline: none;
    }

    .space {
        flex: 1 1 auto;
    }

    .buttons {
        height: 70px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 85%;
    }
    button {
        padding: 10px 0px;
        width: 200px;
    }
</style>
